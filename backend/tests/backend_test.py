"""INVEST backend API test suite (pytest)."""
import os
import io
import time
import uuid
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
if not BASE_URL:
    # fallback: read frontend/.env
    with open("/app/frontend/.env") as f:
        for line in f:
            if line.startswith("REACT_APP_BACKEND_URL="):
                BASE_URL = line.split("=", 1)[1].strip().strip('"').rstrip("/")
API = f"{BASE_URL}/api"

ADMIN_EMAIL = "euapostomesmo@proton.me"
ADMIN_PW = "Invest2026!"
AGENTE_EMAIL = "agente@invest.pt"
AGENTE_PW = "Agente2026!"


# ---------- Fixtures ----------
@pytest.fixture(scope="session")
def s():
    sess = requests.Session()
    sess.headers.update({"Content-Type": "application/json"})
    return sess


@pytest.fixture(scope="session")
def admin_token(s):
    r = s.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PW}, timeout=15)
    assert r.status_code == 200, f"admin login failed: {r.status_code} {r.text}"
    return r.json()["token"]


@pytest.fixture(scope="session")
def agente_token(s):
    r = s.post(f"{API}/auth/login", json={"email": AGENTE_EMAIL, "password": AGENTE_PW}, timeout=15)
    assert r.status_code == 200, f"agente login failed: {r.status_code} {r.text}"
    return r.json()["token"]


def auth(tok):
    return {"Authorization": f"Bearer {tok}"}


# ---------- Health ----------
def test_health(s):
    r = s.get(f"{API}/health", timeout=10)
    assert r.status_code == 200
    d = r.json()
    assert d["status"] == "ok"
    assert d["database"] == "ok"


# ---------- Auth ----------
def test_admin_login_returns_token_and_user(s):
    r = s.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PW})
    assert r.status_code == 200
    d = r.json()
    assert d["token"]
    assert d["user"]["role"] == "admin"
    assert d["user"]["tenant_id"] == "invest"


def test_agente_login(s):
    r = s.post(f"{API}/auth/login", json={"email": AGENTE_EMAIL, "password": AGENTE_PW})
    assert r.status_code == 200
    assert r.json()["user"]["role"] == "agente"


def test_wrong_password_rejected(s):
    r = s.post(f"{API}/auth/login",
               json={"email": f"nouser+{uuid.uuid4().hex[:6]}@invest.pt", "password": "wrongpw"})
    assert r.status_code == 401


def test_bruteforce_lockout_returns_429(s):
    # Use random email so we don't lockout real admin
    fake = f"lockout{uuid.uuid4().hex[:8]}@example.com"
    codes = []
    for _ in range(7):
        r = s.post(f"{API}/auth/login", json={"email": fake, "password": "x"})
        codes.append(r.status_code)
    # After >=5 attempts should return 429 at some point
    assert 429 in codes, f"expected 429 lockout, got {codes}"


def test_me_endpoint(s, admin_token):
    r = s.get(f"{API}/auth/me", headers=auth(admin_token))
    assert r.status_code == 200
    assert r.json()["email"] == ADMIN_EMAIL


def test_me_requires_token(s):
    r = s.get(f"{API}/auth/me")
    assert r.status_code == 401


# ---------- RBAC ----------
def test_agente_cannot_list_users(s, agente_token):
    r = s.get(f"{API}/users", headers=auth(agente_token))
    assert r.status_code == 403


def test_admin_can_list_users(s, admin_token):
    r = s.get(f"{API}/users", headers=auth(admin_token))
    assert r.status_code == 200
    assert isinstance(r.json(), list)


# ---------- Dashboard ----------
def test_dashboard(s, admin_token):
    r = s.get(f"{API}/dashboard", headers=auth(admin_token))
    assert r.status_code == 200
    d = r.json()
    for k in ("kpis", "by_status", "monthly", "recent", "counters"):
        assert k in d
    assert "faturado" in d["kpis"]


