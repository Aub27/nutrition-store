from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, model_validator

from app.core.text import slugify
from app.schemas.common import ImageUrl, LongText, ShortText

_SLUG = r"^[a-z0-9]+(?:-[a-z0-9]+)*$"


class CategoryBase(BaseModel):
    name_fr: ShortText = Field(min_length=2)
    name_ar: ShortText | None = None
    slug: str | None = Field(default=None, pattern=_SLUG, max_length=120)
    description_fr: LongText | None = None
    description_ar: LongText | None = None
    image_url: ImageUrl | None = None
    sort_order: int = Field(default=0, ge=0, le=10000)
    is_active: bool = True


class CategoryCreate(CategoryBase):
    @model_validator(mode="after")
    def auto_slug(self):
        if not self.slug:
            self.slug = slugify(self.name_fr)
        if not self.slug:
            raise ValueError("Impossible de générer un identifiant (slug) à partir du nom.")
        return self


class CategoryUpdate(BaseModel):
    name_fr: ShortText | None = Field(default=None, min_length=2)
    name_ar: ShortText | None = None
    slug: str | None = Field(default=None, pattern=_SLUG, max_length=120)
    description_fr: LongText | None = None
    description_ar: LongText | None = None
    image_url: ImageUrl | None = None
    sort_order: int | None = Field(default=None, ge=0, le=10000)
    is_active: bool | None = None


class CategoryReorder(BaseModel):
    ids: list[int] = Field(min_length=1, max_length=500)


class CategoryRead(CategoryBase):
    id: int
    created_at: datetime
    updated_at: datetime
    model_config = ConfigDict(from_attributes=True)


class CategoryAdminRead(CategoryRead):
    product_count: int = 0
