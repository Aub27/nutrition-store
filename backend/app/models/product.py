from sqlalchemy import JSON, Boolean, Column, DateTime, ForeignKey, Integer, Numeric, String, Text
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.database import Base

LOW_STOCK_THRESHOLD = 5


class Product(Base):
    __tablename__ = "products"

    id = Column(Integer, primary_key=True, index=True)
    category_id = Column(Integer, ForeignKey("categories.id"), nullable=False, index=True)
    name_fr = Column(String(255), nullable=False)
    name_ar = Column(String(255), nullable=True)
    slug = Column(String(255), unique=True, nullable=False, index=True)
    brand = Column(String(100), nullable=True, index=True)
    goal = Column(String(50), nullable=True, index=True)
    short_description_fr = Column(Text, nullable=True)
    short_description_ar = Column(Text, nullable=True)
    full_description_fr = Column(Text, nullable=True)
    full_description_ar = Column(Text, nullable=True)
    nutrition_facts = Column(Text, nullable=True)
    usage_fr = Column(Text, nullable=True)
    usage_ar = Column(Text, nullable=True)
    weight_label = Column(String(50), nullable=True)
    option_label = Column(String(50), nullable=True)
    options = Column(JSON, nullable=False, default=list)
    price = Column(Numeric(10, 2), nullable=False)
    compare_at_price = Column(Numeric(10, 2), nullable=True)
    image_url = Column(String(500), nullable=True)
    is_active = Column(Boolean, default=True, nullable=False)
    is_new = Column(Boolean, default=False, nullable=False)
    is_bestseller = Column(Boolean, default=False, nullable=False)
    free_delivery = Column(Boolean, default=False, nullable=False)
    # NULL means "stock not tracked" (always available).
    stock_quantity = Column(Integer, nullable=True)
    sort_order = Column(Integer, default=0, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    category = relationship("Category", back_populates="products")

    @property
    def stock_status(self) -> str:
        if self.stock_quantity is None:
            return "in_stock"
        if self.stock_quantity <= 0:
            return "out_of_stock"
        if self.stock_quantity <= LOW_STOCK_THRESHOLD:
            return "low_stock"
        return "in_stock"