# ---------- Clients CRUD ----------
@pytest.fixture(scope="session")
def created_client(s, admin_token):
    payload = {"name": f"TEST_Cliente_{uuid.uuid4().hex[:6]}", "company": "TEST Lda",
               "nif": "999888777", "email": "test@t.pt"}
    r = s.post(f"{API}/clients", json=payload, headers=auth(admin_token))
    assert r.status_code == 200, r.text
    cid = r.json()["id"]
    yield r.json()
    s.delete(f"{API}/clients/{cid}", headers=auth(admin_token))


def test_client_created_and_retrieved(s, admin_token, created_client):
    cid = created_client["id"]
    r = s.get(f"{API}/clients/{cid}", headers=auth(admin_token))
    assert r.status_code == 200
    d = r.json()
    assert d["client"]["id"] == cid
    assert "invoices" in d and "metrics" in d


def test_client_listed(s, admin_token, created_client):
    r = s.get(f"{API}/clients", headers=auth(admin_token))
    assert r.status_code == 200
    ids = [c["id"] for c in r.json()]
    assert created_client["id"] in ids


# ---------- Invoices ----------
@pytest.fixture(scope="session")
def next_number(s, admin_token):
    r = s.get(f"{API}/invoices/next-number", headers=auth(admin_token))
    assert r.status_code == 200
    return r.json()["number"]


def test_next_number_format(next_number):
    assert next_number.startswith("FAT-")
    parts = next_number.split("-")
    assert len(parts) == 3 and len(parts[2]) == 6


@pytest.fixture(scope="session")
def created_invoice(s, admin_token, created_client, next_number):
    payload = {
        "client_id": created_client["id"],
        "items": [
            {"description": "Serviço A", "quantity": 2, "unit_price": 100, "discount": 10, "vat": 23},
            {"description": "Serviço B", "quantity": 1, "unit_price": 50, "discount": 0, "vat": 23},
        ],
        "due_label": "3d", "currency": "EUR", "status": "pendente",
    }
    r = s.post(f"{API}/invoices", json=payload, headers=auth(admin_token))
    assert r.status_code == 200, r.text
    return r.json()


def test_invoice_totals_computed(created_invoice):
    t = created_invoice["totals"]
    # subtotal = 2*100 + 1*50 = 250; discount = 200*10% = 20; base = 230; vat = 230*23% = 52.9; total = 282.9
    assert t["subtotal"] == 250.0
    assert t["discount"] == 20.0
    assert round(t["vat"], 2) == 52.9
    assert round(t["total"], 2) == 282.9


def test_invoice_number_generated(created_invoice, next_number):
    assert created_invoice["number"] == next_number
    assert created_invoice["qr_code"].startswith("data:image/png;base64,")
    assert created_invoice["public_link"].endswith(created_invoice["number"])


def test_next_number_increments_after_create(s, admin_token, created_invoice):
    r = s.get(f"{API}/invoices/next-number", headers=auth(admin_token))
    assert r.status_code == 200
    new_num = r.json()["number"]
    assert new_num != created_invoice["number"]


def test_invoice_status_change(s, admin_token, created_invoice):
    iid = created_invoice["id"]
    r = s.patch(f"{API}/invoices/{iid}/status", json={"status": "pago"}, headers=auth(admin_token))
    assert r.status_code == 200
    g = s.get(f"{API}/invoices/{iid}", headers=auth(admin_token)).json()
    assert g["status"] == "pago"
    assert any(h["status"] == "pago" for h in g["status_history"])
    # revert
    s.patch(f"{API}/invoices/{iid}/status", json={"status": "pendente"}, headers=auth(admin_token))


def test_invoice_status_invalid(s, admin_token, created_invoice):
    iid = created_invoice["id"]
    r = s.patch(f"{API}/invoices/{iid}/status",
                json={"status": "foo"}, headers=auth(admin_token))
    assert r.status_code == 400


def test_public_invoice_by_number(s, created_invoice):
    r = requests.get(f"{API}/public/invoice/{created_invoice['number']}", timeout=15)
    assert r.status_code == 200
    assert r.json()["number"] == created_invoice["number"]


def test_public_invoice_not_found(s):
    r = requests.get(f"{API}/public/invoice/FAT-0000-000000", timeout=15)
    assert r.status_code == 404


