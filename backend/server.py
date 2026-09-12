from dotenv import load_dotenv
from pathlib import Path
ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

import os
import uuid
import asyncio
import logging
import time
from datetime import datetime, timezone, timedelta
from typing import List, Optional, Any

import jwt
import bcrypt
import qrcode
import io
import base64
from openpyxl import Workbook
from openpyxl.chart import PieChart, Reference

from fastapi import FastAPI, APIRouter, HTTPException, Depends, Request, UploadFile, File, Form, WebSocket, WebSocketDisconnect
from fastapi.responses import StreamingResponse
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field, EmailStr

import crypto_service as crypto

# ---------------- DB ----------------
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

JWT_SECRET = os.environ['JWT_SECRET']
JWT_ALG = "HS256"
TOKEN_HOURS = 12
TENANTS = ["invest", "fernanda", "rafaela"]
DEFAULT_TENANT = "invest"

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("invest")
START_TIME = time.time()

app = FastAPI(title="INVEST API")
api = APIRouter(prefix="/api")


# ---------------- Security helpers ----------------
def hash_password(p: str) -> str:
    return bcrypt.hashpw(p.encode(), bcrypt.gensalt()).decode()


def verify_password(p: str, h: str) -> bool:
    try:
        return bcrypt.checkpw(p.encode(), h.encode())
    except Exception:
        return False


def create_token(user: dict) -> str:
    payload = {
        "sub": user["id"], "email": user["email"], "role": user["role"],
        "tenant_id": user["tenant_id"], "name": user.get("name"),
        "exp": datetime.now(timezone.utc) + timedelta(hours=TOKEN_HOURS),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALG)


async def get_current_user(request: Request) -> dict:
    auth = request.headers.get("Authorization", "")
    if not auth.startswith("Bearer "):
        raise HTTPException(401, "Não autenticado")
    token = auth[7:]
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALG])
    except jwt.ExpiredSignatureError:
        raise HTTPException(401, "Sessão expirada")
    except jwt.InvalidTokenError:
        raise HTTPException(401, "Token inválido")
    user = await db.users.find_one({"id": payload["sub"]}, {"_id": 0, "password_hash": 0})
    if not user or not user.get("active", True):
        raise HTTPException(401, "Utilizador inválido")
    return user


def require_roles(*roles):
    async def dep(user: dict = Depends(get_current_user)):
        if user["role"] not in roles:
            raise HTTPException(403, "Sem permissão para esta ação")
        return user
    return dep


async def log_history(action: str, entity: str, entity_id: str, user: dict):
    await db.history.insert_one({
        "id": str(uuid.uuid4()), "action": action, "entity": entity,
        "entity_id": entity_id, "user": user.get("name") or user.get("email"),
        "tenant_id": user["tenant_id"], "at": datetime.now(timezone.utc).isoformat(),
    })


def now_iso():
    return datetime.now(timezone.utc).isoformat()


# ---------------- Models ----------------
class LoginIn(BaseModel):
    email: EmailStr
    password: str


class UserIn(BaseModel):
    name: str
    email: EmailStr
    password: str
    role: str = "agente"
    active: bool = True


class UserUpdate(BaseModel):
    name: Optional[str] = None
    role: Optional[str] = None
    active: Optional[bool] = None
    password: Optional[str] = None


class ClientIn(BaseModel):
    name: str
    company: Optional[str] = ""
    nif: Optional[str] = ""
    email: Optional[str] = ""
    phone: Optional[str] = ""
    address: Optional[str] = ""
    city: Optional[str] = ""
    postal_code: Optional[str] = ""
    country: Optional[str] = "Portugal"


class InvoiceItem(BaseModel):
    description: str
    quantity: float = 1
    unit_price: float = 0
    discount: float = 0
    vat: float = 23


class InvoiceIn(BaseModel):
    client_id: Optional[str] = None
    recipient: dict = {}
    sender: dict = {}
    items: List[InvoiceItem] = []
    due_label: str = "3d"
    currency: str = "EUR"
    bank: dict = {}
    international: dict = {}
    notes: Optional[str] = ""
    company_message: Optional[str] = ""
    status: str = "pendente"


class StatusIn(BaseModel):
    status: str


class SettingsIn(BaseModel):
    sender: dict = {}
    bank: dict = {}
    default_currency: str = "EUR"


class ContractIn(BaseModel):
    title: str
    client_id: Optional[str] = None
    content: str = ""
    status: str = "ativo"


class TemplateIn(BaseModel):
    name: str
    type: str = "fatura"
    data: dict = {}


class CalcProfileIn(BaseModel):
    name: str


class CalcEntryIn(BaseModel):
    profile_id: str
    deposit: float
    date: str  # ISO date of deposit


class WatchlistIn(BaseModel):
    symbol: str


DUE_MAP = {
    "1h": timedelta(hours=1), "3h": timedelta(hours=3), "1d": timedelta(days=1),
    "3d": timedelta(days=3), "4d": timedelta(days=4), "5d": timedelta(days=5),
}
DUE_LABELS = {"1h": "1 hora", "3h": "3 horas", "1d": "1 dia", "3d": "3 dias",
              "4d": "4 dias", "5d": "5 dias"}


def compute_totals(items):
    subtotal = 0.0
    discount_total = 0.0
    vat_total = 0.0
    for it in items:
        line = it["quantity"] * it["unit_price"]
        d = line * (it["discount"] / 100.0)
        base = line - d
        v = base * (it["vat"] / 100.0)
        subtotal += line
        discount_total += d
        vat_total += v
    total = subtotal - discount_total + vat_total
    return {
        "subtotal": round(subtotal, 2), "discount": round(discount_total, 2),
        "vat": round(vat_total, 2), "total": round(total, 2),
    }


async def next_invoice_number(tenant_id: str) -> str:
    year = datetime.now(timezone.utc).year
    key = f"{tenant_id}:{year}"
    doc = await db.counters.find_one_and_update(
        {"_id": key}, {"$inc": {"seq": 1}}, upsert=True, return_document=True)
    seq = doc["seq"]
    return f"FAT-{year}-{seq:06d}"


def make_qr_datauri(text: str) -> str:
    img = qrcode.make(text)
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return "data:image/png;base64," + base64.b64encode(buf.getvalue()).decode()


def public_base(request: Request) -> str:
    # Frontend-controlled origin (immune to proxy host rewriting), then standard fallbacks
    xpb = request.headers.get("x-public-base")
    if xpb:
        return xpb.rstrip("/")
    origin = request.headers.get("origin")
    if origin:
        return origin.rstrip("/")
    xfh = request.headers.get("x-forwarded-host")
    if xfh:
        proto = request.headers.get("x-forwarded-proto", "https")
        return f"{proto}://{xfh.split(',')[0].strip()}"
    return os.environ.get("FRONTEND_URL") or str(request.base_url).rstrip("/")


# ================= AUTH =================
@api.post("/auth/login")
async def login(body: LoginIn, request: Request):
    xff = request.headers.get("x-forwarded-for", "")
    ip = xff.split(",")[0].strip() if xff else (request.client.host if request.client else "?")
    ident = f"{ip}:{body.email.lower()}"
    now = datetime.now(timezone.utc)
    att = await db.login_attempts.find_one({"_id": ident})
    if att:
        first_at = att.get("first_at")
        # reset the window if older than 15 minutes
        if first_at and (now - datetime.fromisoformat(first_at)) > timedelta(minutes=15):
            await db.login_attempts.delete_one({"_id": ident})
            att = None
    if att and att.get("count", 0) >= 5:
        raise HTTPException(429, "Demasiadas tentativas. Tente novamente dentro de 15 minutos.")
    user = await db.users.find_one({"email": body.email.lower()})
    if not user or not verify_password(body.password, user["password_hash"]):
        await db.login_attempts.update_one(
            {"_id": ident},
            {"$inc": {"count": 1}, "$setOnInsert": {"first_at": now.isoformat()}},
            upsert=True)
        raise HTTPException(401, "Credenciais inválidas")
    if not user.get("active", True):
        raise HTTPException(403, "Conta desativada")
    await db.login_attempts.delete_one({"_id": ident})
    token = create_token(user)
    return {"token": token, "user": {k: user[k] for k in ("id", "name", "email", "role", "tenant_id")}}


@api.get("/auth/me")
async def me(user: dict = Depends(get_current_user)):
    return user


# ================= USERS =================
@api.get("/users")
async def list_users(user: dict = Depends(require_roles("admin"))):
    return await db.users.find({"tenant_id": user["tenant_id"]}, {"_id": 0, "password_hash": 0}).to_list(500)


@api.post("/users")
async def create_user(body: UserIn, user: dict = Depends(require_roles("admin"))):
    if await db.users.find_one({"email": body.email.lower()}):
        raise HTTPException(400, "Email já registado")
    doc = {"id": str(uuid.uuid4()), "name": body.name, "email": body.email.lower(),
           "password_hash": hash_password(body.password), "role": body.role,
           "tenant_id": user["tenant_id"], "active": body.active, "created_at": now_iso()}
    await db.users.insert_one(doc)
    await log_history("criou", "utilizador", doc["id"], user)
    return {k: doc[k] for k in ("id", "name", "email", "role", "tenant_id", "active")}


