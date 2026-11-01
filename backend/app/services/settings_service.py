from decimal import Decimal

from sqlalchemy.orm import Session

from app.models.site_settings import SiteSettings


def get_settings(db: Session) -> SiteSettings:
    row = db.query(SiteSettings).first()
    if row is None:
        row = SiteSettings(
            site_title="Ma Boutique Nutrition",
            tagline_fr="Votre nutrition, sublimée.",
            tagline_ar="تغذيتك، بأعلى مستوى.",
            contact_phone="+212 600 000 000",
            contact_email="contact@example.com",
            delivery_fee=Decimal("30"),
            free_delivery_threshold=Decimal("500"),
            default_language="fr",
            supported_languages="fr,ar",
        )
        db.add(row)
        db.commit()
        db.refresh(row)
    return row