def test_tenant_isolation_get_invoice(s, admin_token, created_invoice):
    # Random invoice id from wrong tenant simulated: use random uuid
    r = s.get(f"{API}/invoices/{uuid.uuid4()}", headers=auth(admin_token))
    assert r.status_code == 404


# ---------- Public emit ----------
def test_public_emit_invoice(s):
    payload = {"items": [{"description": "Pub", "quantity": 1, "unit_price": 10, "discount": 0, "vat": 23}],
               "recipient": {"name": "TEST_Public"}, "due_label": "1d"}
    r = requests.post(f"{API}/public/invoice/create?tenant=invest", json=payload, timeout=15)
    assert r.status_code == 200
    d = r.json()
    assert d["tenant_id"] == "invest"
    assert d["number"].startswith("FAT-")


# ---------- Uploads ----------
def test_upload_and_list(s, admin_token):
    files = {"file": ("test.txt", io.BytesIO(b"hello INVEST"), "text/plain")}
    data = {"sender_name": "TEST_Sender"}
    r = requests.post(f"{API}/uploads", files=files, data=data, headers=auth(admin_token), timeout=15)
    assert r.status_code == 200, r.text
    uid = r.json()["id"]
    r2 = s.get(f"{API}/uploads", headers=auth(admin_token))
    assert r2.status_code == 200
    assert any(u["id"] == uid for u in r2.json())
    s.delete(f"{API}/uploads/{uid}", headers=auth(admin_token))


def test_public_upload(s):
    files = {"file": ("pub.txt", io.BytesIO(b"public"), "text/plain")}
    data = {"sender_name": "TEST_Pub"}
    r = requests.post(f"{API}/public/upload/invest", files=files, data=data, timeout=15)
    assert r.status_code == 200
    assert r.json()["ok"] is True


# ---------- Proofs ----------
def test_proof_submission_and_accept(s, admin_token, created_invoice):
    iid = created_invoice["id"]
    files = {"file": ("proof.png", io.BytesIO(b"\x89PNG\r\n"), "image/png")}
    data = {"invoice_id": iid, "message": "TEST_proof"}
    r = requests.post(f"{API}/proofs", files=files, data=data, headers=auth(admin_token), timeout=15)
    assert r.status_code == 200
    pid = r.json()["id"]
    # accept -> invoice becomes pago
    r2 = s.patch(f"{API}/proofs/{pid}", json={"status": "aceite"}, headers=auth(admin_token))
    assert r2.status_code == 200
    inv = s.get(f"{API}/invoices/{iid}", headers=auth(admin_token)).json()
    assert inv["status"] == "pago"
    # revert
    s.patch(f"{API}/invoices/{iid}/status", json={"status": "pendente"}, headers=auth(admin_token))


# ---------- Contracts / Templates ----------
def test_contract_crud(s, admin_token):
    r = s.post(f"{API}/contracts", json={"title": "TEST_C", "content": "x"}, headers=auth(admin_token))
    assert r.status_code == 200
    cid = r.json()["id"]
    r2 = s.get(f"{API}/contracts", headers=auth(admin_token))
    assert any(c["id"] == cid for c in r2.json())
    r3 = s.delete(f"{API}/contracts/{cid}", headers=auth(admin_token))
    assert r3.status_code == 200


def test_template_crud(s, admin_token):
    r = s.post(f"{API}/templates", json={"name": "TEST_T", "type": "fatura", "data": {}}, headers=auth(admin_token))
    assert r.status_code == 200
    tid = r.json()["id"]
    s.delete(f"{API}/templates/{tid}", headers=auth(admin_token))


# ---------- Reports ----------
def test_reports_filter(s, admin_token):
    r = s.get(f"{API}/reports", headers=auth(admin_token))
    assert r.status_code == 200
    d = r.json()
    assert "count" in d and "total" in d


def test_reports_export_csv(s, admin_token):
    r = s.get(f"{API}/reports/export?fmt=csv", headers=auth(admin_token))
    assert r.status_code == 200
    assert "text/csv" in r.headers.get("Content-Type", "")
    assert b"Total" in r.content or b"N\xc3\xbamero" in r.content