@api.put("/users/{uid}")
async def update_user(uid: str, body: UserUpdate, user: dict = Depends(require_roles("admin"))):
    target = await db.users.find_one({"id": uid, "tenant_id": user["tenant_id"]})
    if not target:
        raise HTTPException(404, "Utilizador não encontrado")
    upd = {}
    if body.name is not None:
        upd["name"] = body.name
    if body.role is not None:
        upd["role"] = body.role
    if body.active is not None:
        upd["active"] = body.active
    if body.password:
        upd["password_hash"] = hash_password(body.password)
    await db.users.update_one({"id": uid}, {"$set": upd})
    await log_history("editou", "utilizador", uid, user)
    return {"ok": True}


@api.delete("/users/{uid}")
async def delete_user(uid: str, user: dict = Depends(require_roles("admin"))):
    if uid == user["id"]:
        raise HTTPException(400, "Não pode eliminar a própria conta")
    r = await db.users.delete_one({"id": uid, "tenant_id": user["tenant_id"]})
    if not r.deleted_count:
        raise HTTPException(404, "Utilizador não encontrado")
    await log_history("eliminou", "utilizador", uid, user)
    return {"ok": True}


# ================= SETTINGS =================
@api.get("/settings")
async def get_settings(user: dict = Depends(get_current_user)):
    s = await db.settings.find_one({"tenant_id": user["tenant_id"]}, {"_id": 0})
    if not s:
        s = {"tenant_id": user["tenant_id"], "sender": {}, "bank": {}, "default_currency": "EUR"}
        await db.settings.insert_one(dict(s))
    return s


@api.put("/settings")
async def update_settings(body: SettingsIn, user: dict = Depends(require_roles("admin"))):
    await db.settings.update_one(
        {"tenant_id": user["tenant_id"]},
        {"$set": {"sender": body.sender, "bank": body.bank,
                  "default_currency": body.default_currency, "tenant_id": user["tenant_id"]}},
        upsert=True)
    await log_history("atualizou", "definições", user["tenant_id"], user)
    return {"ok": True}


# ================= CLIENTS =================
@api.get("/clients")
async def list_clients(q: str = "", user: dict = Depends(get_current_user)):
    query = {"tenant_id": user["tenant_id"]}
    if q:
        query["$or"] = [{"name": {"$regex": q, "$options": "i"}},
                        {"company": {"$regex": q, "$options": "i"}},
                        {"nif": {"$regex": q, "$options": "i"}},
                        {"email": {"$regex": q, "$options": "i"}}]
    return await db.clients.find(query, {"_id": 0}).sort("name", 1).to_list(1000)


@api.post("/clients")
async def create_client(body: ClientIn, user: dict = Depends(get_current_user)):
    doc = body.model_dump()
    doc.update({"id": str(uuid.uuid4()), "tenant_id": user["tenant_id"], "created_at": now_iso()})
    await db.clients.insert_one(dict(doc))
    await log_history("criou", "cliente", doc["id"], user)
    doc.pop("_id", None)
    return doc


@api.get("/clients/{cid}")
async def get_client(cid: str, user: dict = Depends(get_current_user)):
    c = await db.clients.find_one({"id": cid, "tenant_id": user["tenant_id"]}, {"_id": 0})
    if not c:
        raise HTTPException(404, "Cliente não encontrado")
    invoices = await db.invoices.find({"client_id": cid, "tenant_id": user["tenant_id"]}, {"_id": 0}).sort("created_at", -1).to_list(500)
    metrics = {"total_faturado": sum(i["totals"]["total"] for i in invoices),
               "n_faturas": len(invoices),
               "pago": sum(i["totals"]["total"] for i in invoices if i["status"] == "pago"),
               "pendente": sum(i["totals"]["total"] for i in invoices if i["status"] == "pendente")}
    return {"client": c, "invoices": invoices, "metrics": metrics}


@api.put("/clients/{cid}")
async def update_client(cid: str, body: ClientIn, user: dict = Depends(get_current_user)):
    r = await db.clients.update_one({"id": cid, "tenant_id": user["tenant_id"]}, {"$set": body.model_dump()})
    if not r.matched_count:
        raise HTTPException(404, "Cliente não encontrado")
    await log_history("editou", "cliente", cid, user)
    return {"ok": True}


@api.delete("/clients/{cid}")
async def delete_client(cid: str, user: dict = Depends(require_roles("admin"))):
    r = await db.clients.delete_one({"id": cid, "tenant_id": user["tenant_id"]})
    if not r.deleted_count:
        raise HTTPException(404, "Cliente não encontrado")
    await log_history("eliminou", "cliente", cid, user)
    return {"ok": True}


# ================= INVOICES =================
async def build_invoice_doc(body: InvoiceIn, user, request, tenant_id, agent_name):
    items = [i.model_dump() for i in body.items]
    totals = compute_totals(items)
    number = await next_invoice_number(tenant_id)
    issue = datetime.now(timezone.utc)
    due = issue + DUE_MAP.get(body.due_label, DUE_MAP["3d"])
    iid = str(uuid.uuid4())
    recipient = body.recipient
    if body.client_id:
        c = await db.clients.find_one({"id": body.client_id, "tenant_id": tenant_id}, {"_id": 0})
        if c:
            recipient = {"name": c["name"], "company": c.get("company"), "nif": c.get("nif"),
                         "email": c.get("email"), "address": c.get("address"),
                         "city": c.get("city"), "postal_code": c.get("postal_code"),
                         "country": c.get("country")}
    settings = await db.settings.find_one({"tenant_id": tenant_id}, {"_id": 0}) or {}
    sender = body.sender or settings.get("sender", {})
    bank = body.bank or settings.get("bank", {})
    link = f"{public_base(request)}/fatura/{number}"
    doc = {
        "id": iid, "number": number, "tenant_id": tenant_id,
        "issue_date": issue.isoformat(), "due_date": due.isoformat(),
        "due_label": DUE_LABELS.get(body.due_label, body.due_label),
        "status": body.status, "currency": body.currency, "sender": sender,
        "client_id": body.client_id, "recipient": recipient, "items": items,
        "totals": totals, "bank": bank, "notes": body.notes,
        "company_message": body.company_message, "international": body.international,
        "agent_id": user["id"] if user else None, "agent_name": agent_name,
        "public_link": link, "qr_code": make_qr_datauri(link),
        "status_history": [{"status": body.status, "at": issue.isoformat()}],
        "created_at": issue.isoformat(), "updated_at": issue.isoformat(),
    }
    return doc


@api.get("/invoices/next-number")
async def preview_next_number(user: dict = Depends(get_current_user)):
    year = datetime.now(timezone.utc).year
    doc = await db.counters.find_one({"_id": f"{user['tenant_id']}:{year}"})
    seq = (doc["seq"] + 1) if doc else 1
    return {"number": f"FAT-{year}-{seq:06d}"}


@api.get("/invoices")
async def list_invoices(status: str = "", q: str = "", user: dict = Depends(get_current_user)):
    query = {"tenant_id": user["tenant_id"]}
    if status:
        query["status"] = status
    if q:
        query["$or"] = [{"number": {"$regex": q, "$options": "i"}},
                        {"recipient.name": {"$regex": q, "$options": "i"}}]
    return await db.invoices.find(query, {"_id": 0}).sort("created_at", -1).to_list(1000)


@api.post("/invoices")
async def create_invoice(body: InvoiceIn, request: Request, user: dict = Depends(get_current_user)):
    doc = await build_invoice_doc(body, user, request, user["tenant_id"], user.get("name"))
    await db.invoices.insert_one(dict(doc))
    await log_history("emitiu", "fatura", doc["number"], user)
    doc.pop("_id", None)
    return doc


@api.get("/invoices/{iid}")
async def get_invoice(iid: str, user: dict = Depends(get_current_user)):
    inv = await db.invoices.find_one({"id": iid, "tenant_id": user["tenant_id"]}, {"_id": 0})
    if not inv:
        raise HTTPException(404, "Fatura não encontrada")
    proofs = await db.proofs.find({"invoice_id": iid, "tenant_id": user["tenant_id"]}, {"_id": 0, "file_data": 0}).to_list(100)
    inv["proofs"] = proofs
    return inv


@api.put("/invoices/{iid}")
async def update_invoice(iid: str, body: InvoiceIn, request: Request, user: dict = Depends(get_current_user)):
    inv = await db.invoices.find_one({"id": iid, "tenant_id": user["tenant_id"]})
    if not inv:
        raise HTTPException(404, "Fatura não encontrada")
    items = [i.model_dump() for i in body.items]
    totals = compute_totals(items)
    recipient = body.recipient
    if body.client_id:
        c = await db.clients.find_one({"id": body.client_id, "tenant_id": user["tenant_id"]}, {"_id": 0})
        if c:
            recipient = {"name": c["name"], "company": c.get("company"), "nif": c.get("nif"),
                         "email": c.get("email"), "address": c.get("address"),
                         "city": c.get("city"), "postal_code": c.get("postal_code"), "country": c.get("country")}
    upd = {"items": items, "totals": totals, "recipient": recipient, "sender": body.sender or inv.get("sender"),
           "bank": body.bank or inv.get("bank"), "notes": body.notes, "company_message": body.company_message,
           "international": body.international, "currency": body.currency, "client_id": body.client_id,
           "updated_at": now_iso()}
    await db.invoices.update_one({"id": iid}, {"$set": upd})
    await log_history("editou", "fatura", inv["number"], user)
    return {"ok": True}


