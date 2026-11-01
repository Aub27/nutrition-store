"""Seed the base catalogue structure and site settings (idempotent, safe to re-run).

Usage (from backend/):
    python scripts/seed.py          # categories + site settings
    python scripts/seed.py --demo   # also adds clearly-labelled DEMO products (dev only)
"""
import argparse
import sys
from decimal import Decimal
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.config import settings  # noqa: E402
from app.core.text import slugify  # noqa: E402
from app.database import Base, SessionLocal, engine  # noqa: E402
from app.models import Category, Product, SiteSettings  # noqa: E402

CATEGORIES = [
    ("Whey protéine", "whey-proteine", "بروتين الواي"),
    ("Mass gainers", "mass-gainers", "مكملات زيادة الوزن"),
    ("Créatine", "creatine", "الكرياتين"),
    ("Acides aminés (BCAA/EAA)", "acides-amines", "الأحماض الأمينية"),
    ("Pré-workout & énergie", "pre-workout", "ما قبل التمرين"),
    ("Perte de poids", "perte-de-poids", "إنقاص الوزن"),
    ("Vitamines & minéraux", "vitamines-mineraux", "الفيتامينات والمعادن"),
    ("Barres & snacks protéinés", "barres-snacks", "ألواح ووجبات خفيفة"),
    ("Alimentation saine", "alimentation-saine", "التغذية الصحية"),
    ("Packs", "packs", "عروض مجمّعة"),
    ("Accessoires (shakers, bouteilles)", "accessoires", "إكسسوارات"),
    # ── Intentionally disabled for now (kept for a later phase) ─────────────
    # ("Vêtements & accessoires de sport", "vetements", "ملابس رياضية"),
    # ("Espace femme", "femme", "قسم النساء"),
]

DEMO_PRODUCTS = [
    # (name, category slug, goal, price, compare_at, brand, new, best, free_delivery, stock, options)
    ("DEMO Whey Isolate 2 kg", "whey-proteine", "muscle-building", "549.00", "649.00", "Demo Labs", True, True, True, 25, ["Vanille", "Chocolat", "Fraise"]),
    ("DEMO Whey Concentrate 900 g", "whey-proteine", "muscle-building", "329.00", None, "Demo Labs", False, True, False, 40, ["Vanille", "Chocolat"]),
    ("DEMO Mass Gainer 3 kg", "mass-gainers", "mass-gain", "399.00", "459.00", "Demo Labs", False, True, True, 18, ["Chocolat", "Banane"]),
    ("DEMO Créatine Monohydrate 300 g", "creatine", "muscle-building", "249.00", None, "Pure Demo", True, False, False, 60, []),
    ("DEMO BCAA 2:1:1 400 g", "acides-amines", "muscle-building", "219.00", "249.00", "Pure Demo", False, False, False, 3, ["Citron", "Pastèque"]),
    ("DEMO Pré-workout Ignite", "pre-workout", "muscle-building", "289.00", None, "Pure Demo", True, False, False, 12, ["Fruits rouges"]),
    ("DEMO Brûleur Thermo", "perte-de-poids", "weight-loss", "259.00", "299.00", "Slim Demo", False, True, False, 22, []),
    ("DEMO Multivitamines Quotidien", "vitamines-mineraux", "wellness", "149.00", None, "Slim Demo", False, False, False, 80, []),
    ("DEMO Oméga-3 120 capsules", "vitamines-mineraux", "wellness", "179.00", None, "Slim Demo", True, False, True, 0, []),
    ("DEMO Barre protéinée (x12)", "barres-snacks", "healthy-food", "199.00", "229.00", "Snack Demo", True, True, False, 35, ["Cookie", "Caramel", "Noisette"]),
    ("DEMO Beurre de cacahuète 500 g", "alimentation-saine", "healthy-food", "79.00", None, "Snack Demo", False, False, False, 50, []),
    ("DEMO Pack Performance", "packs", "muscle-building", "699.00", "849.00", "Demo Labs", True, True, True, 10, []),
    ("DEMO Shaker 700 ml", "accessoires", None, "49.00", None, "Demo Gear", False, False, False, None, []),
]


def seed(demo: bool) -> None:
    if settings.database_url.startswith("sqlite"):
        Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        if not db.query(SiteSettings).first():
            db.add(
                SiteSettings(
                    site_title="Warmode Nutrition",
                    tagline_fr="Votre nutrition, sublimée.",
                    tagline_ar="تغذيتك، بأعلى مستوى.",
                    contact_phone="+212 600 000 000",
                    contact_email="contact@example.com",
                    contact_address="Casablanca, Maroc",
                    whatsapp_number="+212600000000",
                    announcement_fr="Livraison offerte dès 500 DH • Paiement à la livraison",
                    announcement_ar="توصيل مجاني ابتداءً من 500 درهم • الدفع عند الاستلام",
                    delivery_fee=Decimal("30"),
                    free_delivery_threshold=Decimal("500"),
                )
            )
            print("Created default site settings (edit them in the admin panel).")

        by_slug = {c.slug: c for c in db.query(Category).all()}
        for order, (name, slug, name_ar) in enumerate(CATEGORIES):
            if slug not in by_slug:
                category = Category(name_fr=name, name_ar=name_ar, slug=slug, sort_order=order)
                db.add(category)
                by_slug[slug] = category
        db.flush()

        if demo:
            if settings.is_production:
                raise SystemExit("Refusing to add demo data in production.")
            for i, (name, cat, goal, price, compare, brand, new, best, free, stock, options) in enumerate(DEMO_PRODUCTS):
                slug = slugify(name)
                if db.query(Product).filter(Product.slug == slug).first():
                    continue
                db.add(
                    Product(
                        category_id=by_slug[cat].id,
                        name_fr=name,
                        slug=slug,
                        brand=brand,
                        goal=goal,
                        short_description_fr="Produit de démonstration pour tester la boutique.",
                        full_description_fr="Ce produit est un exemple. Remplacez-le par vos vrais produits depuis l'espace admin.",
                        nutrition_facts="Pour 30 g : 120 kcal · Protéines 24 g · Glucides 2 g · Lipides 1,5 g",
                        usage_fr="Mélanger une dose dans 250 ml d'eau ou de lait. 1 à 2 fois par jour.",
                        weight_label=None,
                        option_label="Saveur" if options else None,
                        options=options,
                        price=Decimal(price),
                        compare_at_price=Decimal(compare) if compare else None,
                        is_new=new,
                        is_bestseller=best,
                        free_delivery=free,
                        stock_quantity=stock,
                        sort_order=i,
                    )
                )
            print("Added demo products (names start with 'DEMO').")
        db.commit()
        print("Seed complete.")
    finally:
        db.close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--demo", action="store_true", help="Add demo products (development only)")
    seed(parser.parse_args().demo)
