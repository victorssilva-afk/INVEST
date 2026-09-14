import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import api, { apiError } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { LOGO } from "@/lib/logo";
import { fmtDate } from "@/lib/format";
import { Plus, Copy, MessageCircle, Monitor, LogOut, Circle, Pencil, Check, X, UserPlus, MonitorOff, Trash2 } from "lucide-react";
import { toast } from "sonner";

const WSB = process.env.REACT_APP_BACKEND_URL.replace(/^http/, "ws") + "/api/ws";

function SessionPreview({ code, ended }) {
  const [img, setImg] = useState(null);
  const [live, setLive] = useState(false);
  const wsRef = useRef(null);
  useEffect(() => {
    if (ended) return;
    let closed = false;
    const connect = () => {
      const ws = new WebSocket(`${WSB}/support/${code}?role=preview`);
      wsRef.current = ws;
      ws.onmessage = (ev) => {
        try { const m = JSON.parse(ev.data); if (m.type === "snapshot") { setImg(m.data); setLive(true); } } catch (e) { /* */ }
      };
      ws.onclose = () => { if (!closed) { setLive(false); setTimeout(connect, 3000); } };
    };
    connect();
    return () => { closed = true; try { wsRef.current?.close(); } catch (e) { /* */ } };
  }, [code, ended]);

  return (
    <div className="relative aspect-video w-full overflow-hidden rounded-lg border border-white/10 bg-black" data-testid={`ci-preview-${code}`}>
      {img ? (
        <img src={img} alt="prévia" className="h-full w-full object-contain" />
      ) : (
        <div className="flex h-full w-full flex-col items-center justify-center gap-2 text-slate-500">
          <MonitorOff size={26} />
          <span className="text-xs">{ended ? "Sessão terminada" : "À espera do cliente partilhar…"}</span>
        </div>
      )}
      {live && !ended && (
        <span className="absolute left-2 top-2 flex items-center gap-1 rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-bold text-[#4ADE80]">
          <Circle size={7} className="fill-[#4ADE80] text-[#4ADE80] animate-pulse" /> AO VIVO
        </span>
      )}
    </div>
  );
}

