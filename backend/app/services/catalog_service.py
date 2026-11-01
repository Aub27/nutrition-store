from math import ceil

from sqlalchemy import func, or_
from sqlalchemy.orm import Query, Session

from app.models.category import Category
from app.models.product import Product


def _escape_like(value: str) -> str:
    return value.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")


def _keyword_filter(column_list, keyword: str):
    pattern = f"%{_escape_like(keyword.strip().lower())}%"
    return or_(*[func.lower(col).like(pattern, escape="\\") for col in column_list])


def get_categories(db: Session, *, only_active: bool = True, keyword: str | None = None) -> list[Category]:
    query = db.query(Category)
    if only_active:
        query = query.filter(Category.is_active.is_(True))
    if keyword and keyword.strip():
        query = query.filter(_keyword_filter([Category.name_fr, Category.slug, Category.description_fr], keyword))
    return query.order_by(Category.sort_order, Category.id).all()


def get_category_by_id(db: Session, category_id: int) -> Category | None:
    return db.get(Category, category_id)


def get_category_by_slug(db: Session, slug: str) -> Category | None:
    return db.query(Category).filter(Category.slug == slug).first()


def _apply_product_filters(
    query: Query,
    *,
    only_active: bool,
    category_id: int | None = None,
    category_slug: str | None = None,
    goal: str | None = None,
    brand: str | None = None,
    keyword: str | None = None,
    min_price: float | None = None,
    max_price: float | None = None,
    on_sale: bool = False,
    in_stock: bool = False,
    is_new: bool = False,
    is_bestseller: bool = False,
    free_delivery: bool = False,
    is_active: bool | None = None,
) -> Query:
    if only_active:
        query = query.filter(Product.is_active.is_(True)).join(Category).filter(Category.is_active.is_(True))
    elif is_active is not None:
        query = query.filter(Product.is_active.is_(is_active))
    if category_id is not None:
        query = query.filter(Product.category_id == category_id)
    if category_slug:
        query = query.filter(Product.category_id.in_(
            query.session.query(Category.id).filter(Category.slug == category_slug)
        ))
    if goal:
        query = query.filter(Product.goal == goal)
    if brand:
        query = query.filter(func.lower(Product.brand) == brand.strip().lower())
    if keyword and keyword.strip():
        query = query.filter(
            _keyword_filter(
                [Product.name_fr, Product.name_ar, Product.brand, Product.slug, Product.short_description_fr],
                keyword,
            )
        )
    if min_price is not None:
        query = query.filter(Product.price >= min_price)
    if max_price is not None:
        query = query.filter(Product.price <= max_price)
    if on_sale:
        query = query.filter(Product.compare_at_price.is_not(None), Product.compare_at_price > Product.price)
    if in_stock:
        query = query.filter(or_(Product.stock_quantity.is_(None), Product.stock_quantity > 0))
    if is_new:
        query = query.filter(Product.is_new.is_(True))
    if is_bestseller:
        query = query.filter(Product.is_bestseller.is_(True))
    if free_delivery:
        query = query.filter(Product.free_delivery.is_(True))
    return query


_SORTS = {
    "newest": (Product.created_at.desc(), Product.id.desc()),
    "price_asc": (Product.price.asc(), Product.id.asc()),
    "price_desc": (Product.price.desc(), Product.id.desc()),
    "name": (func.lower(Product.name_fr).asc(), Product.id.asc()),
    "popular": (Product.is_bestseller.desc(), Product.sort_order.asc(), Product.id.desc()),
}


def list_products(
    db: Session,
    *,
    only_active: bool = True,
    sort: str = "popular",
    page: int = 1,
    page_size: int = 12,
    **filters,
) -> dict:
    query = _apply_product_filters(db.query(Product), only_active=only_active, **filters)
    total = query.count()
    ordering = _SORTS.get(sort, _SORTS["popular"])
    items = query.order_by(*ordering).offset((page - 1) * page_size).limit(page_size).all()
    return {
        "items": items,
        "total": total,
        "page": page,
        "page_size": page_size,
        "pages": max(1, ceil(total / page_size)),
    }


def get_active_product_by_slug(db: Session, slug: str) -> Product | None:
    return (
        db.query(Product)
        .join(Category)
        .filter(Product.slug == slug, Product.is_active.is_(True), Category.is_active.is_(True))
        .first()
    )


def get_related_products(db: Session, product: Product, limit: int = 4) -> list[Product]:
    return (
        db.query(Product)
        .filter(Product.category_id == product.category_id, Product.id != product.id, Product.is_active.is_(True))
        .order_by(Product.is_bestseller.desc(), Product.id.desc())
        .limit(limit)
        .all()
    )


def get_brands(db: Session) -> list[str]:
    rows = (
        db.query(Product.brand)
        .filter(Product.is_active.is_(True), Product.brand.is_not(None), Product.brand != "")
        .distinct()
        .order_by(Product.brand)
        .all()
    )
    return [r[0] for r in rows]
