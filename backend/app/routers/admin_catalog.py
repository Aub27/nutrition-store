from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy import func
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.dependencies import get_current_admin, get_db
from app.models.admin_user import AdminUser
from app.models.category import Category
from app.models.order import OrderItem
from app.models.product import Product
from app.schemas.category import (
    CategoryAdminRead,
    CategoryCreate,
    CategoryReorder,
    CategoryUpdate,
)
from app.schemas.common import Page
from app.schemas.product import (
    ProductAdminRead,
    ProductCreate,
    ProductQuickUpdate,
    ProductUpdate,
)
from app.services import catalog_service
from app.services.audit_service import audit

router = APIRouter(prefix="/api/v1/admin", tags=["Admin Catalog"], dependencies=[Depends(get_current_admin)])


# ── Categories ────────────────────────────────────────────────────────────


def _category_admin(db: Session, category: Category) -> CategoryAdminRead:
    data = CategoryAdminRead.model_validate(category)
    data.product_count = db.query(func.count(Product.id)).filter(Product.category_id == category.id).scalar() or 0
    return data


@router.get("/categories", response_model=list[CategoryAdminRead])
def list_categories(is_active: bool | None = None, keyword: str | None = Query(None, max_length=100), db: Session = Depends(get_db)):
    categories = catalog_service.get_categories(db, only_active=False, keyword=keyword)
    if is_active is not None:
        categories = [c for c in categories if c.is_active == is_active]
    counts = dict(db.query(Product.category_id, func.count(Product.id)).group_by(Product.category_id).all())
    out = []
    for c in categories:
        item = CategoryAdminRead.model_validate(c)
        item.product_count = counts.get(c.id, 0)
        out.append(item)
    return out


@router.post("/categories", response_model=CategoryAdminRead, status_code=201)
def create_category(
    data: CategoryCreate, request: Request, admin: AdminUser = Depends(get_current_admin), db: Session = Depends(get_db)
):
    if catalog_service.get_category_by_slug(db, data.slug):
        raise HTTPException(status_code=400, detail="Ce slug existe déjà.")
    category = Category(**data.model_dump())
    db.add(category)
    db.flush()
    audit(db, "category_created", admin=admin, entity_type="category", entity_id=category.id, detail=category.name_fr, request=request)
    db.commit()
    db.refresh(category)
    return _category_admin(db, category)


@router.put("/categories/reorder", status_code=204)
def reorder_categories(
    data: CategoryReorder, request: Request, admin: AdminUser = Depends(get_current_admin), db: Session = Depends(get_db)
):
    existing = {c.id: c for c in db.query(Category).filter(Category.id.in_(data.ids)).all()}
    if len(existing) != len(set(data.ids)):
        raise HTTPException(status_code=400, detail="Catégorie inconnue.")
    for position, category_id in enumerate(data.ids):
        existing[category_id].sort_order = position
    audit(db, "categories_reordered", admin=admin, entity_type="category", request=request)
    db.commit()


