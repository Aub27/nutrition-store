from datetime import datetime
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator, model_validator

from app.schemas.common import LongText, Phone, ShortText


class CartLine(BaseModel):
    product_id: int = Field(gt=0)
    quantity: int = Field(ge=1, le=100)
    option: ShortText | None = Field(default=None, max_length=100)


class QuoteRequest(BaseModel):
    items: list[CartLine] = Field(min_length=1, max_length=50)


class QuoteLine(BaseModel):
    product_id: int
    slug: str | None = None
    name_fr: str
    name_ar: str | None = None
    image_url: str | None = None
    option: str | None = None
    unit_price: Decimal
    compare_at_price: Decimal | None = None
    quantity: int
    line_total: Decimal
    available: bool
    max_quantity: int | None = None
    issue: str | None = None


class Quote(BaseModel):
    lines: list[QuoteLine]
    subtotal: Decimal
    delivery_fee: Decimal
    total: Decimal
    free_delivery: bool
    free_delivery_threshold: Decimal | None = None
    amount_to_free_delivery: Decimal | None = None
    all_available: bool


class OrderCreate(BaseModel):
    customer_name: ShortText = Field(min_length=2, max_length=100)
    phone_number: Phone
    email: EmailStr | None = None
    address_line_1: ShortText = Field(min_length=5, max_length=300)
    address_line_2: ShortText | None = Field(default=None, max_length=300)
    city: ShortText = Field(min_length=2, max_length=100)
    postal_code: ShortText | None = Field(default=None, max_length=20)
    customer_note: LongText | None = Field(default=None, max_length=500)
    # Cash on delivery is the only method for now. To add cards later, widen this Literal
    # (e.g. Literal["CASH_ON_DELIVERY", "CARD"]) and branch in order_service.create_order.
    payment_method: Literal["CASH_ON_DELIVERY"] = "CASH_ON_DELIVERY"
    consent: bool
    items: list[CartLine] = Field(min_length=1, max_length=50)

    @field_validator("email", mode="before")
    @classmethod
    def _blank_email(cls, v):
        return None if isinstance(v, str) and not v.strip() else v

    @model_validator(mode="after")
    def _require_consent(self):
        if not self.consent:
            raise ValueError("Vous devez accepter la politique de confidentialité pour commander.")
        return self


class OrderItemRead(BaseModel):
    id: int
    product_id: int | None = None
    product_name_snapshot: str
    option_label: str | None = None
    image_url_snapshot: str | None = None
    unit_price_snapshot: Decimal
    quantity: int
    line_total: Decimal
    model_config = ConfigDict(from_attributes=True)


class OrderConfirmation(BaseModel):
    """What the customer gets back — deliberately contains no personal data."""

    order_number: str
    status: str
    payment_method: str
    subtotal: Decimal
    delivery_fee: Decimal
    order_total: Decimal
    created_at: datetime
    items: list[OrderItemRead] = []
    model_config = ConfigDict(from_attributes=True)


class OrderRead(BaseModel):
    id: int
    order_number: str
    customer_name: str
    phone_number: str
    email: str | None = None
    address_line_1: str
    address_line_2: str | None = None
    city: str
    postal_code: str | None = None
    country: str
    payment_method: str
    status: str
    subtotal: Decimal
    delivery_fee: Decimal
    order_total: Decimal
    customer_note: str | None = None
    admin_note: str | None = None
    confirmed_at: datetime | None = None
    delivered_at: datetime | None = None
    cancelled_at: datetime | None = None
    anonymized_at: datetime | None = None
    created_at: datetime
    updated_at: datetime
    items: list[OrderItemRead] = []
    model_config = ConfigDict(from_attributes=True)


class OrderStatusUpdate(BaseModel):
    status: Literal["CONFIRMED", "WAITING_DELIVERY", "DELIVERED", "CANCELLED"]


class OrderNoteUpdate(BaseModel):
    admin_note: LongText | None = Field(default=None, max_length=1000)
