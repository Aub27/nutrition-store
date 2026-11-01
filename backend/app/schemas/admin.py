from datetime import datetime
from decimal import Decimal
from typing import Annotated

from pydantic import AfterValidator, BaseModel, ConfigDict, EmailStr, Field

from app.schemas.common import ImageUrl, ShortText

Money = Annotated[Decimal, Field(ge=0, le=Decimal("100000"), max_digits=10, decimal_places=2)]


def _https_or_none(v: str) -> str:
    v = v.strip()
    if v and not v.startswith("https://"):
        raise ValueError("Le lien doit commencer par https://")
    return v


HttpsUrl = Annotated[str, Field(max_length=500), AfterValidator(_https_or_none)]


class SiteSettingsPublic(BaseModel):
    site_title: str
    tagline_fr: str | None = None
    tagline_ar: str | None = None
    logo_url: str | None = None
    contact_phone: str
    contact_email: str
    contact_address: str | None = None
    whatsapp_number: str | None = None
    instagram_url: str | None = None
    facebook_url: str | None = None
    announcement_fr: str | None = None
    announcement_ar: str | None = None
    delivery_fee: Decimal
    free_delivery_threshold: Decimal | None = None
    default_language: str
    supported_languages: str
    model_config = ConfigDict(from_attributes=True)


class SiteSettingsUpdate(BaseModel):
    site_title: ShortText | None = Field(default=None, min_length=2, max_length=80)
    tagline_fr: ShortText | None = None
    tagline_ar: ShortText | None = None
    logo_url: ImageUrl | None = None
    contact_phone: ShortText | None = Field(default=None, max_length=50)
    contact_email: EmailStr | None = None
    contact_address: ShortText | None = None
    whatsapp_number: ShortText | None = Field(default=None, max_length=50)
    instagram_url: HttpsUrl | None = None
    facebook_url: HttpsUrl | None = None
    announcement_fr: ShortText | None = None
    announcement_ar: ShortText | None = None
    delivery_fee: Money | None = None
    free_delivery_threshold: Money | None = None
    default_language: str | None = Field(default=None, pattern=r"^(fr|ar)$")


class ContactCreate(BaseModel):
    name: ShortText = Field(min_length=2, max_length=100)
    email: EmailStr | None = None
    phone: ShortText | None = Field(default=None, max_length=30)
    subject: ShortText | None = Field(default=None, max_length=150)
    message: Annotated[str, Field(min_length=10, max_length=2000)]
    consent: bool
    # Honeypot: real users never see or fill this field, bots do.
    website: str | None = Field(default=None, max_length=200)


class ContactRead(BaseModel):
    id: int
    name: str
    email: str | None = None
    phone: str | None = None
    subject: str | None = None
    message: str
    is_read: bool
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)


class MarkRead(BaseModel):
    is_read: bool = True


class NotificationRead(BaseModel):
    id: int
    type: str
    order_id: int | None = None
    title: str
    message: str
    is_read: bool
    created_at: datetime
    read_at: datetime | None = None
    model_config = ConfigDict(from_attributes=True)


class AuditLogRead(BaseModel):
    id: int
    admin_email: str | None = None
    action: str
    entity_type: str | None = None
    entity_id: str | None = None
    detail: str | None = None
    ip_address: str | None = None
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)


class UploadResult(BaseModel):
    url: str


class SalesPoint(BaseModel):
    date: str
    orders: int
    revenue: Decimal


class TopProduct(BaseModel):
    name: str
    quantity: int
    revenue: Decimal


class LowStockProduct(BaseModel):
    id: int
    name_fr: str
    image_url: str | None = None
    stock_quantity: int


class DashboardStats(BaseModel):
    total_orders: int
    orders_today: int
    by_status: dict[str, int]
    revenue_total: Decimal
    revenue_month: Decimal
    average_basket: Decimal
    sales_last_14_days: list[SalesPoint]
    top_products: list[TopProduct]
    low_stock: list[LowStockProduct]
    unread_notifications: int
    unread_messages: int
    active_products: int
