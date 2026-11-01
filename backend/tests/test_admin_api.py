import io

import pytest
from PIL import Image

from app.core.security import create_session_token
from tests.conftest import ADMIN_EMAIL, ADMIN_PASSWORD, order_payload

LOGIN = "/api/v1/admin/auth/login"


def _png_bytes(size=(40, 30), fmt="PNG"):
    buf = io.BytesIO()
    Image.new("RGB", size, (120, 60, 200)).save(buf, format=fmt)
    return buf.getvalue()


# ── Authentication ────────────────────────────────────────────────────────


def test_admin_routes_require_auth(client):
    for path in ("/orders", "/products", "/categories", "/dashboard/stats", "/notifications", "/messages", "/settings", "/audit-logs"):
        assert client.get(f"/api/v1/admin{path}").status_code == 401, path


def test_login_sets_httponly_cookie_and_no_token_in_body(client, admin):
    res = client.post(LOGIN, json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
    assert res.status_code == 200
    assert "access_token" not in res.json()
    cookie = res.headers["set-cookie"].lower()
    assert "httponly" in cookie and "samesite=strict" in cookie


def test_login_failure_is_generic(client, admin):
    wrong_pw = client.post(LOGIN, json={"email": ADMIN_EMAIL, "password": "nope"})
    unknown = client.post(LOGIN, json={"email": "ghost@test.com", "password": "nope"})
    assert wrong_pw.status_code == unknown.status_code == 401
    assert wrong_pw.json() == unknown.json()


def test_login_brute_force_lockout(client, admin):
    for _ in range(5):
        assert client.post(LOGIN, json={"email": ADMIN_EMAIL, "password": "bad"}).status_code == 401
    locked = client.post(LOGIN, json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
    assert locked.status_code == 429
    assert "retry-after" in locked.headers


def test_session_restore_and_logout(admin_client):
    me = admin_client.get("/api/v1/admin/auth/me")
    assert me.status_code == 200 and me.json()["email"] == ADMIN_EMAIL
    assert admin_client.post("/api/v1/admin/auth/logout").status_code == 204
    admin_client.cookies.clear()
    assert admin_client.get("/api/v1/admin/auth/me").status_code == 401


def test_tampered_or_foreign_token_rejected(client, admin):
    client.cookies.set("ns_admin_session", "not.a.jwt")
    assert client.get("/api/v1/admin/orders").status_code == 401
    # Valid structure but signed with another key
    import jwt

    forged = jwt.encode({"sub": "1", "tv": 0, "csrf": "x", "exp": 9999999999}, "other-key-other-key-other-key-123456", algorithm="HS256")
    client.cookies.set("ns_admin_session", forged)
    assert client.get("/api/v1/admin/orders").status_code == 401


def test_inactive_admin_session_rejected(admin_client, db, admin):
    admin.is_active = False
    db.commit()
    assert admin_client.get("/api/v1/admin/orders").status_code == 401


def test_logout_all_invalidates_existing_sessions(admin_client, admin, db):
    old_cookie = admin_client.cookies.get("ns_admin_session")
    assert admin_client.post("/api/v1/admin/auth/logout-all").status_code == 204
    admin_client.cookies.set("ns_admin_session", old_cookie)
    assert admin_client.get("/api/v1/admin/orders").status_code == 401


def test_change_password_enforces_policy(admin_client):
    weak = admin_client.post("/api/v1/admin/auth/change-password", json={"current_password": ADMIN_PASSWORD, "new_password": "short"})
    assert weak.status_code == 422
    wrong = admin_client.post("/api/v1/admin/auth/change-password", json={"current_password": "bad", "new_password": "An0ther!Strong#Pass"})
    assert wrong.status_code == 400
    ok = admin_client.post("/api/v1/admin/auth/change-password", json={"current_password": ADMIN_PASSWORD, "new_password": "An0ther!Strong#Pass"})
    assert ok.status_code == 204


# ── CSRF / origin ─────────────────────────────────────────────────────────


def test_csrf_required_for_mutations(admin_client, category):
    token = admin_client.headers.pop("X-CSRF-Token")
    payload = {"name_fr": "Nouvelle"}
    assert admin_client.post("/api/v1/admin/categories", json=payload).status_code == 403
    assert admin_client.post("/api/v1/admin/categories", json=payload, headers={"X-CSRF-Token": "wrong"}).status_code == 403
    assert admin_client.post("/api/v1/admin/categories", json=payload, headers={"X-CSRF-Token": token}).status_code == 201


def test_foreign_origin_rejected(admin_client):
    res = admin_client.post("/api/v1/admin/categories", json={"name_fr": "X cat"}, headers={"Origin": "https://evil.example"})
    assert res.status_code == 403


def test_cors_does_not_allow_foreign_origin(client):
    res = client.options(
        "/api/v1/products",
        headers={"Origin": "https://evil.example", "Access-Control-Request-Method": "GET"},
    )
    assert "access-control-allow-origin" not in res.headers


# ── Security headers ──────────────────────────────────────────────────────


def test_security_headers_present(client):
    res = client.get("/health")
    assert res.headers["x-content-type-options"] == "nosniff"
    assert res.headers["x-frame-options"] == "DENY"
    assert "frame-ancestors 'none'" in res.headers["content-security-policy"]


def test_admin_responses_not_cacheable(admin_client):
    assert admin_client.get("/api/v1/admin/orders").headers["cache-control"] == "no-store"


def test_host_header_allow_list(client):
    assert client.get("/health", headers={"Host": "evil.example"}).status_code == 400


def test_oversized_body_rejected(client):
    res = client.post("/api/v1/contact", content=b"x" * (300 * 1024), headers={"Content-Type": "application/json"})
    assert res.status_code == 413


# ── Catalogue management ──────────────────────────────────────────────────


def test_category_crud_and_reorder(admin_client):
    a = admin_client.post("/api/v1/admin/categories", json={"name_fr": "Créatine"}).json()
    b = admin_client.post("/api/v1/admin/categories", json={"name_fr": "Whey"}).json()
    assert a["slug"] == "creatine"
    assert admin_client.post("/api/v1/admin/categories", json={"name_fr": "Dup", "slug": "creatine"}).status_code == 400
    assert admin_client.put("/api/v1/admin/categories/reorder", json={"ids": [b["id"], a["id"]]}).status_code == 204
    names = [c["name_fr"] for c in admin_client.get("/api/v1/admin/categories").json()]
    assert names == ["Whey", "Créatine"]
    assert admin_client.delete(f"/api/v1/admin/categories/{a['id']}").status_code == 204


def test_product_crud_validation(admin_client, category):
    base = {"category_id": category.id, "name_fr": "Pré-workout", "price": "199.90"}
    res = admin_client.post("/api/v1/admin/products", json=base)
    assert res.status_code == 201
    created = res.json()
    assert created["slug"] == "pre-workout"
    again = admin_client.post("/api/v1/admin/products", json=base).json()
    assert again["slug"] == "pre-workout-2"  # unique slug generated

    assert admin_client.post("/api/v1/admin/products", json=dict(base, price="-5")).status_code == 422
    assert admin_client.post("/api/v1/admin/products", json=dict(base, goal="bogus")).status_code == 422
    assert admin_client.post("/api/v1/admin/products", json=dict(base, category_id=999)).status_code == 400
    assert admin_client.post("/api/v1/admin/products", json=dict(base, image_url="javascript:alert(1)")).status_code == 422
    assert admin_client.post("/api/v1/admin/products", json=dict(base, image_url="http://insecure.example/a.png")).status_code == 422
    ok_img = admin_client.post("/api/v1/admin/products", json=dict(base, name_fr="Avec image", image_url="/media/abc.webp"))
    assert ok_img.status_code == 201
    promo = admin_client.post("/api/v1/admin/products", json=dict(base, name_fr="Promo", compare_at_price="100")).json()
    assert promo["compare_at_price"] is None  # compare-at must exceed price

    upd = admin_client.put(f"/api/v1/admin/products/{created['id']}", json={"price": "150", "compare_at_price": "199"})
    assert upd.status_code == 200 and upd.json()["compare_at_price"] == "199.00"


def test_product_quick_update_stock_and_visibility(admin_client, product):
    r = admin_client.patch(f"/api/v1/admin/products/{product.id}", json={"stock_quantity": 0, "is_active": False})
    body = r.json()
    assert body["stock_quantity"] == 0 and body["is_active"] is False and body["stock_status"] == "out_of_stock"
    r = admin_client.patch(f"/api/v1/admin/products/{product.id}", json={"track_stock": False})
    assert r.json()["stock_quantity"] is None


def test_cannot_delete_product_with_orders(admin_client, client, product):
    client.post("/api/v1/orders", json=order_payload(product.id))
    res = admin_client.delete(f"/api/v1/admin/products/{product.id}")
    assert res.status_code == 409


def test_mass_assignment_ignored(admin_client, category):
    res = admin_client.post(
        "/api/v1/admin/products",
        json={"category_id": category.id, "name_fr": "Safe", "price": "10", "id": 999, "created_at": "2000-01-01T00:00:00"},
    )
    assert res.status_code == 201 and res.json()["id"] != 999


# ── Orders ────────────────────────────────────────────────────────────────


def _place(client, product, qty=1):
    res = client.post("/api/v1/orders", json=order_payload(product.id, items=[{"product_id": product.id, "quantity": qty, "option": "Vanille"}]))
    assert res.status_code == 201, res.text
    return res.json()["order_number"]


def test_order_lifecycle_and_stock_restore(admin_client, client, db, product):
    _place(client, product, qty=2)
    order = admin_client.get("/api/v1/admin/orders").json()[0]
    assert order["customer_name"] == "Sara Benali" and order["phone_number"] == "+212612345678"
    oid = order["id"]

    def move(status):
        return admin_client.patch(f"/api/v1/admin/orders/{oid}/status", json={"status": status})

    assert move("DELIVERED").status_code == 400  # cannot skip steps
    assert move("CONFIRMED").json()["confirmed_at"]
    assert move("CANCELLED").status_code == 200
    db.refresh(product)
    assert product.stock_quantity == 10  # reserved stock returned
    assert move("CONFIRMED").status_code == 400  # terminal state


def test_anonymize_only_finished_orders(admin_client, client, product):
    _place(client, product)
    oid = admin_client.get("/api/v1/admin/orders").json()[0]["id"]
    assert admin_client.post(f"/api/v1/admin/orders/{oid}/anonymize").status_code == 400
    for s in ("CONFIRMED", "WAITING_DELIVERY", "DELIVERED"):
        admin_client.patch(f"/api/v1/admin/orders/{oid}/status", json={"status": s})
    done = admin_client.post(f"/api/v1/admin/orders/{oid}/anonymize").json()
    assert done["customer_name"] == "Client anonymisé" and done["email"] is None and done["anonymized_at"]


def test_order_search_filter_and_invalid_status(admin_client, client, product):
    _place(client, product)
    assert len(admin_client.get("/api/v1/admin/orders?q=sara").json()) == 1
    assert len(admin_client.get("/api/v1/admin/orders?q=nobody").json()) == 0
    assert len(admin_client.get("/api/v1/admin/orders?status=NEW").json()) == 1
    assert admin_client.get("/api/v1/admin/orders?status=HACKED").status_code == 422


def test_dashboard_and_notifications(admin_client, client, product):
    _place(client, product, qty=2)
    stats = admin_client.get("/api/v1/admin/dashboard/stats").json()
    assert stats["total_orders"] == 1 and stats["by_status"]["NEW"] == 1
    assert stats["revenue_total"] == "430.00"
    assert len(stats["sales_last_14_days"]) == 14
    assert stats["top_products"][0]["quantity"] == 2
    notifs = admin_client.get("/api/v1/admin/notifications").json()
    assert notifs[0]["type"] == "NEW_ORDER" and notifs[0]["is_read"] is False
    assert admin_client.post("/api/v1/admin/notifications/read-all").status_code == 204
    assert admin_client.get("/api/v1/admin/notifications?is_read=false").json() == []


def test_audit_log_records_actions(admin_client, category):
    admin_client.post("/api/v1/admin/products", json={"category_id": category.id, "name_fr": "Audit me", "price": "5"})
    actions = [a["action"] for a in admin_client.get("/api/v1/admin/audit-logs").json()]
    assert "product_created" in actions and "login" in actions


# ── Settings / uploads ────────────────────────────────────────────────────


def test_settings_update_validation(admin_client):
    ok = admin_client.put("/api/v1/admin/settings", json={"site_title": "Nova", "delivery_fee": "25", "instagram_url": "https://instagram.com/nova"})
    assert ok.status_code == 200 and ok.json()["site_title"] == "Nova"
    assert admin_client.put("/api/v1/admin/settings", json={"instagram_url": "javascript:alert(1)"}).status_code == 422
    assert admin_client.put("/api/v1/admin/settings", json={"delivery_fee": "-1"}).status_code == 422


def test_upload_reencodes_and_strips(admin_client):
    res = admin_client.post("/api/v1/admin/uploads", files={"file": ("../../evil.png", _png_bytes(), "image/png")})
    assert res.status_code == 201
    url = res.json()["url"]
    assert url.startswith("/media/") and url.endswith(".webp") and "evil" not in url
    served = admin_client.get(url)
    assert served.status_code == 200 and served.content[:4] == b"RIFF"


@pytest.mark.parametrize(
    "name,content",
    [
        ("shell.php", b"<?php system($_GET['c']); ?>"),
        ("fake.png", b"<script>alert(1)</script>"),
        ("empty.png", b""),
        ("poly.svg", b'<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>'),
    ],
)
def test_upload_rejects_non_images(admin_client, name, content):
    assert admin_client.post("/api/v1/admin/uploads", files={"file": (name, content, "image/png")}).status_code in (400, 415)


def test_upload_requires_auth_and_csrf(client, admin_client):
    admin_client.headers.pop("X-CSRF-Token")
    res = admin_client.post("/api/v1/admin/uploads", files={"file": ("a.png", _png_bytes(), "image/png")})
    assert res.status_code == 403
    client.cookies.clear()
    assert client.post("/api/v1/admin/uploads", files={"file": ("a.png", _png_bytes(), "image/png")}).status_code == 401


def test_session_token_helper_roundtrip():
    from app.core.security import decode_session_token

    token = create_session_token(1, 0, "csrf-value")
    assert decode_session_token(token)["csrf"] == "csrf-value"
    assert decode_session_token(token + "x") is None
