from sqlalchemy import Column, DateTime, Integer, Numeric, String, Text
from sqlalchemy.sql import func

from app.database import Base


class SiteSettings(Base):
    __tablename__ = "site_settings"

    id = Column(Integer, primary_key=True, index=True)
    site_title = Column(String(255), nullable=False)
    tagline_fr = Column(String(255), nullable=True)
    tagline_ar = Column(String(255), nullable=True)
    logo_url = Column(String(500), nullable=True)
    hero_image_url = Column(String(500), nullable=True)
    contact_phone = Column(String(50), nullable=False)
    contact_email = Column(String(255), nullable=False)
    contact_address = Column(Text, nullable=True)
    whatsapp_number = Column(String(50), nullable=True)
    instagram_url = Column(String(500), nullable=True)
    facebook_url = Column(String(500), nullable=True)
    announcement_fr = Column(String(255), nullable=True)
    announcement_ar = Column(String(255), nullable=True)
    delivery_fee = Column(Numeric(10, 2), default=30, nullable=False)
    free_delivery_threshold = Column(Numeric(10, 2), nullable=True)
    default_language = Column(String(5), default="fr", nullable=False)
    supported_languages = Column(String(50), default="fr,ar", nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
