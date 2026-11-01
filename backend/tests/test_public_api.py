from app.models import Product
from tests.conftest import order_payload


def test_catalog_hides_inactive_and_internal_fields(client, db, product):
    db.add(Product(category_id=product.category_id, name_fr="Hidden", slug="hidden", price=10, is_active=False))
    db.commit()
    res = client.get("/api/v1/products")
    assert res.status_code == 200
    body = res.json()
    assert body["total"] == 1
    item = body["items"][0]
    assert item["slug"] == "whey-isolate"
    assert "stock_quantity" not in item  # exact stock is private
    assert item["stock_status"] == "in_stock"


def test_filters_sort_and_pagination(client, db, product):
    for i in range(5):
        db.add(Product(category_id=product.category_id, name_fr=f"Item {i}", slug=f"item-{i}", price=10 + i, brand="Other"))
    db.commit()
    assert client.get("/api/v1/products?brand=acme").json()["total"] == 1
    assert client.get("/api/v1/products?on_sale=true").json()["total"] == 1
    assert client.get("/api/v1/products?goal=muscle-building").json()["total"] == 1
    res = client.get("/api/v1/products?sort=price_asc&page_size=2&page=1").json()
    assert [p["price"] for p in res["items"]] == ["10.00", "11.00"]
    assert res["pages"] == 3
    assert client.get("/api/v1/products?max_price=11").json()["total"] == 2
    assert client.get("/api/v1/products?category=whey").json()["total"] == 6


def test_search_treats_wildcards_literally(client, product):
    assert client.get("/api/v1/products?q=%25").json()["total"] == 0
    assert client.get("/api/v1/products?q=whey").json()["total"] == 1
    assert client.get("/api/v1/products?q=' OR 1=1 --").json()["total"] == 0


def test_invalid_query_params_rejected(client):
    assert client.get("/api/v1/products?goal=nope").status_code == 422
    assert client.get("/api/v1/products?sort=nope").status_code == 422
    assert client.get("/api/v1/products?page_size=1000").status_code == 422


def test_product_detail_and_related(client, product):
    assert client.get("/api/v1/products/whey-isolate").status_code == 200
    assert client.get("/api/v1/products/missing").status_code == 404
    assert client.get("/api/v1/products/whey-isolate/related").json() == []


def test_quote_uses_server_prices(client, product):
    res = client.post("/api/v1/cart/quote", json={"items": [{"product_id": product.id, "quantity": 2, "option": "vanille"}]})
    body = res.json()
    assert res.status_code == 200
    assert body["subtotal"] == "400.00"
    assert body["delivery_fee"] == "30.00"
    assert body["total"] == "430.00"
    assert body["amount_to_free_delivery"] == "100.00"
    assert body["lines"][0]["option"] == "Vanille"  # canonical casing from the DB


def test_quote_free_delivery_threshold(client, product):
    body = client.post("/api/v1/cart/quote", json={"items": [{"product_id": product.id, "quantity": 3, "option": "Vanille"}]}).json()
    assert body["delivery_fee"] == "0.00"
    assert body["free_delivery"] is True


def test_quote_flags_problems(client, product):
    res = client.post("/api/v1/cart/quote", json={"items": [{"product_id": product.id, "quantity": 2}, {"product_id": 9999, "quantity": 1}]}).json()
    issues = {line["product_id"]: line["issue"] for line in res["lines"]}
    assert issues[product.id] == "option_required"
    assert issues[9999] == "unavailable"
    assert res["all_available"] is False


def test_order_happy_path(client, db, product):
    res = client.post("/api/v1/orders", json=order_payload(product.id))
    assert res.status_code == 201, res.text
    body = res.json()
    assert body["order_total"] == "430.00"
    assert body["payment_method"] == "CASH_ON_DELIVERY"
    assert body["status"] == "NEW"
    # The confirmation must not echo personal data back.
    text = res.text
    assert "Sara" not in text and "0612345678" not in text and "+212612345678" not in text
    db.refresh(product)
    assert product.stock_quantity == 8


def test_order_ignores_client_supplied_prices(client, product):
    payload = order_payload(product.id)
    payload["items"][0]["unit_price"] = 1
    payload["order_total"] = 1
    res = client.post("/api/v1/orders", json=payload)
    assert res.status_code == 201
    assert res.json()["order_total"] == "430.00"


def test_order_requires_consent_and_valid_phone(client, product):
    assert client.post("/api/v1/orders", json=order_payload(product.id, consent=False)).status_code == 422
    assert client.post("/api/v1/orders", json=order_payload(product.id, phone_number="12345")).status_code == 422
    assert client.post("/api/v1/orders", json=order_payload(product.id, email="not-an-email")).status_code == 422


def test_order_rejects_card_payment_for_now(client, product):
    assert client.post("/api/v1/orders", json=order_payload(product.id, payment_method="CARD")).status_code == 422


def test_order_stock_and_option_rules(client, db, product):
    too_many = order_payload(product.id, items=[{"product_id": product.id, "quantity": 11, "option": "Vanille"}])
    assert client.post("/api/v1/orders", json=too_many).status_code == 400
    no_option = order_payload(product.id, items=[{"product_id": product.id, "quantity": 1}])
    assert client.post("/api/v1/orders", json=no_option).status_code == 400
    # Splitting a quantity across lines must not bypass the stock limit.
    split = order_payload(
        product.id,
        items=[
            {"product_id": product.id, "quantity": 6, "option": "Vanille"},
            {"product_id": product.id, "quantity": 6, "option": "Chocolat"},
        ],
    )
    assert client.post("/api/v1/orders", json=split).status_code == 400
    db.refresh(product)
    assert product.stock_quantity == 10


def test_order_inactive_product_rejected(client, db, product):
    product.is_active = False
    db.commit()
    assert client.post("/api/v1/orders", json=order_payload(product.id)).status_code == 400


def test_order_rate_limited(client, product):
    statuses = [client.post("/api/v1/orders", json=order_payload(product.id, items=[{"product_id": product.id, "quantity": 1, "option": "Vanille"}])).status_code for _ in range(5)]
    assert statuses[:3] == [201, 201, 201]
    assert 429 in statuses[3:]


def test_contact_form_and_honeypot(client, db):
    from app.models import ContactMessage

    ok = {"name": "Karim", "message": "Bonjour, avez-vous de la whey ?", "consent": True}
    assert client.post("/api/v1/contact", json=ok).status_code == 202
    assert db.query(ContactMessage).count() == 1
    bot = dict(ok, website="http://spam.example")
    assert client.post("/api/v1/contact", json=bot).status_code == 202
    assert db.query(ContactMessage).count() == 1  # honeypot hit: silently dropped
    assert client.post("/api/v1/contact", json=dict(ok, consent=False)).status_code == 422


def test_public_settings(client):
    body = client.get("/api/v1/site-settings/public").json()
    assert body["site_title"] == "Test Shop"
    assert body["delivery_fee"] == "30.00"
