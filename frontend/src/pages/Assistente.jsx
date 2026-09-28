import { useEffect, useRef, useState, forwardRef } from "react";
import api from "@/lib/api";
import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";
import { toast } from "sonner";
import {
  Sparkles, Plus, Send, Image as ImageIcon, FileText, Trash2,
  Loader2, Download, Printer, MessageSquare, Wand2,
} from "lucide-react";

const CHAT_MODELS = [
  { id: "gpt-5.4", label: "GPT-5.4 (OpenAI)" },
  { id: "claude-sonnet-4-6", label: "Claude Sonnet 4.6" },
  { id: "gemini-3-flash-preview", label: "Gemini 3 Flash" },
];
const DOC_TYPES = [
  { id: "proposta", label: "Proposta comercial / Orçamento" },
  { id: "contrato", label: "Contrato / Documento jurídico" },
  { id: "carta", label: "Carta / Comunicação formal" },
  { id: "geral", label: "Uso geral" },
];

const eur = (n) => new Intl.NumberFormat("pt-PT", { style: "currency", currency: "EUR" }).format(Number(n || 0));

export default function Assistente() {
  const [tab, setTab] = useState("chat");
  return (
    <div className="space-y-6" data-testid="assistente-page">
      <div className="flex flex-col gap-1">
        <h1 className="flex items-center gap-2 font-head text-3xl font-extrabold text-[#0B1A30]">
          <Sparkles className="text-[#D4AF37]" /> Assistente IA
        </h1>
        <p className="text-sm text-slate-500">Converse, gere imagens e crie PDFs profissionais com design moderno.</p>
      </div>

      <div className="flex gap-2">
        <TabBtn active={tab === "chat"} onClick={() => setTab("chat")} icon={MessageSquare} label="Conversa" testid="tab-chat" />
        <TabBtn active={tab === "pdf"} onClick={() => setTab("pdf")} icon={FileText} label="Gerar PDF" testid="tab-pdf" />
      </div>

      {tab === "chat" ? <ChatTab /> : <PdfTab />}
    </div>
  );
}

