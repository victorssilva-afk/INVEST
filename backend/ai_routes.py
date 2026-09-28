"""Assistente IA do CRM INVEST — chat multi-modelo, geração de imagens (Nano Banana)
e geração de conteúdo estruturado para PDFs profissionais.

Registado a partir de server.py via register_ai_routes(api, db, get_current_user),
reutilizando o router /api, a ligação Mongo e a autenticação existentes.
"""
import os
import json
import uuid
from datetime import datetime, timezone
from typing import Optional, List

from fastapi import Depends, HTTPException
from pydantic import BaseModel
from emergentintegrations.llm.chat import LlmChat, UserMessage, ImageContent

EMERGENT_LLM_KEY = os.environ.get("EMERGENT_LLM_KEY")

CHAT_MODELS = {
    "gpt-5.4": ("openai", "gpt-5.4"),
    "claude-sonnet-4-6": ("anthropic", "claude-sonnet-4-6"),
    "gemini-3-flash-preview": ("gemini", "gemini-3-flash-preview"),
}
DEFAULT_MODEL = "gpt-5.4"
IMAGE_MODEL = ("gemini", "gemini-3.1-flash-image-preview")


def _now():
    return datetime.now(timezone.utc).isoformat()


class SessionIn(BaseModel):
    title: Optional[str] = None


class ChatIn(BaseModel):
    session_id: str
    message: str
    model: Optional[str] = None


class ImageIn(BaseModel):
    prompt: str
    session_id: Optional[str] = None
    images: Optional[List[str]] = None


class PdfIn(BaseModel):
    brief: str
    doc_type: Optional[str] = "geral"
    model: Optional[str] = None