def test_reports_export_xlsx(s, admin_token):
    r = s.get(f"{API}/reports/export?fmt=xlsx", headers=auth(admin_token))
    assert r.status_code == 200
    assert "spreadsheetml" in r.headers.get("Content-Type", "")


# ---------- History ----------
def test_history(s, admin_token):
    r = s.get(f"{API}/history", headers=auth(admin_token))
    assert r.status_code == 200
    assert isinstance(r.json(), list)


# ---------- Settings ----------
def test_settings_get_and_admin_put(s, admin_token, agente_token):
    r = s.get(f"{API}/settings", headers=auth(admin_token))
    assert r.status_code == 200
    r2 = s.put(f"{API}/settings", json={"sender": {"name": "TEST_Sender"},
               "bank": {"iban": "PT50000000000000000000000"}, "default_currency": "EUR"},
               headers=auth(admin_token))
    assert r2.status_code == 200
    # agente cannot update
    r3 = s.put(f"{API}/settings", json={"sender": {}, "bank": {}, "default_currency": "EUR"},
               headers=auth(agente_token))
    assert r3.status_code == 403


# ---------- Calculo ----------
@pytest.fixture(scope="session")
def calc_profile(s, admin_token):
    r = s.post(f"{API}/calc/profiles", json={"name": f"TEST_Calc_{uuid.uuid4().hex[:5]}"},
               headers=auth(admin_token))
    assert r.status_code == 200
    p = r.json()
    yield p
    s.delete(f"{API}/calc/profiles/{p['id']}", headers=auth(admin_token))


def test_calc_entry_bonus_and_total(s, admin_token, calc_profile):
    payload = {"profile_id": calc_profile["id"], "deposit": 1000.0, "date": "2026-01-05"}
    r = s.post(f"{API}/calc/entries", json=payload, headers=auth(admin_token))
    assert r.status_code == 200
    d = r.json()
    assert d["bonus"] == 200.0
    assert d["total"] == 1200.0
    assert d["payment_friday"]  # non-empty


def test_calc_export(s, admin_token, calc_profile):
    r = s.get(f"{API}/calc/export?profile_id={calc_profile['id']}", headers=auth(admin_token))
    assert r.status_code == 200
    assert "spreadsheetml" in r.headers.get("Content-Type", "")


# ---------- Monitor ----------
def test_monitor_stats(s, admin_token):
    r = s.get(f"{API}/monitor/stats", headers=auth(admin_token))
    assert r.status_code == 200
    d = r.json()
    assert d["system"] == "online"


# ---------- Crypto ----------
def test_crypto_market(s, admin_token):
    r = s.get(f"{API}/crypto/market", headers=auth(admin_token), timeout=30)
    # Market can be 502 if all sources down; try to accept 200 as ideal
    assert r.status_code in (200, 502), r.text
    if r.status_code == 200:
        d = r.json()
        assert "market" in d and "fear_greed" in d


def test_crypto_watchlist_add_remove(s, admin_token):
    r0 = s.get(f"{API}/crypto/watchlist", headers=auth(admin_token), timeout=30)
    assert r0.status_code == 200
    r = s.post(f"{API}/crypto/watchlist", json={"symbol": "ADA"}, headers=auth(admin_token))
    assert r.status_code == 200
    assert "ADA" in r.json()["symbols"]
    r2 = s.delete(f"{API}/crypto/watchlist/ADA", headers=auth(admin_token))
    assert r2.status_code == 200
    assert "ADA" not in r2.json()["symbols"]


def test_crypto_history(s, admin_token):
    r = s.get(f"{API}/crypto/history", headers=auth(admin_token))
    assert r.status_code == 200


def test_crypto_analysis_generates(s, admin_token):
    # LLM call — allow up to 60s
    r = s.post(f"{API}/crypto/analysis", json={"symbol": "BTC", "timeframe": "4h"},
               headers=auth(admin_token), timeout=90)
    # Accept 502 (upstream data down) but prefer 200
    assert r.status_code in (200, 502), r.text
    if r.status_code == 200:
        d = r.json()
        assert "final_score" in d
        assert "trend" in d
