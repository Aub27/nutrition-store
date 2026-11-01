import secrets
from dataclasses import dataclass
from datetime import datetime, timezone
from decimal import Decimal

from sqlalchemy import func, or_, update
from sqlalchemy.orm import Session

from app.config import settings
from app.models.notification import AdminNotification
from app.models.order import Order, OrderItem
from app.models.product import Product
from app.schemas.order import CartLine, OrderCreate, Quote, QuoteLine
from app.services.catalog_service import _escape_like
from app.services.settings_service import get_settings

TRANSITIONS: dict[str, set[str]] = {
    "NEW": {"CONFIRMED", "CANCELLED"},
    "CONFIRMED": {"WAITING_DELIVERY", "CANCELLED"},
    "WAITING_DELIVERY": {"DELIVERED", "CANCELLED"},
    "DELIVERED": set(),
    "CANCELLED": set(),
}

_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"  # no 0/O/1/I to avoid read-aloud mistakes
_CENT = Decimal("0.01")


class OrderError(ValueError):
    """Business-rule failure that is safe to show to the customer."""


@dataclass
class ResolvedLine:
    product: Product | None
    product_id: int
    option: str | None
    quantity: int
    issue: str | None = None
    max_quantity: int | None = None


def _money(value: Decimal) -> Decimal:
    return Decimal(value).quantize(_CENT)


def _resolve_lines(db: Session, lines: list[CartLine]) -> list[ResolvedLine]:
    # Merge duplicates so the same product/option cannot dodge limits by being split.
    merged: dict[tuple[int, str | None], int] = {}
    for line in lines:
        key = (line.product_id, line.option or None)
        merged[key] = merged.get(key, 0) + line.quantity

    ids = {pid for pid, _ in merged}
    products = {p.id: p for p in db.query(Product).filter(Product.id.in_(ids)).all()} if ids else {}

    per_product_qty: dict[int, int] = {}
    for (pid, _), qty in merged.items():
        per_product_qty[pid] = per_product_qty.get(pid, 0) + qty

    resolved: list[ResolvedLine] = []
    for (pid, option), qty in merged.items():
        product = products.get(pid)
        line = ResolvedLine(product=product, product_id=pid, option=option, quantity=qty)
        if product is None or not product.is_active or not product.category.is_active:
            line.issue = "unavailable"
        else:
            options = list(product.options or [])
            if options:
                matched = next((o for o in options if option and o.lower() == option.lower()), None)
                if matched is None:
                    line.issue = "option_required"
                else:
                    line.option = matched
            else:
                line.option = None
            if line.issue is None:
                if product.stock_quantity is not None:
                    line.max_quantity = max(product.stock_quantity, 0)
                    if product.stock_quantity <= 0:
                        line.issue = "out_of_stock"
                    elif per_product_qty[pid] > product.stock_quantity:
                        line.issue = "insufficient_stock"
                if line.issue is None and qty > settings.max_qty_per_line:
                    line.issue = "max_quantity"
                    line.max_quantity = settings.max_qty_per_line
        resolved.append(line)
    return resolved


def _delivery(db: Session, resolved: list[ResolvedLine], subtotal: Decimal) -> tuple[Decimal, bool, Decimal | None, Decimal | None]:
    cfg = get_settings(db)
    threshold = Decimal(cfg.free_delivery_threshold) if cfg.free_delivery_threshold is not None else None
    flagged = any(r.product is not None and r.product.free_delivery for r in resolved)
    free = flagged or (threshold is not None and subtotal >= threshold)
    fee = _money(Decimal("0")) if free else _money(Decimal(cfg.delivery_fee))
    remaining = None
    if not free and threshold is not None:
        remaining = _money(threshold - subtotal)
    return fee, free, threshold, remaining


def quote(db: Session, lines: list[CartLine]) -> Quote:
    resolved = _resolve_lines(db, lines)
    out: list[QuoteLine] = []
    subtotal = Decimal("0")
    for r in resolved:
        p = r.product
        if p is None or r.issue == "unavailable":
            out.append(
                QuoteLine(
                    product_id=r.product_id,
                    name_fr=p.name_fr if p else "Produit indisponible",
                    unit_price=Decimal("0"),
                    quantity=r.quantity,
                    line_total=Decimal("0"),
                    available=False,
                    issue="unavailable",
                )
            )
            continue
        line_total = _money(p.price * r.quantity)
        if r.issue is None:
            subtotal += line_total
        out.append(
            QuoteLine(
                product_id=p.id,
                slug=p.slug,
                name_fr=p.name_fr,
                name_ar=p.name_ar,
                image_url=p.image_url,
                option=r.option,
                unit_price=_money(p.price),
                compare_at_price=_money(p.compare_at_price) if p.compare_at_price else None,
                quantity=r.quantity,
                line_total=line_total,
                available=r.issue is None,
                max_quantity=r.max_quantity,
                issue=r.issue,
            )
        )
    fee, free, threshold, remaining = _delivery(db, [r for r in resolved if r.issue is None], subtotal)
    if subtotal == 0:
        fee = _money(Decimal("0"))
    return Quote(
        lines=out,
        subtotal=_money(subtotal),
        delivery_fee=fee,
        total=_money(subtotal + fee),
        free_delivery=free,
        free_delivery_threshold=threshold,
        amount_to_free_delivery=remaining,
        all_available=all(line.available for line in out),
    )


def _new_order_number(db: Session) -> str:
    for _ in range(10):
        number = f"{settings.order_prefix}-" + "".join(secrets.choice(_ALPHABET) for _ in range(8))
        if not db.query(Order.id).filter(Order.order_number == number).first():
            return number
    raise OrderError("Impossible de générer un numéro de commande, veuillez réessayer.")