@api.patch("/invoices/{iid}/status")
async def change_status(iid: str, body: StatusIn, user: dict = Depends(get_current_user)):
    valid = ["pendente", "pago", "expirado", "cancelado", "analise"]
    if body.status not in valid:
        raise HTTPException(400, "Estado inválido")
    inv = await db.invoices.find_one({"id": iid, "tenant_id": user["tenant_id"]})
    if not inv:
        raise HTTPException(404, "Fatura não encontrada")
    await db.invoices.update_one({"id": iid}, {
        "$set": {"status": body.status, "updated_at": now_iso()},
        "$push": {"status_history": {"status": body.status, "at": now_iso()}}})
    await log_history(f"estado→{body.status}", "fatura", inv["number"], user)
    return {"ok": True}


@api.delete("/invoices/{iid}")
async def delete_invoice(iid: str, user: dict = Depends(require_roles("admin"))):
    inv = await db.invoices.find_one({"id": iid, "tenant_id": user["tenant_id"]})
    if not inv:
        raise HTTPException(404, "Fatura não encontrada")
    await db.invoices.delete_one({"id": iid})
    await log_history("eliminou", "fatura", inv["number"], user)
    return {"ok": True}


# ================= DASHBOARD =================
@api.get("/dashboard")
async def dashboard(user: dict = Depends(get_current_user)):
    invs = await db.invoices.find({"tenant_id": user["tenant_id"]}, {"_id": 0}).to_list(5000)
    def s(st):
        return sum(i["totals"]["total"] for i in invs if i["status"] == st)
    kpis = {
        "faturado": round(sum(i["totals"]["total"] for i in invs), 2),
        "pago": round(s("pago"), 2), "pendente": round(s("pendente"), 2),
        "expirado": round(s("expirado"), 2), "analise": round(s("analise"), 2),
        "cancelado": round(s("cancelado"), 2), "n_faturas": len(invs),
        "n_clientes": await db.clients.count_documents({"tenant_id": user["tenant_id"]}),
    }
    by_status = {st: len([i for i in invs if i["status"] == st]) for st in
                 ["pendente", "pago", "expirado", "cancelado", "analise"]}
    # monthly faturado (last 6 months)
    months = {}
    for i in invs:
        m = i["created_at"][:7]
        months[m] = months.get(m, 0) + i["totals"]["total"]
    monthly = [{"month": k, "total": round(v, 2)} for k, v in sorted(months.items())][-6:]
    recent = sorted(invs, key=lambda x: x["created_at"], reverse=True)[:6]
    for r in recent:
        r.pop("qr_code", None)
    counters = {
        "proofs_pending": await db.proofs.count_documents({"tenant_id": user["tenant_id"], "status": "pendente"}),
        "uploads_pending": await db.uploads.count_documents({"tenant_id": user["tenant_id"]}),
    }
    return {"kpis": kpis, "by_status": by_status, "monthly": monthly, "recent": recent, "counters": counters}


@api.get("/counters")
async def sidebar_counters(user: dict = Depends(get_current_user)):
    return {
        "proofs_pending": await db.proofs.count_documents({"tenant_id": user["tenant_id"], "status": "pendente"}),
        "uploads_pending": await db.uploads.count_documents({"tenant_id": user["tenant_id"]}),
    }


# ================= PUBLIC =================
def _tenant_ok(t):
    return t if t in TENANTS else DEFAULT_TENANT


@api.post("/public/invoice/create")
async def public_create_invoice(body: InvoiceIn, request: Request, tenant: str = DEFAULT_TENANT):
    t = _tenant_ok(tenant)
    doc = await build_invoice_doc(body, None, request, t, "Emissão pública")
    await db.invoices.insert_one(dict(doc))
    doc.pop("_id", None)
    return doc


@api.get("/public/invoice/{number}")
async def public_get_invoice(number: str):
    inv = await db.invoices.find_one({"number": number}, {"_id": 0})
    if not inv:
        raise HTTPException(404, "Fatura não encontrada")
    # public: strip internal fields
    for f in ("agent_id",):
        inv.pop(f, None)
    return inv


@api.post("/public/upload/{tenant}")
async def public_upload(tenant: str, file: UploadFile = File(...), sender_name: str = Form("")):
    t = _tenant_ok(tenant)
    data = await file.read()
    if len(data) > 8 * 1024 * 1024:
        raise HTTPException(400, "Ficheiro demasiado grande (máx 8MB)")
    doc = {"id": str(uuid.uuid4()), "tenant": t, "tenant_id": t, "filename": file.filename,
           "file_data": "data:" + (file.content_type or "application/octet-stream") + ";base64," + base64.b64encode(data).decode(),
           "sender_name": sender_name, "created_at": now_iso()}
    await db.uploads.insert_one(doc)
    return {"ok": True, "id": doc["id"]}


@api.post("/public/proof/{tenant}")
async def public_proof(tenant: str, invoice_number: str = Form(...), file: UploadFile = File(...), message: str = Form("")):
    t = _tenant_ok(tenant)
    inv = await db.invoices.find_one({"number": invoice_number, "tenant_id": t})
    if not inv:
        raise HTTPException(404, "Fatura não encontrada")
    data = await file.read()
    doc = {"id": str(uuid.uuid4()), "invoice_id": inv["id"], "invoice_number": invoice_number,
           "tenant_id": t, "filename": file.filename,
           "file_data": "data:" + (file.content_type or "image/png") + ";base64," + base64.b64encode(data).decode(),
           "message": message, "status": "pendente", "created_at": now_iso()}
    await db.proofs.insert_one(doc)
    await db.invoices.update_one({"id": inv["id"]}, {"$set": {"status": "analise", "updated_at": now_iso()},
                                                     "$push": {"status_history": {"status": "analise", "at": now_iso()}}})
    return {"ok": True}


# ================= UPLOADS (CRM) =================
@api.get("/uploads")
async def list_uploads(user: dict = Depends(get_current_user)):
    return await db.uploads.find({"tenant_id": user["tenant_id"]}, {"_id": 0}).sort("created_at", -1).to_list(500)


@api.post("/uploads")
async def create_upload(file: UploadFile = File(...), sender_name: str = Form(""), user: dict = Depends(get_current_user)):
    data = await file.read()
    doc = {"id": str(uuid.uuid4()), "tenant": user["tenant_id"], "tenant_id": user["tenant_id"],
           "filename": file.filename,
           "file_data": "data:" + (file.content_type or "application/octet-stream") + ";base64," + base64.b64encode(data).decode(),
           "sender_name": sender_name or (user.get("name") or ""), "created_at": now_iso()}
    await db.uploads.insert_one(doc)
    await log_history("carregou", "documento", doc["id"], user)
    doc.pop("_id", None)
    return doc


@api.delete("/uploads/{uid}")
async def delete_upload(uid: str, user: dict = Depends(get_current_user)):
    r = await db.uploads.delete_one({"id": uid, "tenant_id": user["tenant_id"]})
    if not r.deleted_count:
        raise HTTPException(404, "Não encontrado")
    return {"ok": True}


# ================= PROOFS =================
@api.get("/proofs")
async def list_proofs(status: str = "", user: dict = Depends(get_current_user)):
    query = {"tenant_id": user["tenant_id"]}
    if status:
        query["status"] = status
    return await db.proofs.find(query, {"_id": 0}).sort("created_at", -1).to_list(500)


@api.post("/proofs")
async def upload_proof(invoice_id: str = Form(...), file: UploadFile = File(...), message: str = Form(""), user: dict = Depends(get_current_user)):
    inv = await db.invoices.find_one({"id": invoice_id, "tenant_id": user["tenant_id"]})
    if not inv:
        raise HTTPException(404, "Fatura não encontrada")
    data = await file.read()
    doc = {"id": str(uuid.uuid4()), "invoice_id": invoice_id, "invoice_number": inv["number"],
           "tenant_id": user["tenant_id"], "filename": file.filename,
           "file_data": "data:" + (file.content_type or "image/png") + ";base64," + base64.b64encode(data).decode(),
           "message": message, "status": "pendente", "created_at": now_iso()}
    await db.proofs.insert_one(doc)
    doc.pop("_id", None)
    doc.pop("file_data", None)
    return doc


@api.get("/proofs/{pid}/file")
async def proof_file(pid: str, user: dict = Depends(get_current_user)):
    p = await db.proofs.find_one({"id": pid, "tenant_id": user["tenant_id"]}, {"_id": 0})
    if not p:
        raise HTTPException(404, "Não encontrado")
    return {"file_data": p["file_data"], "filename": p["filename"]}


@api.patch("/proofs/{pid}")
async def review_proof(pid: str, body: StatusIn, user: dict = Depends(get_current_user)):
    valid = ["pendente", "aceite", "recusado", "pedir_novo"]
    if body.status not in valid:
        raise HTTPException(400, "Estado inválido")
    p = await db.proofs.find_one({"id": pid, "tenant_id": user["tenant_id"]})
    if not p:
        raise HTTPException(404, "Não encontrado")
    await db.proofs.update_one({"id": pid}, {"$set": {"status": body.status}})
    if body.status == "aceite":
        await db.invoices.update_one({"id": p["invoice_id"]}, {"$set": {"status": "pago", "updated_at": now_iso()},
                                     "$push": {"status_history": {"status": "pago", "at": now_iso()}}})
    await log_history(f"comprovativo→{body.status}", "comprovativo", pid, user)
    return {"ok": True}


