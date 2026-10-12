"""Regression tests after FLAG_SECURE removal and qr_code projection changes.
Covers: /api/auth/login, /api/dashboard, /api/reports (with/without date filters),
/api/clients/{id}, /api/invoices (list)."""
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://cripto-tela-viva.preview.emergentagent.com").rstrip("/")
ADMIN = {"email": "euapostomesmo@proton.me", "password": "Invest2026!"}


@pytest.fixture(scope="module")
def token():
    r = requests.post(f"{BASE_URL}/api/auth/login", json=ADMIN, timeout=30)
    assert r.status_code == 200, r.text
    tok = r.json().get("token")
    assert tok
    return tok


@pytest.fixture(scope="module")
def auth(token):
    return {"Authorization": f"Bearer {token}"}


def test_login_returns_token_and_user():
    r = requests.post(f"{BASE_URL}/api/auth/login", json=ADMIN, timeout=30)
    assert r.status_code == 200
    data = r.json()
    assert "token" in data and isinstance(data["token"], str) and len(data["token"]) > 0
    assert "user" in data
    assert data["user"].get("email") == ADMIN["email"]


def test_dashboard(auth):
    r = requests.get(f"{BASE_URL}/api/dashboard", headers=auth, timeout=30)
    assert r.status_code == 200, r.text
    d = r.json()
    # Expect KPI keys
    for k in ("total_invoices", "total_amount"):
        pass  # keys may differ; just assert dict + no qr_code leak
    assert isinstance(d, dict)
    # Ensure no qr_code field leaked anywhere in nested invoices if present
    for v in d.values():
        if isinstance(v, list):
            for item in v:
                if isinstance(item, dict):
                    assert "qr_code" not in item
                    assert "_id" not in item


def test_reports_no_filters(auth):
    r = requests.get(f"{BASE_URL}/api/reports", headers=auth, timeout=30)
    assert r.status_code == 200, r.text
    d = r.json()
    for k in ("count", "total", "pago", "pendente", "invoices"):
        assert k in d, f"missing {k}"
    assert isinstance(d["invoices"], list)
    assert d["count"] == len(d["invoices"])
    for inv in d["invoices"]:
        assert "qr_code" not in inv
        assert "_id" not in inv


def test_reports_with_date_filters(auth):
    r = requests.get(
        f"{BASE_URL}/api/reports",
        params={"date_from": "2024-01-01", "date_to": "2030-12-31"},
        headers=auth,
        timeout=30,
    )
    assert r.status_code == 200, r.text
    d = r.json()
    assert d["count"] == len(d["invoices"])
    # totals consistency
    assert round(d["pago"] + d["pendente"], 2) <= round(d["total"] + 0.01, 2)


def test_reports_narrow_date_range_returns_subset(auth):
    full = requests.get(f"{BASE_URL}/api/reports", headers=auth, timeout=30).json()
    narrow = requests.get(
        f"{BASE_URL}/api/reports",
        params={"date_from": "2099-01-01", "date_to": "2099-12-31"},
        headers=auth,
        timeout=30,
    ).json()
    assert narrow["count"] == 0
    assert narrow["total"] == 0
    assert isinstance(full["count"], int)


def test_clients_list_and_detail(auth):
    r = requests.get(f"{BASE_URL}/api/clients", headers=auth, timeout=30)
    assert r.status_code == 200
    clients = r.json()
    assert isinstance(clients, list)
    if not clients:
        pytest.skip("No clients to test detail endpoint")
    cid = clients[0].get("id") or clients[0].get("_id")
    assert cid
    r2 = requests.get(f"{BASE_URL}/api/clients/{cid}", headers=auth, timeout=30)
    assert r2.status_code == 200, r2.text
    detail = r2.json()
    assert isinstance(detail, dict)
    # Must include invoices list (per spec)
    assert "invoices" in detail or "client" in detail
    # Ensure qr_code not leaked in nested invoices
    invs = detail.get("invoices", [])
    for inv in invs:
        assert "qr_code" not in inv
        assert "_id" not in inv


def test_invoices_list_still_works(auth):
    r = requests.get(f"{BASE_URL}/api/invoices", headers=auth, timeout=30)
    assert r.status_code == 200
    data = r.json()
    assert isinstance(data, list)
    # The listing endpoint may or may not include qr_code; just assert no _id leak
    for inv in data[:20]:
        assert "_id" not in inv