def create_order(db: Session, data: OrderCreate) -> Order:
    resolved = _resolve_lines(db, data.items)
    problems = [r for r in resolved if r.issue]
    if problems:
        first = problems[0]
        name = first.product.name_fr if first.product else "Un produit"
        messages = {
            "unavailable": f"{name} n'est plus disponible.",
            "option_required": f"Veuillez choisir une option valide pour {name}.",
            "out_of_stock": f"{name} est en rupture de stock.",
            "insufficient_stock": f"Stock insuffisant pour {name}.",
            "max_quantity": f"Quantité maximale dépassée pour {name}.",
        }
        raise OrderError(messages.get(first.issue or "", "Panier invalide."))

    subtotal = Decimal("0")
    for r in resolved:
        subtotal += _money(r.product.price * r.quantity)  # type: ignore[union-attr]
    fee, _, _, _ = _delivery(db, resolved, subtotal)

    order = Order(
        order_number=_new_order_number(db),
        customer_name=data.customer_name,
        phone_number=data.phone_number,
        email=str(data.email).lower() if data.email else None,
        address_line_1=data.address_line_1,
        address_line_2=data.address_line_2,
        city=data.city,
        postal_code=data.postal_code,
        country="Morocco",
        payment_method="CASH_ON_DELIVERY",
        status="NEW",
        subtotal=_money(subtotal),
        delivery_fee=fee,
        order_total=_money(subtotal + fee),
        customer_note=data.customer_note,
        consent_at=datetime.now(timezone.utc),
    )

    try:
        # Atomic decrement: the WHERE clause prevents overselling under concurrent orders.
        qty_by_product: dict[int, int] = {}
        for r in resolved:
            qty_by_product[r.product_id] = qty_by_product.get(r.product_id, 0) + r.quantity
        for pid, qty in qty_by_product.items():
            product = next(r.product for r in resolved if r.product_id == pid)
            if product is not None and product.stock_quantity is not None:
                result = db.execute(
                    update(Product)
                    .where(Product.id == pid, Product.stock_quantity >= qty)
                    .values(stock_quantity=Product.stock_quantity - qty)
                )
                if result.rowcount != 1:
                    raise OrderError(f"Stock insuffisant pour {product.name_fr}.")

        db.add(order)
        db.flush()
        for r in resolved:
            p = r.product
            db.add(
                OrderItem(
                    order_id=order.id,
                    product_id=p.id,  # type: ignore[union-attr]
                    product_name_snapshot=p.name_fr,  # type: ignore[union-attr]
                    option_label=r.option,
                    image_url_snapshot=p.image_url,  # type: ignore[union-attr]
                    unit_price_snapshot=_money(p.price),  # type: ignore[union-attr]
                    quantity=r.quantity,
                    line_total=_money(p.price * r.quantity),  # type: ignore[union-attr]
                )
            )
        db.add(
            AdminNotification(
                type="NEW_ORDER",
                order_id=order.id,
                title=f"Nouvelle commande {order.order_number}",
                message=f"{order.city} — {order.order_total} MAD",
            )
        )
        db.commit()
    except Exception:
        db.rollback()
        raise
    db.refresh(order)
    return order


def get_orders(
    db: Session, *, status: str | None = None, keyword: str | None = None, limit: int = 200
) -> list[Order]:
    query = db.query(Order)
    if status:
        query = query.filter(Order.status == status)
    if keyword and keyword.strip():
        pattern = f"%{_escape_like(keyword.strip().lower())}%"
        query = query.filter(
            or_(
                func.lower(Order.order_number).like(pattern, escape="\\"),
                func.lower(Order.customer_name).like(pattern, escape="\\"),
                Order.phone_number.like(pattern, escape="\\"),
                func.lower(Order.city).like(pattern, escape="\\"),
            )
        )
    return query.order_by(Order.created_at.desc(), Order.id.desc()).limit(limit).all()


def get_order_by_id(db: Session, order_id: int) -> Order | None:
    return db.get(Order, order_id)


def update_order_status(db: Session, order: Order, new_status: str) -> Order:
    allowed = TRANSITIONS.get(order.status, set())
    if new_status not in allowed:
        raise OrderError(f"Transition invalide : {order.status} → {new_status}.")
    now = datetime.now(timezone.utc)
    order.status = new_status
    if new_status == "CONFIRMED":
        order.confirmed_at = now
    elif new_status == "DELIVERED":
        order.delivered_at = now
    elif new_status == "CANCELLED":
        order.cancelled_at = now
        for item in order.items:
            if item.product_id is None:
                continue
            product = db.get(Product, item.product_id)
            if product is not None and product.stock_quantity is not None:
                db.execute(
                    update(Product)
                    .where(Product.id == product.id)
                    .values(stock_quantity=Product.stock_quantity + item.quantity)
                )
    db.commit()
    db.refresh(order)
    return order


def anonymize_order(db: Session, order: Order) -> Order:
    """Erase personal data (right to erasure) while keeping the accounting figures."""
    if order.status not in ("DELIVERED", "CANCELLED"):
        raise OrderError("Seules les commandes livrées ou annulées peuvent être anonymisées.")
    order.customer_name = "Client anonymisé"
    order.phone_number = "—"
    order.email = None
    order.address_line_1 = "—"
    order.address_line_2 = None
    order.postal_code = None
    order.customer_note = None
    order.anonymized_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(order)
    return order