export default function CryptoInvest() {
  const { user, logout, loading } = useAuth();
  const nav = useNavigate();
  const isAdmin = user?.role === "admin";
  const [sessions, setSessions] = useState([]);
  const [agents, setAgents] = useState([]);
  const [clientName, setClientName] = useState("");
  const [assignTo, setAssignTo] = useState("");
  const [renaming, setRenaming] = useState(null); // { code, value }
  const [newAgent, setNewAgent] = useState({ name: "", email: "", password: "" });
  const [myToken, setMyToken] = useState("");
  const myLink = myToken ? `${window.location.origin}/conectar?t=${myToken}` : "";

  const load = async () => { try { const { data } = await api.get("/support/sessions"); setSessions(data); } catch (e) { /* */ } };
  const loadAgents = async () => { try { const { data } = await api.get("/support/agents"); setAgents(data); } catch (e) { /* */ } };
  useEffect(() => { if (!loading && !user) nav("/crypto-invest"); }, [loading, user, nav]);
  useEffect(() => { load(); if (user?.role === "admin") loadAgents(); (async () => { try { const { data } = await api.get("/support/my-link"); setMyToken(data.token); } catch (e) { /* */ } })(); const t = setInterval(load, 5000); return () => clearInterval(t); }, [user]);

  const create = async () => {
    try {
      const { data } = await api.post("/support/sessions", null, { params: { client_name: clientName, assigned_to: assignTo } });
      setClientName(""); setAssignTo(""); load();
      const link = `${window.location.origin}/suporte/${data.code}`;
      try { await navigator.clipboard.writeText(link); } catch (er) { /* */ }
      toast.success("Sessão criada · link copiado");
    } catch (e) { toast.error(apiError(e)); }
  };
  const end = async (code) => { try { await api.post(`/support/sessions/${code}/end`); load(); } catch (e) { toast.error(apiError(e)); } };
  const del = async (code) => {
    if (!window.confirm("Apagar este dispositivo/sessão? Esta ação é permanente.")) return;
    try { await api.delete(`/support/sessions/${code}`); load(); toast.success("Dispositivo apagado"); } catch (e) { toast.error(apiError(e)); }
  };
  const saveRename = async () => {
    try { await api.patch(`/support/sessions/${renaming.code}/rename`, null, { params: { device_name: renaming.value } }); setRenaming(null); load(); toast.success("Aparelho renomeado"); }
    catch (e) { toast.error(apiError(e)); }
  };
  const assign = async (code, aid) => { try { await api.post(`/support/sessions/${code}/assign`, null, { params: { assigned_to: aid } }); load(); toast.success("Sessão atribuída"); } catch (e) { toast.error(apiError(e)); } };
  const createAgent = async () => {
    try {
      await api.post("/users", { ...newAgent, role: "agente" });
      setNewAgent({ name: "", email: "", password: "" }); loadAgents();
      toast.success("Agente criado");
    } catch (e) { toast.error(apiError(e)); }
  };
  const clientLink = (code) => `${window.location.origin}/suporte/${code}`;

  return (
    <div className="min-h-screen bg-[#171A1F] text-white">
      <header className="flex items-center justify-between border-b border-white/10 px-6 py-4">
        <div className="flex items-center gap-3">
          <img src={LOGO} alt="logo" className="h-9 w-9 rounded bg-white p-1" />
          <div><div className="font-head text-lg font-bold">Crypto<span className="text-[#4ADE80]">.Invest</span></div><div className="text-xs text-slate-400">Painel do técnico · {user?.name} {isAdmin && <span className="ml-1 rounded bg-[#4ADE80]/20 px-1.5 py-0.5 text-[10px] font-bold text-[#4ADE80]">ADMIN</span>}</div></div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => nav("/app")} className="rounded-lg bg-white/10 px-3 py-2 text-sm font-semibold hover:bg-white/20">CRM</button>
          <button onClick={() => { logout(); nav("/crypto-invest"); }} data-testid="ci-logout" className="flex items-center gap-1.5 rounded-lg bg-white/10 px-3 py-2 text-sm font-semibold hover:bg-white/20"><LogOut size={15} /> Sair</button>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-8">
        <div className="mb-6 rounded-2xl border border-[#4ADE80]/30 bg-[#4ADE80]/5 p-5" data-testid="ci-mylink-card">
          <div className="flex items-center gap-2 font-head font-semibold"><Copy size={18} className="text-[#4ADE80]" /> O meu link permanente</div>
          <p className="mt-1 text-sm text-slate-400">Envie sempre este link ao cliente. Os aparelhos são reconhecidos automaticamente e as sessões ficam atribuídas a si — sem criar sessão para cada pessoa.</p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <input readOnly value={myLink} data-testid="ci-mylink-input" className="min-w-[260px] flex-1 rounded-lg border border-white/20 bg-[#171A1F] px-3 py-2.5 font-mono text-sm outline-none" />
            <button onClick={async () => { try { await navigator.clipboard.writeText(myLink); } catch (e) { /* */ } toast.success("Link copiado"); }} data-testid="ci-mylink-copy" className="flex items-center gap-2 rounded-lg bg-[#4ADE80] px-5 py-2.5 font-bold text-[#0B1A30] hover:bg-[#3fce74]"><Copy size={16} /> Copiar</button>
            <button onClick={() => window.open(`https://wa.me/?text=${encodeURIComponent("Suporte Crypto.Invest: " + myLink)}`, "_blank")} className="flex items-center gap-2 rounded-lg bg-white/10 px-4 py-2.5 text-sm font-semibold hover:bg-white/20"><MessageCircle size={15} /> WhatsApp</button>
          </div>
        </div>

        {isAdmin && (
          <div className="mb-6 rounded-2xl border border-white/10 bg-white/[0.04] p-5" data-testid="ci-agents-card">
            <div className="flex items-center gap-2 font-head font-semibold"><UserPlus size={18} className="text-[#4ADE80]" /> Gerir agentes</div>
            <p className="mt-1 text-sm text-slate-400">Crie perfis de agente. Depois pode atribuir-lhes sessões de suporte.</p>
            <div className="mt-4 flex flex-wrap gap-2">
              <input value={newAgent.name} onChange={(e) => setNewAgent({ ...newAgent, name: e.target.value })} data-testid="ci-agent-name" placeholder="Nome do agente" className="min-w-[160px] flex-1 rounded-lg border border-white/20 bg-[#171A1F] px-3 py-2.5 outline-none focus:border-[#4ADE80]" />
              <input value={newAgent.email} onChange={(e) => setNewAgent({ ...newAgent, email: e.target.value })} data-testid="ci-agent-email" placeholder="Email" className="min-w-[160px] flex-1 rounded-lg border border-white/20 bg-[#171A1F] px-3 py-2.5 outline-none focus:border-[#4ADE80]" />
              <input value={newAgent.password} onChange={(e) => setNewAgent({ ...newAgent, password: e.target.value })} data-testid="ci-agent-password" type="password" placeholder="Palavra-passe" className="min-w-[160px] flex-1 rounded-lg border border-white/20 bg-[#171A1F] px-3 py-2.5 outline-none focus:border-[#4ADE80]" />
              <button onClick={createAgent} data-testid="ci-create-agent" className="flex items-center gap-2 rounded-lg bg-[#4ADE80] px-5 py-2.5 font-bold text-[#0B1A30] hover:bg-[#3fce74]"><UserPlus size={16} /> Criar agente</button>
            </div>
            {agents.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {agents.map((a) => <span key={a.id} className="rounded-full bg-white/10 px-3 py-1 text-xs">{a.name} <span className="text-slate-500">· {a.role}</span></span>)}
              </div>
            )}
          </div>
        )}

        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
          <div className="flex items-center gap-2 font-head font-semibold"><Plus size={18} className="text-[#4ADE80]" /> Nova sessão de suporte</div>
          <p className="mt-1 text-sm text-slate-400">Gere um link único. Envie-o ao cliente — ele partilha o ecrã sem instalar nada.</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <input value={clientName} onChange={(e) => setClientName(e.target.value)} data-testid="ci-client-name" placeholder="Nome do cliente (opcional)" className="min-w-[200px] flex-1 rounded-lg border border-white/20 bg-[#171A1F] px-3 py-2.5 outline-none focus:border-[#4ADE80]" />
            {isAdmin && (
              <select value={assignTo} onChange={(e) => setAssignTo(e.target.value)} data-testid="ci-assign-select" className="min-w-[180px] rounded-lg border border-white/20 bg-[#171A1F] px-3 py-2.5 outline-none focus:border-[#4ADE80]">
                <option value="">Atribuir a mim</option>
                {agents.filter((a) => a.id !== user?.id).map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            )}
            <button onClick={create} data-testid="ci-create-session" className="flex items-center gap-2 rounded-lg bg-[#4ADE80] px-5 py-2.5 font-bold text-[#0B1A30] hover:bg-[#3fce74]"><Plus size={16} /> Criar sessão</button>
          </div>
        </div>

        <h3 className="mb-3 mt-8 font-head text-lg font-semibold">Sessões</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          {sessions.map((s) => (
            <div key={s.code} className="rounded-xl border border-white/10 bg-white/[0.04] p-4" data-testid={`ci-session-${s.code}`}>
              <SessionPreview code={s.code} ended={s.status === "ended"} />
              <div className="mt-3 flex items-start justify-between gap-2">
                <div className="min-w-0">
                  {renaming?.code === s.code ? (
                    <div className="flex items-center gap-1">
                      <input value={renaming.value} onChange={(e) => setRenaming({ ...renaming, value: e.target.value })} data-testid={`ci-rename-input-${s.code}`} className="w-36 rounded border border-white/20 bg-[#171A1F] px-2 py-1 text-sm outline-none focus:border-[#4ADE80]" autoFocus />
                      <button onClick={saveRename} data-testid={`ci-rename-save-${s.code}`} className="rounded bg-[#4ADE80] p-1 text-[#0B1A30]"><Check size={14} /></button>
                      <button onClick={() => setRenaming(null)} className="rounded bg-white/10 p-1"><X size={14} /></button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5">
                      <span className="truncate font-semibold" data-testid={`ci-device-${s.code}`}>{s.device_name || s.client_name || "Aparelho"}</span>
                      <button onClick={() => setRenaming({ code: s.code, value: s.device_name || s.client_name || "" })} data-testid={`ci-rename-${s.code}`} className="text-slate-400 hover:text-[#4ADE80]"><Pencil size={13} /></button>
                    </div>
                  )}
                  <span className={`mt-1 inline-block rounded-full px-2 py-0.5 text-[11px] font-bold ${s.status === "active" ? "bg-[#4ADE80]/20 text-[#4ADE80]" : s.status === "ended" ? "bg-slate-500/20 text-slate-300" : "bg-amber-500/20 text-amber-300"}`}>{s.status === "active" ? "Ativa" : s.status === "ended" ? "Terminada" : "À espera"}</span>
                  <div className="mt-1 text-[11px] text-slate-500">Agente: {s.assigned_name || s.owner_name} · {fmtDate(s.created_at, true)}</div>
                </div>
              </div>
              {isAdmin && s.status !== "ended" && (
                <select value={s.assigned_to || ""} onChange={(e) => assign(s.code, e.target.value)} data-testid={`ci-session-assign-${s.code}`} className="mt-2 w-full rounded-lg border border-white/15 bg-[#171A1F] px-2 py-1.5 text-xs outline-none focus:border-[#4ADE80]">
                  {agents.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
              )}
              <div className="mt-3 flex flex-wrap gap-2">
                <button onClick={async () => { try { await navigator.clipboard.writeText(clientLink(s.code)); } catch (er) { /* */ } toast.success("Link copiado"); }} className="flex items-center gap-1 rounded-lg bg-white/10 px-2.5 py-1.5 text-xs font-semibold hover:bg-white/20"><Copy size={13} /> Copiar</button>
                <button onClick={() => window.open(`https://wa.me/?text=${encodeURIComponent("Suporte Crypto.Invest: " + clientLink(s.code))}`, "_blank")} className="flex items-center gap-1 rounded-lg bg-white/10 px-2.5 py-1.5 text-xs font-semibold hover:bg-white/20"><MessageCircle size={13} /> WhatsApp</button>
                <button onClick={() => nav(`/crypto-invest/sessao/${s.code}`)} data-testid={`ci-open-${s.code}`} className="flex items-center gap-1 rounded-lg bg-[#4ADE80] px-2.5 py-1.5 text-xs font-bold text-[#0B1A30] hover:bg-[#3fce74]"><Monitor size={13} /> Abrir ecrã</button>
                {s.status !== "ended" && <button onClick={() => end(s.code)} className="flex items-center gap-1 rounded-lg bg-red-500/20 px-2.5 py-1.5 text-xs font-semibold text-red-300 hover:bg-red-500/30">Terminar</button>}
                <button onClick={() => del(s.code)} data-testid={`ci-delete-${s.code}`} className="flex items-center gap-1 rounded-lg bg-red-500/10 px-2.5 py-1.5 text-xs font-semibold text-red-400 hover:bg-red-500/20"><Trash2 size={13} /> Apagar</button>
              </div>
            </div>
          ))}
          {!sessions.length && <div className="rounded-xl border border-white/10 bg-white/[0.04] p-6 text-center text-slate-400 sm:col-span-2">Ainda não há sessões. Crie a primeira acima.</div>}
        </div>
        <p className="mt-6 flex items-center gap-1.5 text-xs text-slate-500"><Circle size={11} className="text-red-500" /> No ecrã do cliente, o seu cursor aparece como um círculo vermelho para o orientar.</p>
      </main>
    </div>
  );
}