def register_ai_routes(api, db, get_current_user):

    async def _get_session(sid, user):
        s = await db.ai_sessions.find_one({"id": sid, "user_id": user["id"]}, {"_id": 0})
        if not s:
            raise HTTPException(404, "Conversa não encontrada")
        return s

    async def _save_msg(sid, role, content, kind="text", extra=None):
        m = {"id": str(uuid.uuid4()), "session_id": sid, "role": role,
             "content": content, "kind": kind, "at": _now()}
        if extra:
            m.update(extra)
        await db.ai_messages.insert_one(dict(m))
        await db.ai_sessions.update_one({"id": sid}, {"$set": {"updated_at": _now()}})
        m.pop("_id", None)
        return m

    @api.get("/ai/models")
    async def models(user=Depends(get_current_user)):
        return {"chat": list(CHAT_MODELS.keys()), "default": DEFAULT_MODEL}

    @api.post("/ai/sessions")
    async def create_session(body: SessionIn, user=Depends(get_current_user)):
        doc = {"id": str(uuid.uuid4()), "user_id": user["id"], "tenant_id": user["tenant_id"],
               "title": (body.title or "Nova conversa")[:80], "created_at": _now(), "updated_at": _now()}
        await db.ai_sessions.insert_one(dict(doc))
        doc.pop("_id", None)
        return doc

    @api.get("/ai/sessions")
    async def list_sessions(user=Depends(get_current_user)):
        return await db.ai_sessions.find({"user_id": user["id"]}, {"_id": 0}).sort("updated_at", -1).to_list(200)

    @api.get("/ai/sessions/{sid}")
    async def get_session(sid: str, user=Depends(get_current_user)):
        s = await _get_session(sid, user)
        msgs = await db.ai_messages.find({"session_id": sid}, {"_id": 0}).sort("at", 1).to_list(1000)
        return {"session": s, "messages": msgs}

    @api.delete("/ai/sessions/{sid}")
    async def delete_session(sid: str, user=Depends(get_current_user)):
        await _get_session(sid, user)
        await db.ai_messages.delete_many({"session_id": sid})
        await db.ai_sessions.delete_one({"id": sid})
        return {"ok": True}

    @api.post("/ai/chat")
    async def chat(body: ChatIn, user=Depends(get_current_user)):
        if not EMERGENT_LLM_KEY:
            raise HTTPException(500, "Chave de IA não configurada")
        s = await _get_session(body.session_id, user)
        provider, model = CHAT_MODELS.get(body.model or DEFAULT_MODEL, CHAT_MODELS[DEFAULT_MODEL])
        history = await db.ai_messages.find(
            {"session_id": body.session_id, "kind": "text"}, {"_id": 0}
        ).sort("at", 1).to_list(40)
        transcript = "\n".join(
            f"{'Utilizador' if h['role'] == 'user' else 'Assistente'}: {h['content']}" for h in history[-16:]
        )
        system = ("És o Assistente IA do CRM INVEST (Financeiro & Jurídico), em português de Portugal. "
                  "És profissional, claro e objetivo. Ajudas a redigir propostas comerciais, contratos e "
                  "documentos, a responder a clientes e a organizar informação.")
        if transcript:
            system += "\n\nConversa até agora:\n" + transcript
        await _save_msg(body.session_id, "user", body.message)
        try:
            llm = LlmChat(api_key=EMERGENT_LLM_KEY, session_id=body.session_id, system_message=system).with_model(provider, model)
            reply = await llm.send_message(UserMessage(text=body.message))
        except Exception as e:
            raise HTTPException(502, f"Falha da IA: {e}")
        saved = await _save_msg(body.session_id, "assistant", reply, extra={"model": body.model or DEFAULT_MODEL})
        if s.get("title") in (None, "", "Nova conversa"):
            await db.ai_sessions.update_one({"id": body.session_id}, {"$set": {"title": body.message[:60]}})
        return {"reply": reply, "message": saved}

    @api.post("/ai/image")
    async def gen_image(body: ImageIn, user=Depends(get_current_user)):
        if not EMERGENT_LLM_KEY:
            raise HTTPException(500, "Chave de IA não configurada")
        try:
            llm = LlmChat(api_key=EMERGENT_LLM_KEY, session_id=body.session_id or str(uuid.uuid4()),
                          system_message="És um gerador e editor de imagens profissional.").with_model(*IMAGE_MODEL).with_params(modalities=["image", "text"])
            file_contents = []
            for im in (body.images or [])[:8]:
                b64 = im.split(",", 1)[1] if isinstance(im, str) and im.startswith("data:") else im
                if b64:
                    file_contents.append(ImageContent(image_base64=b64))
            um = UserMessage(text=body.prompt, file_contents=file_contents or None)
            _text, images = await llm.send_message_multimodal_response(um)
        except Exception as e:
            raise HTTPException(502, f"Falha ao gerar imagem: {e}")
        if not images:
            raise HTTPException(502, "Nenhuma imagem gerada")
        img = images[0]
        data_url = f"data:{img['mime_type']};base64,{img['data']}"
        saved = None
        if body.session_id:
            saved = await _save_msg(body.session_id, "assistant", data_url, kind="image", extra={"prompt": body.prompt})
        return {"image": data_url, "message": saved}

    @api.post("/ai/pdf-content")
    async def pdf_content(body: PdfIn, user=Depends(get_current_user)):
        if not EMERGENT_LLM_KEY:
            raise HTTPException(500, "Chave de IA não configurada")
        provider, model = CHAT_MODELS.get(body.model or DEFAULT_MODEL, CHAT_MODELS[DEFAULT_MODEL])
        schema = ('{"title": str, "subtitle": str, "date": "dd/mm/aaaa", '
                  '"from": {"name": str, "detail": str}, "to": {"name": str, "detail": str}, '
                  '"intro": str, "sections": [{"heading": str, "body": str}], '
                  '"items": [{"description": str, "qty": number, "unit_price": number}], '
                  '"currency": "EUR", "notes": str, "signature": str}')
        system = ("És um redator profissional de documentos jurídicos e comerciais em português de Portugal. "
                  f"Vais gerar o conteúdo de um documento do tipo '{body.doc_type}'. "
                  "Responde APENAS com JSON válido, sem markdown e sem blocos de código, exatamente neste formato: "
                  f"{schema}. Inclui 'items' apenas quando fizer sentido (propostas/orçamentos); caso contrário usa lista vazia. "
                  "Escreve texto rico e bem estruturado nas 'sections'. Usa a data de hoje se não for indicada.")
        try:
            llm = LlmChat(api_key=EMERGENT_LLM_KEY, session_id=str(uuid.uuid4()), system_message=system).with_model(provider, model)
            raw = await llm.send_message(UserMessage(text=body.brief))
        except Exception as e:
            raise HTTPException(502, f"Falha da IA: {e}")
        txt = (raw or "").strip()
        if txt.startswith("```"):
            txt = txt.strip("`")
            if txt[:4].lower() == "json":
                txt = txt[4:]
        try:
            start = txt.index("{")
            end = txt.rindex("}") + 1
            data = json.loads(txt[start:end])
        except Exception:
            data = {"title": "Documento", "subtitle": "", "sections": [{"heading": "Conteúdo", "body": raw or ""}], "items": []}
        data.setdefault("currency", "EUR")
        data.setdefault("items", [])
        data.setdefault("sections", [])
        return {"content": data, "doc_type": body.doc_type}
