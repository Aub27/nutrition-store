from datetime import date, datetime, timedelta, timezone
from decimal import Decimal

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.notification import AdminNotification, ContactMessage
from app.models.order import Order, OrderItem
from app.models.product import LOW_STOCK_THRESHOLD, Product
from app.schemas.admin import DashboardStats, LowStockProduct, SalesPoint, TopProduct

_ZERO = Decimal("0")


def _day(value) -> date:
    if isinstance(value, datetime):
        return value.astimezone(timezone.utc).date() if value.tzinfo else value.date()
    if isinstance(value, str):
        return datetime.fromisoformat(value[:19]).date()
    return value


def build_stats(db: Session) -> DashboardStats:
    now = datetime.now(timezone.utc)
    today = now.date()
    month_start = today.replace(day=1)
    window_start = today - timedelta(days=13)

    status_rows = db.query(Order.status, func.count(Order.id)).group_by(Order.status).all()
    by_status = {s: 0 for s in ("NEW", "CONFIRMED", "WAITING_DELIVERY", "DELIVERED", "CANCELLED")}
    by_status.update({s: c for s, c in status_rows})

    # Revenue counts every order that is not cancelled (cash is collected on delivery).
    valid = db.query(Order).filter(Order.status != "CANCELLED")
    recent = valid.filter(Order.created_at >= datetime.combine(window_start, datetime.min.time(), tzinfo=timezone.utc)).all()
    revenue_total = db.query(func.coalesce(func.sum(Order.order_total), 0)).filter(Order.status != "CANCELLED").scalar()
    revenue_count = db.query(func.count(Order.id)).filter(Order.status != "CANCELLED").scalar() or 0

    by_day: dict[date, tuple[int, Decimal]] = {}
    revenue_month = _ZERO
    orders_today = 0
    for o in db.query(Order).filter(Order.created_at >= datetime.combine(month_start - timedelta(days=0), datetime.min.time(), tzinfo=timezone.utc)).all():
        d = _day(o.created_at)
        if d == today:
            orders_today += 1
        if o.status != "CANCELLED" and d >= month_start:
            revenue_month += Decimal(o.order_total)
    for o in recent:
        d = _day(o.created_at)
        n, rev = by_day.get(d, (0, _ZERO))
        by_day[d] = (n + 1, rev + Decimal(o.order_total))
    series = [
        SalesPoint(
            date=(window_start + timedelta(days=i)).isoformat(),
            orders=by_day.get(window_start + timedelta(days=i), (0, _ZERO))[0],
            revenue=by_day.get(window_start + timedelta(days=i), (0, _ZERO))[1],
        )
        for i in range(14)
    ]

    top_rows = (
        db.query(
            OrderItem.product_name_snapshot,
            func.sum(OrderItem.quantity),
            func.sum(OrderItem.line_total),
        )
        .join(Order, Order.id == OrderItem.order_id)
        .filter(Order.status != "CANCELLED")
        .group_by(OrderItem.product_name_snapshot)
        .order_by(func.sum(OrderItem.quantity).desc())
        .limit(5)
        .all()
    )
    low = (
        db.query(Product)
        .filter(Product.is_active.is_(True), Product.stock_quantity.is_not(None), Product.stock_quantity <= LOW_STOCK_THRESHOLD)
        .order_by(Product.stock_quantity.asc())
        .limit(6)
        .all()
    )

    revenue_total = Decimal(revenue_total or 0)
    return DashboardStats(
        total_orders=sum(by_status.values()),
        orders_today=orders_today,
        by_status=by_status,
        revenue_total=revenue_total,
        revenue_month=revenue_month,
        average_basket=(revenue_total / revenue_count).quantize(Decimal("0.01")) if revenue_count else _ZERO,
        sales_last_14_days=series,
        top_products=[TopProduct(name=n, quantity=int(q or 0), revenue=Decimal(r or 0)) for n, q, r in top_rows],
        low_stock=[
            LowStockProduct(id=p.id, name_fr=p.name_fr, image_url=p.image_url, stock_quantity=p.stock_quantity)
            for p in low
        ],
        unread_notifications=db.query(AdminNotification).filter(AdminNotification.is_read.is_(False)).count(),
        unread_messages=db.query(ContactMessage).filter(ContactMessage.is_read.is_(False)).count(),
        active_products=db.query(Product).filter(Product.is_active.is_(True)).count(),
    )
