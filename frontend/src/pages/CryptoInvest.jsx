import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api, { apiError } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { LOGO } from "@/lib/logo";
import { fmtDate } from "@/lib/format";
import { Plus, Copy, ExternalLink, MessageCircle, Monitor, LogOut, Circle } from "lucide-react";
import { toast } from "sonner";

export default function CryptoInvest() {
  const { user, logout, loading } = useAuth();
  const nav = useNavigate();
  const [sessions, setSessions] = useState([]);
  const [clientName, setClientName] = useState("");

  const load = async () => { try { const { data } = await api.get("/support/sessions"); setSessions(data); } catch (e) { /* ignore */ } };
  useEffect(() => { if (!loading && !user) nav("/crypto-invest"); }, [loading, user, nav]);
  useEffect(() => { load(); }, []);

  const create = async () => {
    try {
      const { data } = await api.post("/support/sessions", null, { params: { client_name: clientName } });
      setClientName(""); load();
      const link = `${window.location.origin}/suporte/${data.code}`;
      try { await navigator.clipboard.writeText(link); } catch (er) { /* */ }
      toast.success("Sessão criada · link copiado");
    } catch (e) { toast.error(apiError(e)); }
  };
  const end = async (code) => { try { await api.post(`/support/sessions/${code}/end`); load(); } catch (e) { toast.error(apiError(e)); } };
  const clientLink = (code) => `${window.location.origin}/suporte/${code}`;

  return (
    <div className="min-h-screen bg-[#0B1A30] text-white">
      <header className="flex items-center justify-between border-b border-white/10 px-6 py-4">
        <div className="flex items-center gap-3">
          <img src={LOGO} alt="logo" className="h-9 w-9 rounded bg-white p-1" />
          <div><div className="font-head text-lg font-bold">Crypto<span className="text-[#D4AF37]">.Invest</span></div><div className="text-xs text-slate-400">Painel do técnico · {user?.name}</div></div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => nav("/app")} className="rounded-lg bg-white/10 px-3 py-2 text-sm font-semibold hover:bg-white/20">CRM</button>
          <button onClick={() => { logout(); nav("/crypto-invest"); }} data-testid="ci-logout" className="flex items-center gap-1.5 rounded-lg bg-white/10 px-3 py-2 text-sm font-semibold hover:bg-white/20"><LogOut size={15} /> Sair</button>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-8">
        <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
          <div className="flex items-center gap-2 font-head font-semibold"><Plus size={18} className="text-[#D4AF37]" /> Nova sessão de suporte</div>
          <p className="mt-1 text-sm text-slate-400">Gere um link único. Envie-o ao cliente — ele partilha o ecrã sem instalar nada.</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <input value={clientName} onChange={(e) => setClientName(e.target.value)} data-testid="ci-client-name" placeholder="Nome do cliente (opcional)" className="flex-1 min-w-[220px] rounded-lg border border-white/20 bg-[#0B1A30] px-3 py-2.5 outline-none focus:border-[#D4AF37]" />
            <button onClick={create} data-testid="ci-create-session" className="flex items-center gap-2 rounded-lg gold-gradient px-5 py-2.5 font-bold text-[#0B1A30]"><Plus size={16} /> Criar sessão</button>
          </div>
        </div>

        <h3 className="mb-3 mt-8 font-head text-lg font-semibold">Sessões</h3>
        <div className="space-y-3">
          {sessions.map((s) => (
            <div key={s.code} className="rounded-xl border border-white/10 bg-white/5 p-4" data-testid={`ci-session-${s.code}`}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div className="font-semibold">{s.client_name || "Cliente"} <span className={`ml-2 rounded-full px-2 py-0.5 text-[11px] font-bold ${s.status === "active" ? "bg-green-500/20 text-green-300" : s.status === "ended" ? "bg-slate-500/20 text-slate-300" : "bg-amber-500/20 text-amber-300"}`}>{s.status === "active" ? "Ativa" : s.status === "ended" ? "Terminada" : "À espera"}</span></div>
                  <div className="mt-0.5 font-mono text-xs text-slate-400">{clientLink(s.code)}</div>
                  <div className="text-[11px] text-slate-500">{fmtDate(s.created_at, true)}</div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button onClick={async () => { try { await navigator.clipboard.writeText(clientLink(s.code)); } catch (er) { /* */ } toast.success("Link copiado"); }} className="flex items-center gap-1 rounded-lg bg-white/10 px-2.5 py-1.5 text-xs font-semibold hover:bg-white/20"><Copy size={13} /> Copiar</button>
                  <button onClick={() => window.open(`https://wa.me/?text=${encodeURIComponent("Suporte Crypto.Invest: " + clientLink(s.code))}`, "_blank")} className="flex items-center gap-1 rounded-lg bg-white/10 px-2.5 py-1.5 text-xs font-semibold hover:bg-white/20"><MessageCircle size={13} /> WhatsApp</button>
                  <button onClick={() => nav(`/crypto-invest/sessao/${s.code}`)} data-testid={`ci-open-${s.code}`} className="flex items-center gap-1 rounded-lg gold-gradient px-2.5 py-1.5 text-xs font-bold text-[#0B1A30]"><Monitor size={13} /> Abrir ecrã</button>
                  {s.status !== "ended" && <button onClick={() => end(s.code)} className="flex items-center gap-1 rounded-lg bg-red-500/20 px-2.5 py-1.5 text-xs font-semibold text-red-300 hover:bg-red-500/30">Terminar</button>}
                </div>
              </div>
            </div>
          ))}
          {!sessions.length && <div className="rounded-xl border border-white/10 bg-white/5 p-6 text-center text-slate-400">Ainda não há sessões. Crie a primeira acima.</div>}
        </div>
        <p className="mt-6 flex items-center gap-1.5 text-xs text-slate-500"><Circle size={11} className="text-red-500" /> No ecrã do cliente, o seu cursor aparece como um círculo vermelho para o orientar.</p>
      </main>
    </div>
  );
}