@router.put("/categories/{category_id}", response_model=CategoryAdminRead)
def update_category(
    category_id: int,
    data: CategoryUpdate,
    request: Request,
    admin: AdminUser = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    category = catalog_service.get_category_by_id(db, category_id)
    if not category:
        raise HTTPException(status_code=404, detail="Catégorie introuvable.")
    changes = data.model_dump(exclude_unset=True)
    if "name_fr" in changes and changes["name_fr"] is None:
        raise HTTPException(status_code=422, detail="Le nom est obligatoire.")
    if changes.get("slug") and changes["slug"] != category.slug and catalog_service.get_category_by_slug(db, changes["slug"]):
        raise HTTPException(status_code=400, detail="Ce slug existe déjà.")
    for field, value in changes.items():
        setattr(category, field, value)
    audit(db, "category_updated", admin=admin, entity_type="category", entity_id=category.id, detail=category.name_fr, request=request)
    db.commit()
    db.refresh(category)
    return _category_admin(db, category)


@router.delete("/categories/{category_id}", status_code=204)
def delete_category(
    category_id: int, request: Request, admin: AdminUser = Depends(get_current_admin), db: Session = Depends(get_db)
):
    category = catalog_service.get_category_by_id(db, category_id)
    if not category:
        raise HTTPException(status_code=404, detail="Catégorie introuvable.")
    if db.query(Product.id).filter(Product.category_id == category_id).first():
        raise HTTPException(status_code=409, detail="Impossible de supprimer une catégorie qui contient des produits.")
    audit(db, "category_deleted", admin=admin, entity_type="category", entity_id=category.id, detail=category.name_fr, request=request)
    db.delete(category)
    db.commit()


# ── Products ──────────────────────────────────────────────────────────────


@router.get("/products", response_model=Page[ProductAdminRead])
def list_products(
    category_id: int | None = Query(None, gt=0),
    is_active: bool | None = None,
    q: str | None = Query(None, max_length=100),
    low_stock: bool = False,
    page: int = Query(1, ge=1, le=1000),
    page_size: int = Query(24, ge=1, le=100),
    db: Session = Depends(get_db),
):
    result = catalog_service.list_products(
        db,
        only_active=False,
        is_active=is_active,
        category_id=category_id,
        keyword=q,
        sort="newest",
        page=page,
        page_size=page_size,
    )
    if low_stock:
        result["items"] = [p for p in result["items"] if p.stock_quantity is not None and p.stock_quantity <= 5]
    return result


@router.get("/products/{product_id}", response_model=ProductAdminRead)
def get_product(product_id: int, db: Session = Depends(get_db)):
    product = db.get(Product, product_id)
    if not product:
        raise HTTPException(status_code=404, detail="Produit introuvable.")
    return product


def _slug_taken(db: Session, slug: str, exclude_id: int | None = None) -> bool:
    query = db.query(Product.id).filter(Product.slug == slug)
    if exclude_id:
        query = query.filter(Product.id != exclude_id)
    return query.first() is not None


@router.post("/products", response_model=ProductAdminRead, status_code=201)
def create_product(
    data: ProductCreate, request: Request, admin: AdminUser = Depends(get_current_admin), db: Session = Depends(get_db)
):
    if not catalog_service.get_category_by_id(db, data.category_id):
        raise HTTPException(status_code=400, detail="Catégorie introuvable.")
    slug = data.slug
    base, n = slug, 2
    while _slug_taken(db, slug):  # keep slugs unique automatically (e.g. whey-2)
        slug = f"{base}-{n}"
        n += 1
    payload = data.model_dump()
    payload["slug"] = slug
    product = Product(**payload)
    db.add(product)
    db.flush()
    audit(db, "product_created", admin=admin, entity_type="product", entity_id=product.id, detail=product.name_fr, request=request)
    db.commit()
    db.refresh(product)
    return product


@router.put("/products/{product_id}", response_model=ProductAdminRead)
def update_product(
    product_id: int,
    data: ProductUpdate,
    request: Request,
    admin: AdminUser = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    product = db.get(Product, product_id)
    if not product:
        raise HTTPException(status_code=404, detail="Produit introuvable.")
    changes = data.model_dump(exclude_unset=True)
    for required in ("name_fr", "price", "category_id"):
        if required in changes and changes[required] is None:
            raise HTTPException(status_code=422, detail=f"Le champ {required} est obligatoire.")
    if "category_id" in changes and not catalog_service.get_category_by_id(db, changes["category_id"]):
        raise HTTPException(status_code=400, detail="Catégorie introuvable.")
    if changes.get("slug") and _slug_taken(db, changes["slug"], product.id):
        raise HTTPException(status_code=400, detail="Ce slug existe déjà.")
    if "options" in changes and changes["options"] is None:
        changes["options"] = []
    for field, value in changes.items():
        setattr(product, field, value)
    if product.compare_at_price is not None and product.compare_at_price <= product.price:
        product.compare_at_price = None
    audit(db, "product_updated", admin=admin, entity_type="product", entity_id=product.id, detail=product.name_fr, request=request)
    db.commit()
    db.refresh(product)
    return product


@router.patch("/products/{product_id}", response_model=ProductAdminRead)
def quick_update_product(
    product_id: int,
    data: ProductQuickUpdate,
    request: Request,
    admin: AdminUser = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    product = db.get(Product, product_id)
    if not product:
        raise HTTPException(status_code=404, detail="Produit introuvable.")
    if data.is_active is not None:
        product.is_active = data.is_active
    if data.track_stock is False:
        product.stock_quantity = None
    elif data.stock_quantity is not None:
        product.stock_quantity = data.stock_quantity
    elif data.track_stock is True and product.stock_quantity is None:
        product.stock_quantity = 0
    audit(db, "product_quick_update", admin=admin, entity_type="product", entity_id=product.id, detail=product.name_fr, request=request)
    db.commit()
    db.refresh(product)
    return product


@router.delete("/products/{product_id}", status_code=204)
def delete_product(
    product_id: int, request: Request, admin: AdminUser = Depends(get_current_admin), db: Session = Depends(get_db)
):
    product = db.get(Product, product_id)
    if not product:
        raise HTTPException(status_code=404, detail="Produit introuvable.")
    if db.query(OrderItem.id).filter(OrderItem.product_id == product_id).first():
        raise HTTPException(
            status_code=409,
            detail="Ce produit figure dans des commandes. Masquez-le plutôt que de le supprimer.",
        )
    audit(db, "product_deleted", admin=admin, entity_type="product", entity_id=product.id, detail=product.name_fr, request=request)
    try:
        db.delete(product)
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="Suppression impossible.")