# ================= CONTRACTS =================
@api.get("/contracts")
async def list_contracts(user: dict = Depends(get_current_user)):
    return await db.contracts.find({"tenant_id": user["tenant_id"]}, {"_id": 0}).sort("created_at", -1).to_list(500)


@api.post("/contracts")
async def create_contract(body: ContractIn, user: dict = Depends(get_current_user)):
    doc = body.model_dump()
    doc.update({"id": str(uuid.uuid4()), "tenant_id": user["tenant_id"], "created_at": now_iso()})
    await db.contracts.insert_one(dict(doc))
    await log_history("criou", "contrato", doc["id"], user)
    doc.pop("_id", None)
    return doc


@api.put("/contracts/{cid}")
async def update_contract(cid: str, body: ContractIn, user: dict = Depends(get_current_user)):
    r = await db.contracts.update_one({"id": cid, "tenant_id": user["tenant_id"]}, {"$set": body.model_dump()})
    if not r.matched_count:
        raise HTTPException(404, "Não encontrado")
    return {"ok": True}


@api.delete("/contracts/{cid}")
async def delete_contract(cid: str, user: dict = Depends(get_current_user)):
    r = await db.contracts.delete_one({"id": cid, "tenant_id": user["tenant_id"]})
    if not r.deleted_count:
        raise HTTPException(404, "Não encontrado")
    return {"ok": True}


# ================= TEMPLATES =================
@api.get("/templates")
async def list_templates(user: dict = Depends(get_current_user)):
    return await db.templates.find({"tenant_id": user["tenant_id"]}, {"_id": 0}).sort("created_at", -1).to_list(500)


@api.post("/templates")
async def create_template(body: TemplateIn, user: dict = Depends(get_current_user)):
    doc = body.model_dump()
    doc.update({"id": str(uuid.uuid4()), "tenant_id": user["tenant_id"], "created_at": now_iso()})
    await db.templates.insert_one(dict(doc))
    doc.pop("_id", None)
    return doc


@api.delete("/templates/{tid}")
async def delete_template(tid: str, user: dict = Depends(get_current_user)):
    r = await db.templates.delete_one({"id": tid, "tenant_id": user["tenant_id"]})
    if not r.deleted_count:
        raise HTTPException(404, "Não encontrado")
    return {"ok": True}


# ================= REPORTS =================
@api.get("/reports")
async def reports(date_from: str = "", date_to: str = "", status: str = "", user: dict = Depends(get_current_user)):
    query = {"tenant_id": user["tenant_id"]}
    if status:
        query["status"] = status
    invs = await db.invoices.find(query, {"_id": 0}).to_list(5000)
    if date_from:
        invs = [i for i in invs if i["created_at"] >= date_from]
    if date_to:
        invs = [i for i in invs if i["created_at"] <= date_to + "T23:59:59"]
    total = sum(i["totals"]["total"] for i in invs)
    return {"count": len(invs), "total": round(total, 2),
            "pago": round(sum(i["totals"]["total"] for i in invs if i["status"] == "pago"), 2),
            "pendente": round(sum(i["totals"]["total"] for i in invs if i["status"] == "pendente"), 2),
            "invoices": invs}


@api.get("/reports/export")
async def export_reports(fmt: str = "csv", status: str = "", user: dict = Depends(get_current_user)):
    query = {"tenant_id": user["tenant_id"]}
    if status:
        query["status"] = status
    invs = await db.invoices.find(query, {"_id": 0}).sort("created_at", -1).to_list(5000)
    rows = [["Número", "Data", "Vencimento", "Cliente", "Estado", "Subtotal", "IVA", "Total", "Moeda"]]
    for i in invs:
        rows.append([i["number"], i["issue_date"][:10], i["due_date"][:16].replace("T", " "),
                     (i.get("recipient") or {}).get("name", ""), i["status"],
                     i["totals"]["subtotal"], i["totals"]["vat"], i["totals"]["total"], i["currency"]])
    if fmt == "xlsx":
        wb = Workbook()
        ws = wb.active
        ws.title = "Faturas"
        for r in rows:
            ws.append(r)
        buf = io.BytesIO()
        wb.save(buf)
        buf.seek(0)
        return StreamingResponse(buf, media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                                 headers={"Content-Disposition": "attachment; filename=relatorio_invest.xlsx"})
    # CSV
    csv = "\n".join(";".join(str(c) for c in r) for r in rows)
    return StreamingResponse(io.BytesIO(csv.encode("utf-8-sig")), media_type="text/csv",
                             headers={"Content-Disposition": "attachment; filename=relatorio_invest.csv"})


# ================= HISTORY =================
@api.get("/history")
async def history(user: dict = Depends(get_current_user)):
    return await db.history.find({"tenant_id": user["tenant_id"]}, {"_id": 0}).sort("at", -1).to_list(500)


# ================= CALCULO =================
def next_friday(date_iso: str) -> str:
    d = datetime.fromisoformat(date_iso.replace("Z", "+00:00")) if "T" in date_iso else datetime.fromisoformat(date_iso)
    days_ahead = (4 - d.weekday()) % 7  # Friday=4
    if days_ahead == 0:
        days_ahead = 0  # same day if Friday
    return (d + timedelta(days=days_ahead)).date().isoformat()


@api.get("/calc/profiles")
async def calc_profiles(user: dict = Depends(get_current_user)):
    profs = await db.calc_profiles.find({"tenant_id": user["tenant_id"]}, {"_id": 0}).sort("created_at", -1).to_list(500)
    for p in profs:
        entries = await db.calc_entries.find({"profile_id": p["id"], "tenant_id": user["tenant_id"]}, {"_id": 0}).sort("date", 1).to_list(500)
        p["entries"] = entries
        p["total_deposit"] = round(sum(e["deposit"] for e in entries), 2)
        p["total_bonus"] = round(sum(e["bonus"] for e in entries), 2)
        p["total"] = round(sum(e["total"] for e in entries), 2)
    return profs


@api.post("/calc/profiles")
async def create_profile(body: CalcProfileIn, user: dict = Depends(get_current_user)):
    doc = {"id": str(uuid.uuid4()), "name": body.name, "tenant_id": user["tenant_id"],
           "status": "ativo", "created_at": now_iso()}
    await db.calc_profiles.insert_one(dict(doc))
    doc.pop("_id", None)
    doc["entries"] = []
    return doc


@api.delete("/calc/profiles/{pid}")
async def delete_profile(pid: str, user: dict = Depends(get_current_user)):
    await db.calc_entries.delete_many({"profile_id": pid, "tenant_id": user["tenant_id"]})
    r = await db.calc_profiles.delete_one({"id": pid, "tenant_id": user["tenant_id"]})
    if not r.deleted_count:
        raise HTTPException(404, "Não encontrado")
    return {"ok": True}


@api.post("/calc/entries")
async def create_entry(body: CalcEntryIn, user: dict = Depends(get_current_user)):
    prof = await db.calc_profiles.find_one({"id": body.profile_id, "tenant_id": user["tenant_id"]})
    if not prof:
        raise HTTPException(404, "Perfil não encontrado")
    bonus = round(body.deposit * 0.20, 2)
    total = round(body.deposit + bonus, 2)
    fri = next_friday(body.date)
    archived = datetime.fromisoformat(fri).date() < datetime.now(timezone.utc).date()
    doc = {"id": str(uuid.uuid4()), "profile_id": body.profile_id, "tenant_id": user["tenant_id"],
           "deposit": round(body.deposit, 2), "date": body.date, "bonus": bonus, "total": total,
           "payment_friday": fri, "status": "arquivado" if archived else "ativo", "created_at": now_iso()}
    await db.calc_entries.insert_one(dict(doc))
    doc.pop("_id", None)
    return doc


@api.delete("/calc/entries/{eid}")
async def delete_entry(eid: str, user: dict = Depends(get_current_user)):
    r = await db.calc_entries.delete_one({"id": eid, "tenant_id": user["tenant_id"]})
    if not r.deleted_count:
        raise HTTPException(404, "Não encontrado")
    return {"ok": True}


@api.get("/calc/export")
async def calc_export(profile_id: str, user: dict = Depends(get_current_user)):
    prof = await db.calc_profiles.find_one({"id": profile_id, "tenant_id": user["tenant_id"]}, {"_id": 0})
    if not prof:
        raise HTTPException(404, "Perfil não encontrado")
    entries = await db.calc_entries.find({"profile_id": profile_id, "tenant_id": user["tenant_id"]}, {"_id": 0}).sort("date", 1).to_list(500)
    wb = Workbook()
    ws = wb.active
    ws.title = "Calculo"
    ws.append([f"Perfil: {prof['name']}"])
    ws.append(["Data", "Depósito (€)", "Bónus 20% (€)", "Total (€)", "Sexta-feira", "Estado"])
    for e in entries:
        ws.append([e["date"][:10], e["deposit"], e["bonus"], e["total"], e["payment_friday"], e["status"]])
    ws.append(["TOTAL", sum(e["deposit"] for e in entries), sum(e["bonus"] for e in entries),
               sum(e["total"] for e in entries), "", ""])
    buf = io.BytesIO()
    wb.save(buf)
    buf.seek(0)
    return StreamingResponse(buf, media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                             headers={"Content-Disposition": f"attachment; filename=calculo_{prof['name']}.xlsx"})


