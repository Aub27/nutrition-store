from sqlalchemy import Column, DateTime, ForeignKey, Integer, Numeric, String, Text
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.database import Base

ORDER_STATUSES = ("NEW", "CONFIRMED", "WAITING_DELIVERY", "DELIVERED", "CANCELLED")
# Card payment can be added later: append "CARD" here and implement a payment-provider flow.
PAYMENT_METHODS = ("CASH_ON_DELIVERY",)


class Order(Base):
    __tablename__ = "orders"

    id = Column(Integer, primary_key=True, index=True)
    order_number = Column(String(50), unique=True, nullable=False, index=True)
    customer_name = Column(String(255), nullable=False)
    phone_number = Column(String(50), nullable=False)
    email = Column(String(255), nullable=True)
    address_line_1 = Column(String(500), nullable=False)
    address_line_2 = Column(String(500), nullable=True)
    city = Column(String(255), nullable=False)
    postal_code = Column(String(20), nullable=True)
    country = Column(String(100), default="Morocco", nullable=False)
    payment_method = Column(String(50), default="CASH_ON_DELIVERY", nullable=False)
    status = Column(String(50), default="NEW", nullable=False, index=True)
    subtotal = Column(Numeric(10, 2), nullable=False)
    delivery_fee = Column(Numeric(10, 2), default=0, nullable=False)
    order_total = Column(Numeric(10, 2), nullable=False)
    customer_note = Column(Text, nullable=True)
    admin_note = Column(Text, nullable=True)
    consent_at = Column(DateTime(timezone=True), nullable=True)
    confirmed_at = Column(DateTime(timezone=True), nullable=True)
    delivered_at = Column(DateTime(timezone=True), nullable=True)
    cancelled_at = Column(DateTime(timezone=True), nullable=True)
    anonymized_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False, index=True)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    items = relationship("OrderItem", back_populates="order", cascade="all, delete-orphan")


class OrderItem(Base):
    __tablename__ = "order_items"

    id = Column(Integer, primary_key=True, index=True)
    order_id = Column(Integer, ForeignKey("orders.id", ondelete="CASCADE"), nullable=False, index=True)
    product_id = Column(Integer, ForeignKey("products.id", ondelete="SET NULL"), nullable=True, index=True)
    product_name_snapshot = Column(String(255), nullable=False)
    option_label = Column(String(100), nullable=True)
    image_url_snapshot = Column(String(500), nullable=True)
    unit_price_snapshot = Column(Numeric(10, 2), nullable=False)
    quantity = Column(Integer, nullable=False)
    line_total = Column(Numeric(10, 2), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    order = relationship("Order", back_populates="items")
