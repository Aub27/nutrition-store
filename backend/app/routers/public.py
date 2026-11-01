from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.core.constants import GOALS, GOAL_SLUGS, SORT_OPTIONS
from app.dependencies import get_db, rate_limit
from app.models.notification import ContactMessage
from app.schemas.admin import ContactCreate, SiteSettingsPublic
from app.schemas.category import CategoryRead
from app.schemas.common import Page
from app.schemas.order import OrderConfirmation, OrderCreate, Quote, QuoteRequest
from app.schemas.product import ProductPublic
from app.services import catalog_service, order_service
from app.services.settings_service import get_settings

router = APIRouter(prefix="/api/v1", tags=["Public"])


@router.get("/site-settings/public", response_model=SiteSettingsPublic)
def public_settings(db: Session = Depends(get_db)):
    return get_settings(db)


@router.get("/goals")
def goals():
    return GOALS


@router.get("/categories", response_model=list[CategoryRead])
def list_categories(keyword: str | None = Query(None, max_length=100), db: Session = Depends(get_db)):
    return catalog_service.get_categories(db, keyword=keyword)


@router.get("/categories/{slug}", response_model=CategoryRead)
def get_category(slug: str, db: Session = Depends(get_db)):
    category = catalog_service.get_category_by_slug(db, slug)
    if not category or not category.is_active:
        raise HTTPException(status_code=404, detail="Category not found")
    return category


@router.get("/brands", response_model=list[str])
def list_brands(db: Session = Depends(get_db)):
    return catalog_service.get_brands(db)


@router.get("/products", response_model=Page[ProductPublic])
def list_products(
    category: str | None = Query(None, max_length=120, description="Category slug"),
    category_id: int | None = Query(None, gt=0),
    goal: str | None = Query(None, max_length=50),
    brand: str | None = Query(None, max_length=100),
    q: str | None = Query(None, max_length=100),
    min_price: float | None = Query(None, ge=0, le=1_000_000),
    max_price: float | None = Query(None, ge=0, le=1_000_000),
    on_sale: bool = False,
    in_stock: bool = False,
    is_new: bool = False,
    is_bestseller: bool = False,
    free_delivery: bool = False,
    sort: str = Query("popular", max_length=20),
    page: int = Query(1, ge=1, le=1000),
    page_size: int = Query(12, ge=1, le=48),
    db: Session = Depends(get_db),
):
    if goal and goal not in GOAL_SLUGS:
        raise HTTPException(status_code=422, detail="Unknown goal")
    if sort not in SORT_OPTIONS:
        raise HTTPException(status_code=422, detail="Unknown sort option")
    return catalog_service.list_products(
        db,
        category_slug=category,
        category_id=category_id,
        goal=goal,
        brand=brand,
        keyword=q,
        min_price=min_price,
        max_price=max_price,
        on_sale=on_sale,
        in_stock=in_stock,
        is_new=is_new,
        is_bestseller=is_bestseller,
        free_delivery=free_delivery,
        sort=sort,
        page=page,
        page_size=page_size,
    )


@router.get("/products/{slug}", response_model=ProductPublic)
def get_product(slug: str, db: Session = Depends(get_db)):
    product = catalog_service.get_active_product_by_slug(db, slug)
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    return product


@router.get("/products/{slug}/related", response_model=list[ProductPublic])
def related_products(slug: str, db: Session = Depends(get_db)):
    product = catalog_service.get_active_product_by_slug(db, slug)
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    return catalog_service.get_related_products(db, product)


@router.post("/cart/quote", response_model=Quote, dependencies=[Depends(rate_limit("quote", 120, 60))])
def cart_quote(data: QuoteRequest, db: Session = Depends(get_db)):
    """Authoritative prices, availability and delivery fee for a cart (never trust the browser)."""
    return order_service.quote(db, data.items)


@router.post(
    "/orders",
    response_model=OrderConfirmation,
    status_code=201,
    dependencies=[Depends(rate_limit("order-burst", 3, 60)), Depends(rate_limit("order-hour", 15, 3600))],
)
def create_order(data: OrderCreate, db: Session = Depends(get_db)):
    try:
        return order_service.create_order(db, data)
    except order_service.OrderError as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@router.post("/contact", status_code=202, dependencies=[Depends(rate_limit("contact", 5, 3600))])
def contact(data: ContactCreate, db: Session = Depends(get_db)):
    if data.website:  # honeypot tripped: pretend success, store nothing
        return {"status": "received"}
    if not data.consent:
        raise HTTPException(status_code=422, detail="Consentement requis.")
    db.add(
        ContactMessage(
            name=data.name,
            email=str(data.email).lower() if data.email else None,
            phone=data.phone,
            subject=data.subject,
            message=data.message.strip(),
            consent_at=datetime.now(timezone.utc),
        )
    )
    db.commit()
    return {"status": "received"}