const TabBtn = ({ active, onClick, icon: Icon, label, testid }) => (
  <button onClick={onClick} data-testid={testid}
    className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-bold transition-all ${active ? "bg-[#0B1A30] text-white" : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200"}`}>
    <Icon size={16} /> {label}
  </button>
);

/* ---------------- CHAT ---------------- */
function ChatTab() {
  const [sessions, setSessions] = useState([]);
  const [active, setActive] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [model, setModel] = useState("gpt-5.4");
  const [busy, setBusy] = useState(false);
  const [imgMode, setImgMode] = useState(false);
  const endRef = useRef(null);

  const loadSessions = () => api.get("/ai/sessions").then((r) => setSessions(r.data)).catch(() => {});
  useEffect(() => { loadSessions(); }, []);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, busy]);

  const openSession = async (sid) => {
    setActive(sid);
    const r = await api.get(`/ai/sessions/${sid}`);
    setMessages(r.data.messages || []);
  };

  const newSession = async () => {
    const r = await api.post("/ai/sessions", { title: "Nova conversa" });
    setSessions((s) => [r.data, ...s]);
    setActive(r.data.id); setMessages([]);
  };

  const delSession = async (sid, e) => {
    e.stopPropagation();
    await api.delete(`/ai/sessions/${sid}`);
    setSessions((s) => s.filter((x) => x.id !== sid));
    if (active === sid) { setActive(null); setMessages([]); }
  };

  const ensureSession = async () => {
    if (active) return active;
    const r = await api.post("/ai/sessions", { title: "Nova conversa" });
    setSessions((s) => [r.data, ...s]); setActive(r.data.id);
    return r.data.id;
  };

  const send = async () => {
    const text = input.trim();
    if (!text || busy) return;
    setInput(""); setBusy(true);
    const sid = await ensureSession();
    setMessages((m) => [...m, { id: `tmp-${Date.now()}`, role: "user", kind: "text", content: text }]);
    try {
      if (imgMode) {
        const r = await api.post("/ai/image", { prompt: text, session_id: sid });
        setMessages((m) => [...m, r.data.message]);
      } else {
        const r = await api.post("/ai/chat", { session_id: sid, message: text, model });
        setMessages((m) => [...m, r.data.message]);
      }
      loadSessions();
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Falha ao contactar a IA");
      setMessages((m) => [...m, { id: `err-${Date.now()}`, role: "assistant", kind: "text", content: "⚠️ Não foi possível responder agora. Tente novamente." }]);
    } finally { setBusy(false); }
  };

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[260px_1fr]">
      {/* Sessions */}
      <div className="rounded-xl border border-slate-200 bg-white p-3">
        <button onClick={newSession} data-testid="new-chat-btn"
          className="mb-3 flex w-full items-center justify-center gap-2 rounded-lg bg-[#D4AF37] py-2.5 text-sm font-bold text-[#0B1A30] hover:brightness-105">
          <Plus size={16} /> Nova conversa
        </button>
        <div className="space-y-1 max-h-[60vh] overflow-y-auto" data-testid="session-list">
          {sessions.length === 0 && <p className="px-2 py-4 text-center text-xs text-slate-400">Sem conversas ainda.</p>}
          {sessions.map((s) => (
            <div key={s.id} onClick={() => openSession(s.id)} data-testid={`session-${s.id}`}
              className={`group flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-sm ${active === s.id ? "bg-[#0B1A30] text-white" : "text-slate-600 hover:bg-slate-100"}`}>
              <MessageSquare size={14} className="shrink-0 opacity-70" />
              <span className="min-w-0 flex-1 truncate">{s.title}</span>
              <button onClick={(e) => delSession(s.id, e)} data-testid={`del-session-${s.id}`} className="opacity-0 group-hover:opacity-100 hover:text-red-400"><Trash2 size={14} /></button>
            </div>
          ))}
        </div>
      </div>

      {/* Conversation */}
      <div className="flex min-h-[62vh] flex-col rounded-xl border border-slate-200 bg-white">
        <div className="flex-1 space-y-4 overflow-y-auto p-4 max-h-[58vh]" data-testid="messages">
          {messages.length === 0 && (
            <div className="grid h-full place-items-center text-center text-slate-400">
              <div>
                <Wand2 className="mx-auto mb-3 text-[#D4AF37]" size={34} />
                <p className="text-sm">Comece a conversar ou ative o modo imagem para gerar visuais.</p>
              </div>
            </div>
          )}
          {messages.map((m) => (
            <div key={m.id} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm ${m.role === "user" ? "bg-[#0B1A30] text-white" : "bg-slate-100 text-[#0B1A30]"}`}>
                {m.kind === "image"
                  ? <img src={m.content} alt="gerada" className="max-h-80 rounded-lg" data-testid="chat-image" />
                  : <div className="whitespace-pre-wrap leading-relaxed">{m.content}</div>}
              </div>
            </div>
          ))}
          {busy && <div className="flex justify-start"><div className="flex items-center gap-2 rounded-2xl bg-slate-100 px-4 py-2.5 text-sm text-slate-500"><Loader2 size={16} className="animate-spin" /> A pensar…</div></div>}
          <div ref={endRef} />
        </div>

        <div className="border-t border-slate-200 p-3">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <select value={model} onChange={(e) => setModel(e.target.value)} disabled={imgMode} data-testid="model-select"
              className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs font-medium text-slate-700 disabled:opacity-50">
              {CHAT_MODELS.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
            </select>
            <button onClick={() => setImgMode((v) => !v)} data-testid="img-mode-toggle"
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold ${imgMode ? "bg-[#D4AF37] text-[#0B1A30]" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}>
              <ImageIcon size={14} /> {imgMode ? "Modo imagem ON" : "Gerar imagem"}
            </button>
          </div>
          <div className="flex items-end gap-2">
            <textarea value={input} onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
              rows={2} data-testid="chat-input" placeholder={imgMode ? "Descreva a imagem a gerar…" : "Escreva a sua mensagem…"}
              className="flex-1 resize-none rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-[#D4AF37] focus:outline-none" />
            <button onClick={send} disabled={busy || !input.trim()} data-testid="send-btn"
              className="grid h-10 w-10 place-items-center rounded-lg bg-[#0B1A30] text-white hover:bg-[#152a4a] disabled:opacity-50">
              {busy ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------------- PDF ---------------- */
function PdfTab() {
  const [docType, setDocType] = useState("proposta");
  const [model, setModel] = useState("gpt-5.4");
  const [brief, setBrief] = useState("");
  const [busy, setBusy] = useState(false);
  const [doc, setDoc] = useState(null);
  const previewRef = useRef(null);

  const generate = async () => {
    if (!brief.trim() || busy) return;
    setBusy(true);
    try {
      const r = await api.post("/ai/pdf-content", { brief: brief.trim(), doc_type: docType, model });
      setDoc(r.data.content);
      toast.success("Documento gerado. Reveja e exporte em PDF.");
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Falha ao gerar o documento");
    } finally { setBusy(false); }
  };

  const downloadPdf = async () => {
    const node = previewRef.current;
    if (!node) return;
    toast.message("A preparar PDF…");
    const canvas = await html2canvas(node, { scale: 2, useCORS: true, backgroundColor: "#ffffff" });
    const img = canvas.toDataURL("image/jpeg", 0.95);
    const pdf = new jsPDF("p", "mm", "a4");
    const pw = pdf.internal.pageSize.getWidth();
    const ph = pdf.internal.pageSize.getHeight();
    const imgH = (canvas.height * pw) / canvas.width;
    let heightLeft = imgH; let pos = 0;
    pdf.addImage(img, "JPEG", 0, pos, pw, imgH);
    heightLeft -= ph;
    while (heightLeft > 0) { pos = heightLeft - imgH; pdf.addPage(); pdf.addImage(img, "JPEG", 0, pos, pw, imgH); heightLeft -= ph; }
    pdf.save(`${(doc?.title || "documento").replace(/[^\w\-]+/g, "_")}.pdf`);
  };

  const printPdf = () => {
    const node = previewRef.current;
    if (!node) return;
    const w = window.open("", "_blank");
    w.document.write(`<html><head><title>${doc?.title || "Documento"}</title>
      <style>@page{margin:0}body{margin:0}</style></head><body>${node.outerHTML}</body></html>`);
    w.document.close();
    setTimeout(() => { w.focus(); w.print(); }, 400);
  };

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[380px_1fr]">
      {/* Form */}
      <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
        <div>
          <label className="mb-1 block text-xs font-bold text-slate-500">Tipo de documento</label>
          <select value={docType} onChange={(e) => setDocType(e.target.value)} data-testid="doc-type-select"
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm">
            {DOC_TYPES.map((d) => <option key={d.id} value={d.id}>{d.label}</option>)}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-bold text-slate-500">Modelo de IA</label>
          <select value={model} onChange={(e) => setModel(e.target.value)} data-testid="pdf-model-select"
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm">
            {CHAT_MODELS.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-bold text-slate-500">Descreva o que precisa</label>
          <textarea value={brief} onChange={(e) => setBrief(e.target.value)} rows={7} data-testid="pdf-brief"
            placeholder="Ex.: Proposta para o cliente João Silva de serviços de consultoria financeira: análise de carteira (500€), relatório mensal (200€/mês), reunião trimestral. Prazo 12 meses."
            className="w-full resize-none rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-[#D4AF37] focus:outline-none" />
        </div>
        <button onClick={generate} disabled={busy || !brief.trim()} data-testid="generate-pdf-btn"
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#0B1A30] py-3 text-sm font-bold text-white hover:bg-[#152a4a] disabled:opacity-50">
          {busy ? <Loader2 size={18} className="animate-spin" /> : <Wand2 size={18} />} Gerar documento
        </button>
        {doc && (
          <div className="flex gap-2 pt-1">
            <button onClick={downloadPdf} data-testid="download-pdf-btn" className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-[#D4AF37] py-2.5 text-sm font-bold text-[#0B1A30] hover:brightness-105"><Download size={16} /> PDF</button>
            <button onClick={printPdf} data-testid="print-pdf-btn" className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-slate-300 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-100"><Printer size={16} /> Imprimir</button>
          </div>
        )}
      </div>

      {/* Preview */}
      <div className="overflow-auto rounded-xl border border-slate-200 bg-slate-100 p-4">
        {doc ? <DocPreview ref={previewRef} doc={doc} /> : (
          <div className="grid h-full min-h-[50vh] place-items-center text-center text-slate-400">
            <div><FileText className="mx-auto mb-3" size={34} /><p className="text-sm">O documento gerado aparecerá aqui com design profissional.</p></div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ---------------- PDF template (modern) ---------------- */
const DocPreview = forwardRef(({ doc }, ref) => {
  const items = Array.isArray(doc.items) ? doc.items : [];
  const total = items.reduce((s, it) => s + Number(it.qty || 1) * Number(it.unit_price || 0), 0);
  return (
    <div ref={ref} data-testid="pdf-preview" style={{ width: 794, margin: "0 auto", background: "#fff", color: "#0B1A30", fontFamily: "Georgia, 'Times New Roman', serif" }}>
      {/* Header band */}
      <div style={{ background: "#0B1A30", padding: "36px 48px", color: "#fff", display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <div style={{ fontSize: 26, fontWeight: 800, letterSpacing: 1, fontFamily: "Arial, sans-serif" }}>
            IN<span style={{ color: "#D4AF37" }}>VEST</span>
          </div>
          <div style={{ fontSize: 11, color: "#9fb0c7", marginTop: 4, fontFamily: "Arial, sans-serif" }}>Financeiro &amp; Jurídico</div>
        </div>
        <div style={{ textAlign: "right", fontFamily: "Arial, sans-serif" }}>
          <div style={{ fontSize: 12, color: "#D4AF37", fontWeight: 700, textTransform: "uppercase", letterSpacing: 2 }}>{doc.subtitle || "Documento"}</div>
          <div style={{ fontSize: 11, color: "#9fb0c7", marginTop: 4 }}>{doc.date || new Date().toLocaleDateString("pt-PT")}</div>
        </div>
      </div>
      <div style={{ height: 4, background: "#D4AF37" }} />

      <div style={{ padding: "40px 48px" }}>
        <h1 style={{ fontSize: 28, margin: "0 0 8px", lineHeight: 1.2 }}>{doc.title || "Documento"}</h1>

        {/* From / To */}
        {(doc.from || doc.to) && (
          <div style={{ display: "flex", gap: 24, margin: "24px 0", fontFamily: "Arial, sans-serif" }}>
            {doc.from && (
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: 1, color: "#8a97a8" }}>De</div>
                <div style={{ fontSize: 14, fontWeight: 700, marginTop: 4 }}>{doc.from.name}</div>
                <div style={{ fontSize: 12, color: "#4a5568", whiteSpace: "pre-wrap" }}>{doc.from.detail}</div>
              </div>
            )}
            {doc.to && (
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: 1, color: "#8a97a8" }}>Para</div>
                <div style={{ fontSize: 14, fontWeight: 700, marginTop: 4 }}>{doc.to.name}</div>
                <div style={{ fontSize: 12, color: "#4a5568", whiteSpace: "pre-wrap" }}>{doc.to.detail}</div>
              </div>
            )}
          </div>
        )}

        {doc.intro && <p style={{ fontSize: 14, lineHeight: 1.7, color: "#26364d" }}>{doc.intro}</p>}

        {(doc.sections || []).map((s, i) => (
          <div key={i} style={{ marginTop: 24 }}>
            {s.heading && <h2 style={{ fontSize: 16, color: "#0B1A30", borderLeft: "3px solid #D4AF37", paddingLeft: 10, margin: "0 0 8px", fontFamily: "Arial, sans-serif" }}>{s.heading}</h2>}
            <p style={{ fontSize: 13.5, lineHeight: 1.75, color: "#33445c", whiteSpace: "pre-wrap", margin: 0 }}>{s.body}</p>
          </div>
        ))}

        {items.length > 0 && (
          <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 28, fontFamily: "Arial, sans-serif" }}>
            <thead>
              <tr style={{ background: "#0B1A30", color: "#fff" }}>
                <th style={{ textAlign: "left", padding: "10px 12px", fontSize: 12 }}>Descrição</th>
                <th style={{ textAlign: "center", padding: "10px 12px", fontSize: 12, width: 70 }}>Qtd.</th>
                <th style={{ textAlign: "right", padding: "10px 12px", fontSize: 12, width: 110 }}>Preço</th>
                <th style={{ textAlign: "right", padding: "10px 12px", fontSize: 12, width: 120 }}>Total</th>
              </tr>
            </thead>
            <tbody>
              {items.map((it, i) => (
                <tr key={i} style={{ borderBottom: "1px solid #e2e8f0" }}>
                  <td style={{ padding: "10px 12px", fontSize: 13 }}>{it.description}</td>
                  <td style={{ padding: "10px 12px", fontSize: 13, textAlign: "center" }}>{it.qty || 1}</td>
                  <td style={{ padding: "10px 12px", fontSize: 13, textAlign: "right" }}>{eur(it.unit_price)}</td>
                  <td style={{ padding: "10px 12px", fontSize: 13, textAlign: "right", fontWeight: 700 }}>{eur(Number(it.qty || 1) * Number(it.unit_price || 0))}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={3} style={{ padding: "12px", textAlign: "right", fontSize: 13, fontWeight: 700 }}>TOTAL</td>
                <td style={{ padding: "12px", textAlign: "right", fontSize: 16, fontWeight: 800, color: "#D4AF37", background: "#0B1A30" }}>{eur(total)}</td>
              </tr>
            </tfoot>
          </table>
        )}

        {doc.notes && (
          <div style={{ marginTop: 28, padding: 16, background: "#f7f9fc", borderRadius: 8, fontFamily: "Arial, sans-serif" }}>
            <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: 1, color: "#8a97a8", marginBottom: 4 }}>Notas</div>
            <p style={{ fontSize: 12.5, lineHeight: 1.6, color: "#4a5568", margin: 0, whiteSpace: "pre-wrap" }}>{doc.notes}</p>
          </div>
        )}

        {doc.signature && (
          <div style={{ marginTop: 48, fontFamily: "Arial, sans-serif" }}>
            <div style={{ borderTop: "1px solid #0B1A30", width: 240, paddingTop: 6, fontSize: 12, color: "#33445c" }}>{doc.signature}</div>
          </div>
        )}
      </div>

      <div style={{ borderTop: "1px solid #e2e8f0", padding: "16px 48px", fontSize: 10, color: "#8a97a8", fontFamily: "Arial, sans-serif", textAlign: "center" }}>
        INVEST · Financeiro &amp; Jurídico — Documento gerado com o Assistente IA
      </div>
    </div>
  );
});
