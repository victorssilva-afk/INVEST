"""Backend tests for INVEST security hardening (iteration 14).

Covers:
 - Admin + Agente login (env-based seed)
 - GET /api/invoices/next-number placeholder format
 - POST /api/invoices creates random FAT-YYYY-XXXXXXXX numbers
 - Public link + GET /api/public/invoice/{number}
 - Regex-escape on /api/clients?q and /api/invoices?q (special chars don't crash)
 - GET /api/support/ice returns iceServers with TURN creds
 - Cleanup invoices created by tests
"""
import os
import re
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
if not BASE_URL:
    # Fallback: read frontend .env
    with open("/app/frontend/.env") as f:
        for ln in f:
            if ln.startswith("REACT_APP_BACKEND_URL"):
                BASE_URL = ln.split("=", 1)[1].strip().strip('"').rstrip("/")

ADMIN = {"email": "euapostomesmo@proton.me", "password": "Invest2026!"}
AGENT = {"email": "agente@invest.pt", "password": "Agente2026!"}

INV_RE = re.compile(r"^FAT-\d{4}-[A-HJ-NP-Z2-9]{8}$")

created_invoice_ids = []


@pytest.fixture(scope="module")
def admin_token():
    r = requests.post(f"{BASE_URL}/api/auth/login", json=ADMIN, timeout=20)
    assert r.status_code == 200, f"admin login failed {r.status_code} {r.text}"
    return r.json()["token"]


@pytest.fixture(scope="module")
def agent_token():
    r = requests.post(f"{BASE_URL}/api/auth/login", json=AGENT, timeout=20)
    assert r.status_code == 200, f"agent login failed {r.status_code} {r.text}"
    return r.json()["token"]


@pytest.fixture(scope="module")
def admin_client(admin_token):
    s = requests.Session()
    s.headers.update({"Authorization": f"Bearer {admin_token}", "Content-Type": "application/json"})
    return s


# ---------------- Auth ----------------
def test_admin_login(admin_token):
    assert admin_token and isinstance(admin_token, str)


def test_agent_login(agent_token):
    assert agent_token and isinstance(agent_token, str)


# ---------------- Invoice number format ----------------
def test_next_number_placeholder(admin_client):
    r = admin_client.get(f"{BASE_URL}/api/invoices/next-number")
    assert r.status_code == 200
    data = r.json()
    assert "number" in data
    import datetime as _dt
    year = _dt.datetime.utcnow().year
    assert data["number"] == f"FAT-{year}-XXXXXXXX"


def _mk_invoice_payload():
    return {
        "recipient": {"name": "TEST_Cliente", "email": "test@example.com"},
        "items": [{"description": "TEST item", "quantity": 1, "unit_price": 10, "discount": 0, "vat": 23}],
        "due_label": "3d", "currency": "EUR", "notes": "TEST", "status": "pendente",
    }


def test_create_invoices_unique_random_numbers(admin_client):
    numbers = set()
    for _ in range(5):
        r = admin_client.post(f"{BASE_URL}/api/invoices", json=_mk_invoice_payload())
        assert r.status_code == 200, r.text
        d = r.json()
        num = d["number"]
        assert INV_RE.match(num), f"invalid number format: {num}"
        assert num not in numbers, "duplicate number returned"
        numbers.add(num)
        assert d["public_link"].endswith(f"/fatura/{num}")
        created_invoice_ids.append(d["id"])
    assert len(numbers) == 5


def test_public_invoice_fetch_by_number(admin_client):
    # use last created invoice
    assert created_invoice_ids, "need created invoice"
    inv = admin_client.get(f"{BASE_URL}/api/invoices/{created_invoice_ids[-1]}").json()
    num = inv["number"]
    r = requests.get(f"{BASE_URL}/api/public/invoice/{num}", timeout=20)
    assert r.status_code == 200, r.text
    d = r.json()
    assert d["number"] == num
    assert "agent_id" not in d


def test_old_sequential_invoice_still_openable(admin_client):
    # Find any invoice with old sequential format (non-random) if present
    r = admin_client.get(f"{BASE_URL}/api/invoices")
    assert r.status_code == 200
    all_invs = r.json()
    old = [i for i in all_invs if not INV_RE.match(i["number"])]
    if not old:
        pytest.skip("no legacy sequential invoices in DB")
    num = old[0]["number"]
    r = requests.get(f"{BASE_URL}/api/public/invoice/{num}", timeout=20)
    assert r.status_code == 200
    assert r.json()["number"] == num


# ---------------- Regex escape search ----------------
@pytest.mark.parametrize("q", ["(a+)+$", ".*", "[unterminated", "((((", "a.b*c"])
def test_clients_search_regex_special_chars(admin_client, q):
    r = admin_client.get(f"{BASE_URL}/api/clients", params={"q": q})
    assert r.status_code == 200, f"q={q} -> {r.status_code} {r.text}"
    assert isinstance(r.json(), list)


@pytest.mark.parametrize("q", ["(a+)+$", ".*", "[", "FAT-"])
def test_invoices_search_regex_special_chars(admin_client, q):
    r = admin_client.get(f"{BASE_URL}/api/invoices", params={"q": q})
    assert r.status_code == 200, f"q={q} -> {r.status_code} {r.text}"
    assert isinstance(r.json(), list)


def test_invoices_search_normal_match(admin_client):
    # Search by portion of a known random number should still match
    assert created_invoice_ids
    inv = admin_client.get(f"{BASE_URL}/api/invoices/{created_invoice_ids[0]}").json()
    num = inv["number"]
    frag = num[-4:]  # last 4 chars of random tail
    r = admin_client.get(f"{BASE_URL}/api/invoices", params={"q": frag})
    assert r.status_code == 200
    data = r.json()
    found = any(i["number"] == num for i in data)
    assert found, f"expected to find {num} by searching '{frag}'"


# ---------------- Support ICE (TURN env) ----------------
def test_support_ice_turn_creds():
    r = requests.get(f"{BASE_URL}/api/support/ice", timeout=20)
    assert r.status_code == 200
    data = r.json()
    assert "iceServers" in data
    servers = data["iceServers"]
    assert isinstance(servers, list) and len(servers) >= 2
    turn = [s for s in servers if "username" in s and "credential" in s]
    assert turn, "no TURN entries with creds"
    for s in turn:
        assert s["username"], "empty TURN username"
        assert s["credential"], "empty TURN credential"


# ---------------- Cleanup ----------------
def test_zz_cleanup_invoices(admin_client):
    for iid in created_invoice_ids:
        admin_client.delete(f"{BASE_URL}/api/invoices/{iid}")
    # don't assert; best-effort
