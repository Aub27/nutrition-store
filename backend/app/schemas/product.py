from datetime import datetime
from decimal import Decimal
from typing import Annotated

from pydantic import AfterValidator, BaseModel, ConfigDict, Field, model_validator

from app.core.constants import GOAL_SLUGS
from app.core.text import clean_text, slugify
from app.schemas.common import ImageUrl, LongText, ShortText

_SLUG = r"^[a-z0-9]+(?:-[a-z0-9]+)*$"
Money = Annotated[Decimal, Field(ge=0, le=Decimal("1000000"), max_digits=10, decimal_places=2)]
OptionStr = Annotated[str, Field(min_length=1, max_length=60), AfterValidator(clean_text)]


def _check_goal(v: str | None) -> str | None:
    if v in (None, ""):
        return None
    if v not in GOAL_SLUGS:
        raise ValueError("Objectif inconnu.")
    return v


def _dedupe_options(v: list[str]) -> list[str]:
    seen: set[str] = set()
    out: list[str] = []
    for item in v:
        if item.lower() not in seen:
            seen.add(item.lower())
            out.append(item)
    return out


Goal = Annotated[str | None, AfterValidator(_check_goal)]
Options = Annotated[list[OptionStr], AfterValidator(_dedupe_options), Field(max_length=40)]


class ProductBase(BaseModel):
    category_id: int
    name_fr: ShortText = Field(min_length=2)
    name_ar: ShortText | None = None
    slug: str | None = Field(default=None, pattern=_SLUG, max_length=120)
    brand: ShortText | None = Field(default=None, max_length=100)
    goal: Goal = None
    short_description_fr: LongText | None = Field(default=None, max_length=500)
    short_description_ar: LongText | None = Field(default=None, max_length=500)
    full_description_fr: LongText | None = None
    full_description_ar: LongText | None = None
    nutrition_facts: LongText | None = None
    usage_fr: LongText | None = None
    usage_ar: LongText | None = None
    weight_label: ShortText | None = Field(default=None, max_length=50)
    option_label: ShortText | None = Field(default=None, max_length=50)
    options: Options = Field(default_factory=list)
    price: Money
    compare_at_price: Money | None = None
    image_url: ImageUrl | None = None
    is_active: bool = True
    is_new: bool = False
    is_bestseller: bool = False
    free_delivery: bool = False
    stock_quantity: int | None = Field(default=None, ge=0, le=1_000_000)
    sort_order: int = Field(default=0, ge=0, le=100000)

    @model_validator(mode="after")
    def _promo_consistent(self):
        if self.compare_at_price is not None and self.compare_at_price <= self.price:
            self.compare_at_price = None
        return self


class ProductCreate(ProductBase):
    @model_validator(mode="after")
    def auto_slug(self):
        if not self.slug:
            self.slug = slugify(self.name_fr)
        if not self.slug:
            raise ValueError("Impossible de générer un identifiant (slug) à partir du nom.")
        return self


class ProductUpdate(BaseModel):
    category_id: int | None = None
    name_fr: ShortText | None = Field(default=None, min_length=2)
    name_ar: ShortText | None = None
    slug: str | None = Field(default=None, pattern=_SLUG, max_length=120)
    brand: ShortText | None = Field(default=None, max_length=100)
    goal: Goal = None
    short_description_fr: LongText | None = Field(default=None, max_length=500)
    short_description_ar: LongText | None = Field(default=None, max_length=500)
    full_description_fr: LongText | None = None
    full_description_ar: LongText | None = None
    nutrition_facts: LongText | None = None
    usage_fr: LongText | None = None
    usage_ar: LongText | None = None
    weight_label: ShortText | None = Field(default=None, max_length=50)
    option_label: ShortText | None = Field(default=None, max_length=50)
    options: Options | None = None
    price: Money | None = None
    compare_at_price: Money | None = None
    image_url: ImageUrl | None = None
    is_active: bool | None = None
    is_new: bool | None = None
    is_bestseller: bool | None = None
    free_delivery: bool | None = None
    stock_quantity: int | None = Field(default=None, ge=0, le=1_000_000)
    sort_order: int | None = Field(default=None, ge=0, le=100000)


class ProductPublic(BaseModel):
    id: int
    category_id: int
    name_fr: str
    name_ar: str | None = None
    slug: str
    brand: str | None = None
    goal: str | None = None
    short_description_fr: str | None = None
    short_description_ar: str | None = None
    full_description_fr: str | None = None
    full_description_ar: str | None = None
    nutrition_facts: str | None = None
    usage_fr: str | None = None
    usage_ar: str | None = None
    weight_label: str | None = None
    option_label: str | None = None
    options: list[str] = []
    price: Decimal
    compare_at_price: Decimal | None = None
    image_url: str | None = None
    is_new: bool
    is_bestseller: bool
    free_delivery: bool
    stock_status: str
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)


class ProductAdminRead(ProductPublic):
    is_active: bool
    stock_quantity: int | None = None
    sort_order: int
    updated_at: datetime


class ProductQuickUpdate(BaseModel):
    """Inline edits from the admin cards (toggle visibility, adjust stock...)."""

    is_active: bool | None = None
    stock_quantity: int | None = Field(default=None, ge=0, le=1_000_000)
    track_stock: bool | None = None
