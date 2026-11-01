"""Static product goals ("Objectifs") shown in the storefront navigation."""

GOALS: list[dict[str, str]] = [
    {"slug": "mass-gain", "name_fr": "Prise de masse", "name_ar": "زيادة الكتلة العضلية", "icon": "dumbbell"},
    {"slug": "weight-loss", "name_fr": "Contrôle et perte de poids", "name_ar": "التحكم وإنقاص الوزن", "icon": "flame"},
    {"slug": "muscle-building", "name_fr": "Développement musculaire", "name_ar": "بناء العضلات", "icon": "bolt"},
    {"slug": "wellness", "name_fr": "Vitamines & bien-être", "name_ar": "الفيتامينات والعافية", "icon": "leaf"},
    {"slug": "healthy-food", "name_fr": "Alimentation saine", "name_ar": "التغذية الصحية", "icon": "apple"},
]

GOAL_SLUGS = {g["slug"] for g in GOALS}

SORT_OPTIONS = ("newest", "price_asc", "price_desc", "name", "popular")