# ================= CRYPTO =================
@api.get("/crypto/market")
async def crypto_market(user: dict = Depends(get_current_user)):
    try:
        market = await crypto.get_market()
    except Exception as e:
        raise HTTPException(502, f"Dados de mercado indisponíveis: {e}")
    glob, fng, stables = await asyncio.gather(
        crypto.get_global(), crypto.get_fng(), crypto.get_stablecoins(),
        return_exceptions=True)
    if isinstance(glob, Exception):
        glob = {"total_market_cap": None, "total_volume": None, "btc_dominance": None,
                "eth_dominance": None, "market_cap_change_24h": None, "active_cryptos": None}
    if isinstance(fng, Exception):
        fng = {"value": None, "classification": None, "available": False}
    if isinstance(stables, Exception):
        stables = []
    return {"market": market, "global": glob, "fear_greed": fng, "stablecoins": stables,
            "updated_at": now_iso(), "sources": crypto_sources()}


def crypto_sources():
    return [
        {"name": "CoinGecko", "type": "Preços/Mercado", "status": "disponivel"},
        {"name": "Alternative.me", "type": "Fear & Greed", "status": "disponivel"},
        {"name": "Cointelegraph", "type": "Notícias", "status": "disponivel"},
        {"name": "Glassnode", "type": "On-chain", "status": "indisponivel"},
        {"name": "Trading Economics", "type": "Macro", "status": "indisponivel"},
        {"name": "TradingView", "type": "Gráficos avançados", "status": "indisponivel"},
        {"name": "Bloomberg", "type": "Macro/Notícias", "status": "indisponivel"},
    ]


@api.get("/crypto/assets/{symbol}")
async def crypto_asset(symbol: str, days: str = "30", user: dict = Depends(get_current_user)):
    try:
        chart = await crypto.get_chart(symbol.upper(), days)
        ind = crypto.compute_indicators(chart["prices"])
        return {"symbol": symbol.upper(), "chart": chart, "indicators": ind}
    except Exception as e:
        raise HTTPException(502, f"Dados indisponíveis nesta fonte: {e}")


@api.get("/crypto/news")
async def crypto_news(user: dict = Depends(get_current_user)):
    news = await crypto.get_news()
    return {"news": news, "available": bool(news), "updated_at": now_iso()}


@api.get("/crypto/sources")
async def crypto_sources_ep(user: dict = Depends(get_current_user)):
    return crypto_sources()


@api.post("/crypto/analysis")
async def crypto_analysis(body: dict, user: dict = Depends(get_current_user)):
    symbol = (body.get("symbol") or "BTC").upper()
    timeframe = body.get("timeframe") or "4h"
    days_map = {"1h": "1", "4h": "7", "1D": "30", "1W": "90", "1M": "365"}
    days = days_map.get(timeframe, "30")
    try:
        chart, market = await asyncio.gather(crypto.get_chart(symbol, days), crypto.get_market([symbol]))
    except Exception as e:
        raise HTTPException(502, f"Dados indisponíveis nesta fonte: {e}")
    glob, fng, stables = await asyncio.gather(
        crypto.get_global(), crypto.get_fng(), crypto.get_stablecoins(), return_exceptions=True)
    glob = {} if isinstance(glob, Exception) else glob
    fng = {"value": None, "classification": None, "available": False} if isinstance(fng, Exception) else fng
    stables = [] if isinstance(stables, Exception) else stables
    ind = crypto.compute_indicators(chart["prices"])
    row = market[0] if market else {}
    scores = crypto.compute_scores(ind, fng, stables, glob.get("market_cap_change_24h"))
    report = await crypto.generate_ai_report(symbol, timeframe, ind, scores, row, glob, fng)
    signal = crypto.signal_distribution(scores["final_score"], scores["confidence"])
    doc = {
        "id": str(uuid.uuid4()), "tenant_id": user["tenant_id"], "asset": symbol,
        "timeframe": timeframe, "technical_score": scores["technical_score"],
        "macro_score": scores["macro_score"], "sentiment_score": scores["sentiment_score"],
        "onchain_score": scores["onchain_score"], "liquidity_score": scores["liquidity_score"],
        "final_score": scores["final_score"], "confidence": scores["confidence"],
        "trend": crypto.trend_label(scores["final_score"]), "indicators": ind,
        "signal": signal, "factors": scores["factors"], "data_notes": scores["data_notes"],
        "report": report, "market": row, "fear_greed": fng,
        "sources": ["CoinGecko", "Alternative.me"] + (["OpenAI GPT-5.4"] if report else []),
        "generated_at": now_iso(),
    }
    await db.crypto_analysis.insert_one(dict(doc))
    doc.pop("_id", None)
    await _create_prediction(user["tenant_id"], symbol, timeframe, signal, row)
    await log_history("gerou análise", "crypto", symbol, user)
    return doc


@api.get("/crypto/analysis/{symbol}")
async def crypto_last_analysis(symbol: str, user: dict = Depends(get_current_user)):
    a = await db.crypto_analysis.find_one({"asset": symbol.upper(), "tenant_id": user["tenant_id"]},
                                          {"_id": 0}, sort=[("generated_at", -1)])
    if not a:
        raise HTTPException(404, "Sem análise")
    return a


@api.get("/crypto/history")
async def crypto_history(user: dict = Depends(get_current_user)):
    return await db.crypto_analysis.find({"tenant_id": user["tenant_id"]},
                                         {"_id": 0, "report": 0}).sort("generated_at", -1).to_list(200)


@api.delete("/crypto/history/{aid}")
async def crypto_delete_analysis(aid: str, user: dict = Depends(get_current_user)):
    r = await db.crypto_analysis.delete_one({"id": aid, "tenant_id": user["tenant_id"]})
    if not r.deleted_count:
        raise HTTPException(404, "Não encontrado")
    return {"ok": True}


@api.get("/crypto/watchlist")
async def get_watchlist(user: dict = Depends(get_current_user)):
    w = await db.crypto_watchlist.find_one({"tenant_id": user["tenant_id"]}, {"_id": 0})
    symbols = w["symbols"] if w else ["BTC", "ETH", "SOL", "BNB", "XRP"]
    try:
        market = await crypto.get_market(symbols)
    except Exception:
        market = []
    return {"symbols": symbols, "market": market}


@api.post("/crypto/watchlist")
async def add_watchlist(body: WatchlistIn, user: dict = Depends(get_current_user)):
    sym = body.symbol.upper()
    w = await db.crypto_watchlist.find_one({"tenant_id": user["tenant_id"]})
    symbols = w["symbols"] if w else ["BTC", "ETH", "SOL", "BNB", "XRP"]
    if sym in crypto.COINS and sym not in symbols:
        symbols.append(sym)
    await db.crypto_watchlist.update_one({"tenant_id": user["tenant_id"]},
                                         {"$set": {"symbols": symbols, "tenant_id": user["tenant_id"]}}, upsert=True)
    return {"symbols": symbols}


@api.delete("/crypto/watchlist/{symbol}")
async def del_watchlist(symbol: str, user: dict = Depends(get_current_user)):
    w = await db.crypto_watchlist.find_one({"tenant_id": user["tenant_id"]})
    symbols = [s for s in (w["symbols"] if w else []) if s != symbol.upper()]
    await db.crypto_watchlist.update_one({"tenant_id": user["tenant_id"]},
                                         {"$set": {"symbols": symbols, "tenant_id": user["tenant_id"]}}, upsert=True)
    return {"symbols": symbols}


# ================= CRYPTO — PREVISÕES & AUTO-APRENDIZAGEM =================
HORIZON_HOURS = {"1h": 1, "4h": 4, "1D": 24, "1W": 168, "1M": 720}


async def _create_prediction(tenant_id, symbol, timeframe, signal, market_row):
    price0 = market_row.get("price") if market_row else None
    if price0 is None:
        return
    target = datetime.now(timezone.utc) + timedelta(hours=HORIZON_HOURS.get(timeframe, 24))
    await db.crypto_predictions.insert_one({
        "id": str(uuid.uuid4()), "tenant_id": tenant_id, "symbol": symbol, "timeframe": timeframe,
        "direction": signal["direction"], "recommendation": signal["recommendation"],
        "price0": price0, "target_at": target.isoformat(), "status": "pending", "created_at": now_iso()})


