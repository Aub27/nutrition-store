import os
import tempfile

# Must be set before the app is imported.
os.environ["ENVIRONMENT"] = "test"
os.environ["SECRET_KEY"] = "test-secret-key-that-is-long-enough-1234567890"
os.environ["UPLOAD_DIR"] = tempfile.mkdtemp(prefix="ns-uploads-")
os.environ["CORS_ORIGINS"] = "http://localhost:4200"

from decimal import Decimal  # noqa: E402

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402
from sqlalchemy import create_engine  # noqa: E402
from sqlalchemy.orm import sessionmaker  # noqa: E402
from sqlalchemy.pool import StaticPool  # noqa: E402

from app.core.rate_limit import limiter  # noqa: E402
from app.core.security import hash_password  # noqa: E402
from app.database import Base  # noqa: E402
from app.dependencies import get_db  # noqa: E402
from app.main import app  # noqa: E402
from app.models import AdminUser, Category, Product, SiteSettings  # noqa: E402

ADMIN_EMAIL = "admin@test.com"
ADMIN_PASSWORD = "Str0ng!Passw0rd#"


@pytest.fixture()
def db():
    engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    Base.metadata.create_all(bind=engine)
    session = sessionmaker(bind=engine, autocommit=False, autoflush=False)()
    session.add(
        SiteSettings(
            site_title="Test Shop",
            contact_phone="+212600000000",
            contact_email="shop@test.com",
            delivery_fee=Decimal("30"),
            free_delivery_threshold=Decimal("500"),
        )
    )
    session.commit()
    try:
        yield session
    finally:
        session.close()
        engine.dispose()


@pytest.fixture()
def client(db):
    def override():
        yield db

    app.dependency_overrides[get_db] = override
    limiter.reset()
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()
    limiter.reset()


@pytest.fixture()
def category(db):
    c = Category(name_fr="Whey", slug="whey", sort_order=1)
    db.add(c)
    db.commit()
    return c


@pytest.fixture()
def product(db, category):
    p = Product(
        category_id=category.id,
        name_fr="Whey Isolate",
        slug="whey-isolate",
        brand="Acme",
        goal="muscle-building",
        price=Decimal("200.00"),
        compare_at_price=Decimal("250.00"),
        stock_quantity=10,
        options=["Vanille", "Chocolat"],
        option_label="Saveur",
    )
    db.add(p)
    db.commit()
    return p


@pytest.fixture()
def admin(db):
    a = AdminUser(full_name="Test Admin", email=ADMIN_EMAIL, password_hash=hash_password(ADMIN_PASSWORD))
    db.add(a)
    db.commit()
    return a


@pytest.fixture()
def admin_client(client, admin):
    """Logged-in client; sends the CSRF header automatically."""
    res = client.post("/api/v1/admin/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
    assert res.status_code == 200, res.text
    client.headers.update({"X-CSRF-Token": res.json()["csrf_token"]})
    return client


def order_payload(product_id: int, **overrides):
    payload = {
        "customer_name": "Sara Benali",
        "phone_number": "06 12 34 56 78",
        "email": "sara@example.com",
        "address_line_1": "12 rue des Lilas, Maarif",
        "city": "Casablanca",
        "consent": True,
        "items": [{"product_id": product_id, "quantity": 2, "option": "Vanille"}],
    }
    payload.update(overrides)
    return payload