async def evaluate_predictions():
    now = datetime.now(timezone.utc).isoformat()
    due = await db.crypto_predictions.find({"status": "pending", "target_at": {"$lt": now}}).to_list(200)
    if not due:
        return
    try:
        market = await crypto.get_market(list({p["symbol"] for p in due}))
        prices = {m["symbol"]: m["price"] for m in market}
    except Exception:
        return
    for p in due:
        price1 = prices.get(p["symbol"])
        if price1 is None or not p.get("price0"):
            continue
        change = (price1 / p["price0"] - 1) * 100
        if p["direction"] == "up":
            correct = change > 0.3
        elif p["direction"] == "down":
            correct = change < -0.3
        else:
            correct = abs(change) <= 0.5
        await db.crypto_predictions.update_one({"id": p["id"]}, {"$set": {
            "status": "correct" if correct else "incorrect", "price1": price1,
            "change_pct": round(change, 2), "evaluated_at": now_iso()}})


@api.get("/crypto/accuracy")
async def crypto_accuracy(user: dict = Depends(get_current_user)):
    preds = await db.crypto_predictions.find({"tenant_id": user["tenant_id"]}, {"_id": 0}).sort("created_at", -1).to_list(1000)
    evaluated = [p for p in preds if p["status"] in ("correct", "incorrect")]
    correct = [p for p in evaluated if p["status"] == "correct"]
    from collections import defaultdict
    bysym = defaultdict(lambda: {"evaluated": 0, "correct": 0})
    for p in evaluated:
        bysym[p["symbol"]]["evaluated"] += 1
        if p["status"] == "correct":
            bysym[p["symbol"]]["correct"] += 1
    return {
        "total": len(preds), "pending": len(preds) - len(evaluated),
        "evaluated": len(evaluated), "correct": len(correct),
        "accuracy_pct": round(len(correct) / len(evaluated) * 100) if evaluated else None,
        "by_symbol": [{"symbol": k, **v, "accuracy_pct": round(v["correct"] / v["evaluated"] * 100) if v["evaluated"] else None} for k, v in bysym.items()],
        "recent": preds[:12],
    }


# ================= HEALTH & MONITORING =================
def fmt_uptime(seconds):
    d = int(seconds // 86400)
    h = int((seconds % 86400) // 3600)
    m = int((seconds % 3600) // 60)
    s = int(seconds % 60)
    return f"{d} dias {h:02d}h {m:02d}m {s:02d}s"


@api.get("/health")
async def health():
    db_ok = "ok"
    try:
        await db.command("ping")
    except Exception:
        db_ok = "erro"
    return {"status": "ok", "database": db_ok, "timestamp": now_iso(),
            "uptime": fmt_uptime(time.time() - START_TIME),
            "uptime_seconds": int(time.time() - START_TIME)}


active_ws = set()


@api.get("/monitor/stats")
async def monitor_stats(user: dict = Depends(get_current_user)):
    db_ok = "ok"
    try:
        await db.command("ping")
    except Exception:
        db_ok = "erro"
    return {
        "system": "online", "backend": "online", "api": "operacional", "database": db_ok,
        "connection": "estavel", "uptime": fmt_uptime(time.time() - START_TIME),
        "uptime_seconds": int(time.time() - START_TIME), "online_users": len(active_ws),
        "pending_tasks": await db.proofs.count_documents({"tenant_id": user["tenant_id"], "status": "pendente"}),
        "recent_errors": [], "last_sync": now_iso(),
    }


@app.websocket("/api/ws/monitor")
async def ws_monitor(ws: WebSocket):
    await ws.accept()
    active_ws.add(ws)
    try:
        while True:
            db_ok = "ok"
            try:
                await db.command("ping")
            except Exception:
                db_ok = "erro"
            await ws.send_json({
                "type": "status", "system": "online", "backend": "online",
                "api": "operacional", "database": db_ok, "connection": "estavel",
                "uptime": fmt_uptime(time.time() - START_TIME),
                "uptime_seconds": int(time.time() - START_TIME),
                "online_users": len(active_ws), "last_sync": now_iso(),
            })
            try:
                await asyncio.wait_for(ws.receive_text(), timeout=5.0)
            except asyncio.TimeoutError:
                pass
    except WebSocketDisconnect:
        pass
    except Exception:
        pass
    finally:
        active_ws.discard(ws)


# ---------------- Scheduler ----------------
async def expiration_scheduler():
    while True:
        try:
            now = now_iso()
            cursor = db.invoices.find({"status": "pendente", "due_date": {"$lt": now}})
            async for inv in cursor:
                await db.invoices.update_one({"id": inv["id"]}, {
                    "$set": {"status": "expirado", "updated_at": now},
                    "$push": {"status_history": {"status": "expirado", "at": now}}})
                await db.history.insert_one({
                    "id": str(uuid.uuid4()), "action": "expirou (automático)", "entity": "fatura",
                    "entity_id": inv["number"], "user": "sistema", "tenant_id": inv["tenant_id"], "at": now})
            # auto-archive calc entries past their friday
            today = datetime.now(timezone.utc).date().isoformat()
            await db.calc_entries.update_many(
                {"status": "ativo", "payment_friday": {"$lt": today}},
                {"$set": {"status": "arquivado"}})
            await auto_archive_leads()
            await evaluate_predictions()
        except Exception as e:
            logger.error(f"scheduler error: {e}")
        await asyncio.sleep(60)


async def auto_archive_leads():
    """No início de um novo mês (horário de Portugal), arquiva o mês anterior de cada utilizador."""
    current = lisbon_period()
    state = await db.sys_state.find_one({"_id": "leads_archive"})
    if state and state.get("last_month") == current:
        return
    from datetime import date
    y, m = int(current[:4]), int(current[5:7])
    prev = f"{y - 1}-12" if m == 1 else f"{y}-{m - 1:02d}"
    owners = await db.leads.distinct("owner_id")
    for oid in owners:
        lead = await db.leads.find_one({"owner_id": oid})
        if not lead:
            continue
        tid = lead["tenant_id"]
        exists = await db.lead_archives.find_one({"owner_id": oid, "period": prev})
        if exists:
            continue
        leads = await db.leads.find({"owner_id": oid, "tenant_id": tid}, {"_id": 0}).to_list(5000)
        month_leads = [x for x in leads if lisbon_period(x.get("created_at")) == prev]
        if not month_leads:
            continue
        await db.lead_archives.update_one(
            {"owner_id": oid, "tenant_id": tid, "period": prev},
            {"$set": {"id": str(uuid.uuid4()), "owner_id": oid, "tenant_id": tid, "period": prev,
                      "label": period_label(prev), "stats": compute_lead_stats(month_leads),
                      "leads": month_leads, "generated_at": now_iso(), "auto": True}}, upsert=True)
    await db.sys_state.update_one({"_id": "leads_archive"},
                                  {"$set": {"last_month": current}}, upsert=True)


async def seed():
    await db.users.create_index("email", unique=True)
    await db.invoices.create_index([("tenant_id", 1), ("number", 1)])
    await db.clients.create_index("tenant_id")
    admin_email = os.environ.get("ADMIN_EMAIL", "admin@invest.pt").lower()
    admin_pw = os.environ.get("ADMIN_PASSWORD", "admin123")
    existing = await db.users.find_one({"email": admin_email})
    if not existing:
        await db.users.insert_one({"id": str(uuid.uuid4()), "name": "Administrador INVEST",
                                   "email": admin_email, "password_hash": hash_password(admin_pw),
                                   "role": "admin", "tenant_id": DEFAULT_TENANT, "active": True,
                                   "created_at": now_iso()})
    elif not verify_password(admin_pw, existing["password_hash"]):
        await db.users.update_one({"email": admin_email}, {"$set": {"password_hash": hash_password(admin_pw)}})
    if not await db.users.find_one({"email": "agente@invest.pt"}):
        await db.users.insert_one({"id": str(uuid.uuid4()), "name": "Agente INVEST",
                                   "email": "agente@invest.pt", "password_hash": hash_password("Agente2026!"),
                                   "role": "agente", "tenant_id": DEFAULT_TENANT, "active": True,
                                   "created_at": now_iso()})


@app.on_event("startup")
async def on_startup():
    await seed()
    asyncio.create_task(expiration_scheduler())
    logger.info("INVEST backend iniciado")


@app.on_event("shutdown")
async def on_shutdown():
    client.close()


# ---------------- Leads (acesso individual por utilizador) ----------------
LEAD_STATUSES = ["No Answer", "NA Hot", "Not Interested", "Low Potential", "No Potential", "Duplicate"]
PT_MONTHS = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho",
             "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"]


def lisbon_period(dtiso=None):
    from zoneinfo import ZoneInfo
    tz = ZoneInfo("Europe/Lisbon")
    if dtiso:
        try:
            dt = datetime.fromisoformat(dtiso.replace("Z", "+00:00"))
            if dt.tzinfo is None:
                dt = dt.replace(tzinfo=timezone.utc)
            dt = dt.astimezone(tz)
        except Exception:
            dt = datetime.now(tz)
    else:
        dt = datetime.now(tz)
    return dt.strftime("%Y-%m")


def period_label(period):
    try:
        y, m = period.split("-")
        return f"{PT_MONTHS[int(m) - 1]} {y}"
    except Exception:
        return period


def compute_lead_stats(leads):
    from collections import defaultdict
    funnels = defaultdict(lambda: {"count": 0, "value": 0.0})
    affs = defaultdict(lambda: {"count": 0, "value": 0.0})
    sellers = defaultdict(lambda: {"count": 0, "value": 0.0})
    statuses = defaultdict(int)
    total = 0.0
    for lead in leads:
        v = float(lead.get("value_eur") or 0)
        total += v
        f = (lead.get("funnel") or "—").strip() or "—"
        a = (lead.get("affiliate") or "—").strip() or "—"
        s = (lead.get("seller") or "—").strip() or "—"
        funnels[f]["count"] += 1; funnels[f]["value"] += v
        affs[a]["count"] += 1; affs[a]["value"] += v
        sellers[s]["count"] += 1; sellers[s]["value"] += v
        statuses[lead.get("status") or "—"] += 1
    top = lambda d: sorted([{"name": k, **val} for k, val in d.items()], key=lambda x: (x["value"], x["count"]), reverse=True)
    ta, tf, ts = top(affs), top(funnels), top(sellers)
    win = lambda arr: (arr[0] if arr else None)
    return {"total_leads": len(leads), "total_value": round(total, 2),
            "top_affiliates": ta[:20], "top_funnels": tf[:20], "top_sellers": ts[:20],
            "status_breakdown": [{"status": k, "count": v} for k, v in statuses.items()],
            "best": {"affiliate": win(ta), "funnel": win(tf), "seller": win(ts)},
            "statuses": LEAD_STATUSES}


@api.get("/leads/stats")
async def leads_stats(user: dict = Depends(get_current_user)):
    leads = await db.leads.find({"tenant_id": user["tenant_id"], "owner_id": user["id"]}, {"_id": 0}).to_list(5000)
    return compute_lead_stats(leads)


@api.post("/leads/close-month")
async def close_month(period: str = None, user: dict = Depends(get_current_user)):
    period = period or lisbon_period()
    leads = await db.leads.find({"tenant_id": user["tenant_id"], "owner_id": user["id"]}, {"_id": 0}).to_list(5000)
    month_leads = [lead for lead in leads if lisbon_period(lead.get("created_at")) == period]
    stats = compute_lead_stats(month_leads)
    doc = {"id": str(uuid.uuid4()), "tenant_id": user["tenant_id"], "owner_id": user["id"],
           "period": period, "label": period_label(period), "stats": stats,
           "leads": month_leads, "generated_at": now_iso()}
    await db.lead_archives.update_one(
        {"owner_id": user["id"], "tenant_id": user["tenant_id"], "period": period},
        {"$set": doc}, upsert=True)
    doc.pop("_id", None)
    await log_history("encerrou o mês", "leads", period, user)
    return doc


@api.get("/leads/archives")
async def list_lead_archives(user: dict = Depends(get_current_user)):
    return await db.lead_archives.find(
        {"tenant_id": user["tenant_id"], "owner_id": user["id"]},
        {"_id": 0, "leads": 0}).sort("period", -1).to_list(60)


@api.get("/leads/archives/{period}")
async def get_lead_archive(period: str, user: dict = Depends(get_current_user)):
    a = await db.lead_archives.find_one(
        {"tenant_id": user["tenant_id"], "owner_id": user["id"], "period": period}, {"_id": 0})
    if not a:
        raise HTTPException(404, "Não encontrado")
    return a


@api.get("/leads/export")
async def export_leads(period: str = None, user: dict = Depends(get_current_user)):
    if period:
        arch = await db.lead_archives.find_one(
            {"tenant_id": user["tenant_id"], "owner_id": user["id"], "period": period}, {"_id": 0})
        leads = arch["leads"] if arch else []
        stats = arch["stats"] if arch else compute_lead_stats(leads)
        fname = f"leads_{period}.xlsx"
    else:
        leads = await db.leads.find({"tenant_id": user["tenant_id"], "owner_id": user["id"]},
                                    {"_id": 0}).sort("created_at", -1).to_list(5000)
        stats = compute_lead_stats(leads)
        fname = "leads.xlsx"
    wb = Workbook()
    ws = wb.active
    ws.title = "Leads"
    ws.append(["Nome", "Vendedor", "Valor (EUR)", "Affiliate", "Funil", "Tipo", "Status", "Criado (PT)"])
    for lead in leads:
        ws.append([lead.get("name", ""), lead.get("seller", ""), float(lead.get("value_eur") or 0),
                   lead.get("affiliate", ""), lead.get("funnel", ""), lead.get("type", ""),
                   lead.get("status", ""), (lead.get("created_at", "") or "")[:10]])
    ws2 = wb.create_sheet("Resumo e Gráficos")
    state = {"row": 1}

    def section(title, arr):
        r0 = state["row"]
        ws2.cell(row=r0, column=1, value=title)
        hdr = r0 + 1
        ws2.cell(row=hdr, column=1, value="Nome")
        ws2.cell(row=hdr, column=2, value="Quantidade")
        ws2.cell(row=hdr, column=3, value="Valor (EUR)")
        ds = hdr + 1
        for it in arr:
            ws2.cell(row=state_row(ds, arr, it), column=1, value=it["name"])
        # write rows explicitly
        rr = ds
        for it in arr:
            ws2.cell(row=rr, column=1, value=it["name"])
            ws2.cell(row=rr, column=2, value=it["count"])
            ws2.cell(row=rr, column=3, value=round(it["value"], 2))
            rr += 1
        de = rr - 1
        if arr:
            pie = PieChart()
            pie.title = title
            pie.height = 6.5
            pie.width = 11
            labels = Reference(ws2, min_col=1, min_row=ds, max_row=de)
            data = Reference(ws2, min_col=3, min_row=hdr, max_row=de)
            pie.add_data(data, titles_from_data=True)
            pie.set_categories(labels)
            ws2.add_chart(pie, f"E{hdr}")
        state["row"] = max(rr, hdr + 15) + 2

    def state_row(ds, arr, it):
        return ds  # placeholder (unused)

    section("Affiliates mais vendidos", stats.get("top_affiliates", []))
    section("Funis mais vendidos", stats.get("top_funnels", []))
    section("Vendedores mais vendidos", stats.get("top_sellers", []))
    buf = io.BytesIO()
    wb.save(buf)
    buf.seek(0)
    return StreamingResponse(buf, media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                             headers={"Content-Disposition": f"attachment; filename={fname}"})


@api.get("/leads")
async def list_leads(status: str = None, funnel: str = None, affiliate: str = None, user: dict = Depends(get_current_user)):
    q = {"tenant_id": user["tenant_id"], "owner_id": user["id"]}
    if status:
        q["status"] = status
    if funnel:
        q["funnel"] = funnel
    if affiliate:
        q["affiliate"] = affiliate
    return await db.leads.find(q, {"_id": 0}).sort("created_at", -1).to_list(1000)


@api.post("/leads")
async def create_lead(body: dict, user: dict = Depends(get_current_user)):
    doc = {
        "id": str(uuid.uuid4()), "tenant_id": user["tenant_id"], "owner_id": user["id"], "owner_name": user["name"],
        "name": body.get("name", ""), "seller": body.get("seller", ""), "value_eur": float(body.get("value_eur") or 0),
        "affiliate": body.get("affiliate", ""), "funnel": body.get("funnel", ""),
        "type": body.get("type", "Novo"), "status": body.get("status", "No Answer"),
        "created_at": now_iso(), "updated_at": now_iso(),
    }
    await db.leads.insert_one(dict(doc))
    doc.pop("_id", None)
    await log_history("criou lead", "lead", doc["name"], user)
    return doc


@api.put("/leads/{lid}")
async def update_lead(lid: str, body: dict, user: dict = Depends(get_current_user)):
    fields = {k: body[k] for k in ["name", "seller", "value_eur", "affiliate", "funnel", "type", "status"] if k in body}
    if "value_eur" in fields:
        fields["value_eur"] = float(fields["value_eur"] or 0)
    fields["updated_at"] = now_iso()
    r = await db.leads.update_one({"id": lid, "owner_id": user["id"], "tenant_id": user["tenant_id"]}, {"$set": fields})
    if not r.matched_count:
        raise HTTPException(404, "Não encontrado")
    return await db.leads.find_one({"id": lid}, {"_id": 0})


@api.delete("/leads/{lid}")
async def delete_lead(lid: str, user: dict = Depends(get_current_user)):
    r = await db.leads.delete_one({"id": lid, "owner_id": user["id"], "tenant_id": user["tenant_id"]})
    if not r.deleted_count:
        raise HTTPException(404, "Não encontrado")
    return {"ok": True}


# ---------------- Crypto público (sem autenticação) ----------------
@api.get("/public/crypto/market")
async def public_crypto_market():
    try:
        market = await crypto.get_market()
    except Exception as e:
        raise HTTPException(502, f"Dados de mercado indisponíveis: {e}")
    glob, fng, stables = await asyncio.gather(
        crypto.get_global(), crypto.get_fng(), crypto.get_stablecoins(), return_exceptions=True)
    glob = {} if isinstance(glob, Exception) else glob
    fng = {"value": None, "classification": None, "available": False} if isinstance(fng, Exception) else fng
    stables = [] if isinstance(stables, Exception) else stables
    return {"market": market, "global": glob, "fear_greed": fng, "stablecoins": stables,
            "updated_at": now_iso(), "sources": crypto_sources()}


@api.get("/public/crypto/assets/{symbol}")
async def public_crypto_asset(symbol: str, days: str = "30"):
    try:
        chart = await crypto.get_chart(symbol.upper(), days)
        return {"symbol": symbol.upper(), "chart": chart, "indicators": crypto.compute_indicators(chart["prices"])}
    except Exception as e:
        raise HTTPException(502, f"Dados indisponíveis nesta fonte: {e}")


@api.get("/public/crypto/news")
async def public_crypto_news():
    news = await crypto.get_news()
    return {"news": news, "available": bool(news), "updated_at": now_iso()}


@api.post("/public/crypto/analysis")
async def public_crypto_analysis(body: dict):
    symbol = (body.get("symbol") or "BTC").upper()
    timeframe = body.get("timeframe") or "4h"
    days = {"1h": "1", "4h": "7", "1D": "30", "1W": "90", "1M": "365"}.get(timeframe, "30")
    try:
        chart, market = await asyncio.gather(crypto.get_chart(symbol, days), crypto.get_market([symbol]))
    except Exception as e:
        raise HTTPException(502, f"Dados indisponíveis nesta fonte: {e}")
    glob, fng, stables = await asyncio.gather(
        crypto.get_global(), crypto.get_fng(), crypto.get_stablecoins(), return_exceptions=True)
    glob = {} if isinstance(glob, Exception) else glob
    fng = {"value": None, "classification": None, "available": False} if isinstance(fng, Exception) else fng
    stables = [] if isinstance(stables, Exception) else stables
    ind = crypto.compute_indicators(chart["prices"])
    row = market[0] if market else {}
    scores = crypto.compute_scores(ind, fng, stables, glob.get("market_cap_change_24h"))
    report = await crypto.generate_ai_report(symbol, timeframe, ind, scores, row, glob, fng)
    return {"asset": symbol, "timeframe": timeframe, **scores,
            "trend": crypto.trend_label(scores["final_score"]), "indicators": ind,
            "signal": crypto.signal_distribution(scores["final_score"], scores["confidence"]),
            "report": report, "market": row, "fear_greed": fng, "generated_at": now_iso()}


# ================= CRYPTO.INVEST — SUPORTE REMOTO (co-browsing) =================
_turn_user = os.environ.get("TURN_USERNAME", "openrelayproject")
_turn_cred = os.environ.get("TURN_CREDENTIAL", "openrelayproject")
ICE_SERVERS = [
    {"urls": ["stun:stun.l.google.com:19302", "stun:stun.relay.metered.ca:80"]},
    {"urls": ["turn:openrelay.metered.ca:80", "turn:openrelay.metered.ca:443",
              "turns:openrelay.metered.ca:443?transport=tcp"],
     "username": "openrelayproject", "credential": "openrelayproject"},
    {"urls": ["turn:global.relay.metered.ca:80", "turns:global.relay.metered.ca:443?transport=tcp"],
     "username": _turn_user, "credential": _turn_cred},
]
support_rooms: dict = {}


class ConnectIn(BaseModel):
    device_id: str
    device_name: str = ""


@api.post("/public/support/connect")
async def public_support_connect(body: ConnectIn):
    """Cliente auto-regista o dispositivo — sem login. Reconhece o mesmo aparelho pelo device_id."""
    tenant = DEFAULT_TENANT
    name = (body.device_name or "Aparelho").strip()[:60] or "Aparelho"
    existing = await db.support_sessions.find_one(
        {"device_id": body.device_id, "tenant_id": tenant}, {"_id": 0})
    if existing:
        await db.support_sessions.update_one(
            {"code": existing["code"]},
            {"$set": {"status": "waiting", "last_seen": now_iso(), "ended_at": None}})
        return {"code": existing["code"]}
    code = uuid.uuid4().hex[:8]
    doc = {"id": str(uuid.uuid4()), "code": code, "tenant_id": tenant,
           "owner_id": None, "owner_name": None, "assigned_to": None, "assigned_name": None,
           "device_id": body.device_id, "client_name": name, "device_name": name,
           "source": "device", "status": "waiting", "created_at": now_iso(),
           "last_seen": now_iso(), "ended_at": None}
    await db.support_sessions.insert_one(dict(doc))
    return {"code": code}


@api.get("/support/ice")
async def support_ice():
    return {"iceServers": ICE_SERVERS}


@api.get("/support/agents")
async def support_agents(user: dict = Depends(require_roles("admin"))):
    return await db.users.find(
        {"tenant_id": user["tenant_id"], "role": {"$in": ["agente", "admin"]}},
        {"_id": 0, "id": 1, "name": 1, "email": 1, "role": 1}).to_list(500)


@api.post("/support/sessions")
async def create_support_session(client_name: str = "", assigned_to: str = "", user: dict = Depends(get_current_user)):
    aid, aname = user["id"], user["name"]
    if assigned_to and user["role"] == "admin":
        target = await db.users.find_one({"id": assigned_to, "tenant_id": user["tenant_id"]}, {"_id": 0})
        if not target:
            raise HTTPException(404, "Agente não encontrado")
        aid, aname = target["id"], target["name"]
    doc = {"id": str(uuid.uuid4()), "code": uuid.uuid4().hex[:8], "tenant_id": user["tenant_id"],
           "owner_id": user["id"], "owner_name": user["name"], "assigned_to": aid, "assigned_name": aname,
           "client_name": client_name, "device_name": client_name or "Aparelho",
           "status": "waiting", "created_at": now_iso(), "ended_at": None}
    await db.support_sessions.insert_one(dict(doc))
    doc.pop("_id", None)
    return doc


@api.get("/support/sessions")
async def list_support_sessions(user: dict = Depends(get_current_user)):
    if user["role"] == "admin":
        q = {"tenant_id": user["tenant_id"]}
    else:
        q = {"tenant_id": user["tenant_id"], "$or": [{"owner_id": user["id"]}, {"assigned_to": user["id"]}]}
    return await db.support_sessions.find(q, {"_id": 0}).sort("created_at", -1).to_list(200)


async def _session_for_user(code: str, user: dict) -> dict:
    q = {"code": code, "tenant_id": user["tenant_id"]}
    if user["role"] != "admin":
        q["$or"] = [{"owner_id": user["id"]}, {"assigned_to": user["id"]}]
    s = await db.support_sessions.find_one(q, {"_id": 0})
    if not s:
        raise HTTPException(404, "Sessão não encontrada")
    return s


@api.post("/support/sessions/{code}/end")
async def end_support_session(code: str, user: dict = Depends(get_current_user)):
    await _session_for_user(code, user)
    await db.support_sessions.update_one(
        {"code": code, "tenant_id": user["tenant_id"]},
        {"$set": {"status": "ended", "ended_at": now_iso()}})
    return {"ok": True}


@api.patch("/support/sessions/{code}/rename")
async def rename_support_session(code: str, device_name: str = "", user: dict = Depends(get_current_user)):
    await _session_for_user(code, user)
    await db.support_sessions.update_one(
        {"code": code, "tenant_id": user["tenant_id"]},
        {"$set": {"device_name": (device_name or "Aparelho").strip()[:60]}})
    return {"ok": True}


@api.post("/support/sessions/{code}/assign")
async def assign_support_session(code: str, assigned_to: str = "", user: dict = Depends(require_roles("admin"))):
    target = await db.users.find_one({"id": assigned_to, "tenant_id": user["tenant_id"]}, {"_id": 0})
    if not target:
        raise HTTPException(404, "Agente não encontrado")
    await db.support_sessions.update_one(
        {"code": code, "tenant_id": user["tenant_id"]},
        {"$set": {"assigned_to": target["id"], "assigned_name": target["name"]}})
    return {"ok": True}


@api.delete("/support/sessions/{code}")
async def delete_support_session(code: str, user: dict = Depends(get_current_user)):
    await _session_for_user(code, user)
    await db.support_sessions.delete_one({"code": code, "tenant_id": user["tenant_id"]})
    return {"ok": True}


@api.get("/public/support/{code}")
async def public_support(code: str):
    s = await db.support_sessions.find_one({"code": code}, {"_id": 0, "owner_id": 0, "tenant_id": 0})
    if not s:
        raise HTTPException(404, "Sessão não encontrada")
    return {"code": code, "status": s["status"], "owner_name": s.get("owner_name")}


@app.websocket("/api/ws/support/{code}")
async def ws_support(ws: WebSocket, code: str):
    await ws.accept()
    role = ws.query_params.get("role", "client")
    room = support_rooms.setdefault(code, [])
    peer = {"ws": ws, "role": role}
    room.append(peer)
    if role == "client":
        await db.support_sessions.update_one({"code": code}, {"$set": {"status": "active"}})
    for p in room:
        if p is not peer:
            try:
                await p["ws"].send_json({"type": "peer-joined", "role": role})
                await ws.send_json({"type": "peer-joined", "role": p["role"]})
            except Exception:
                pass
    try:
        while True:
            data = await ws.receive_json()
            for p in room:
                if p is not peer:
                    try:
                        await p["ws"].send_json(data)
                    except Exception:
                        pass
    except WebSocketDisconnect:
        pass
    except Exception:
        pass
    finally:
        if peer in room:
            room.remove(peer)
        for p in room:
            try:
                await p["ws"].send_json({"type": "peer-left", "role": role})
            except Exception:
                pass
        if not room:
            support_rooms.pop(code, None)


app.include_router(api)
app.add_middleware(
    CORSMiddleware,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)
