import { useEffect, useState } from "react";
import api, { apiError } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { eur } from "@/lib/format";
import { PageHeader, Card, GoldButton } from "@/components/ui/primitives";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from "recharts";
import { Plus, Trash2, Link2, FileSpreadsheet, Archive, Crown, Clock, Trophy } from "lucide-react";
import { toast } from "sonner";

const STATUSES = ["No Answer", "NA Hot", "Not Interested", "Low Potential", "No Potential", "Duplicate"];
const STATUS_CLS = {
  "No Answer": "bg-slate-100 text-slate-700",
  "NA Hot": "bg-red-100 text-red-700",
  "Not Interested": "bg-amber-100 text-amber-700",
  "Low Potential": "bg-blue-100 text-blue-700",
  "No Potential": "bg-zinc-200 text-zinc-700",
  "Duplicate": "bg-purple-100 text-purple-700",
};
const COLORS = ["#D4AF37", "#0B1A30", "#1e3a5f", "#b8952e", "#3b5a7a", "#8a6d1f", "#64748b"];
const empty = { name: "", seller: "", value_eur: "", affiliate: "", funnel: "", type: "Novo", status: "No Answer" };

function PieBox({ title, arr }) {
  const data = (arr || []).slice(0, 6).map((x) => ({ name: x.name, value: Math.round(x.value) }));
  const rest = (arr || []).slice(6).reduce((s, x) => s + x.value, 0);
  if (rest > 0) data.push({ name: "Outros", value: Math.round(rest) });
  return (
    <Card>
      <div className="mb-1 font-semibold text-[#0B1A30]">{title}</div>
      {data.length ? (
        <ResponsiveContainer width="100%" height={230}>
          <PieChart>
            <Pie data={data} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={78} innerRadius={38} paddingAngle={2}>
              {data.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
            </Pie>
            <Tooltip formatter={(v) => eur(v)} />
            <Legend verticalAlign="bottom" height={36} wrapperStyle={{ fontSize: 11 }} />
          </PieChart>
        </ResponsiveContainer>
      ) : <div className="py-14 text-center text-sm text-slate-400">Sem dados</div>}
    </Card>
  );
}

export default function Leads() {
  const { user } = useAuth();
  const [leads, setLeads] = useState([]);
  const [stats, setStats] = useState(null);
  const [archives, setArchives] = useState([]);
  const [open, setOpen] = useState(false);
  const [archOpen, setArchOpen] = useState(false);
  const [form, setForm] = useState(empty);
  const [editId, setEditId] = useState(null);
  const [fStatus, setFStatus] = useState("");
  const [clock, setClock] = useState("");

  useEffect(() => {
    const tick = () => setClock(new Date().toLocaleString("pt-PT", { timeZone: "Europe/Lisbon", dateStyle: "short", timeStyle: "medium" }));
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, []);

  const load = async () => {
    try {
      const { data } = await api.get("/leads", { params: fStatus ? { status: fStatus } : {} });
      setLeads(data);
      const s = await api.get("/leads/stats");
      setStats(s.data);
    } catch (e) { toast.error(apiError(e)); }
  };
  const loadArchives = async () => { try { const { data } = await api.get("/leads/archives"); setArchives(data); } catch (e) { /* ignore */ } };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [fStatus]);
  useEffect(() => { loadArchives(); }, []);

  const save = async () => {
    try {
      if (editId) await api.put(`/leads/${editId}`, form); else await api.post("/leads", form);
      toast.success("Lead guardado"); setOpen(false); setForm(empty); setEditId(null); load();
    } catch (e) { toast.error(apiError(e)); }
  };
  const edit = (l) => { setForm({ name: l.name, seller: l.seller, value_eur: l.value_eur, affiliate: l.affiliate, funnel: l.funnel, type: l.type, status: l.status }); setEditId(l.id); setOpen(true); };
  const del = async (id) => { if (!window.confirm("Eliminar lead?")) return; try { await api.delete(`/leads/${id}`); load(); } catch (e) { toast.error(apiError(e)); } };
  const link = `${window.location.origin}/app/leads`;

  const download = async (period) => {
    try {
      const res = await api.get("/leads/export", { params: period ? { period } : {}, responseType: "blob" });
      const url = URL.createObjectURL(res.data);
      const a = document.createElement("a"); a.href = url; a.download = period ? `leads_${period}.xlsx` : "leads.xlsx"; a.click(); URL.revokeObjectURL(url);
    } catch (e) { toast.error("Falha ao exportar"); }
  };
  const closeMonth = async () => {
    if (!window.confirm("Encerrar o mês atual e guardar em 'Mês anterior'?")) return;
    try { await api.post("/leads/close-month"); toast.success("Mês encerrado e arquivado"); loadArchives(); setArchOpen(true); } catch (e) { toast.error(apiError(e)); }
  };

  const inp = "w-full rounded-lg border border-slate-200 px-3 py-2 text-sm";
  const best = stats?.best || {};

  return (
    <>
      <PageHeader title="Leads" subtitle={`Acesso individual · ${user?.name || ""} · 🇵🇹 ${clock}`}>
        <button onClick={() => { navigator.clipboard.writeText(link); toast.success("Link copiado"); }} data-testid="copy-leads-link" className="flex items-center gap-1.5 rounded-lg bg-slate-100 px-3 py-2 text-sm font-semibold text-[#0B1A30] hover:bg-slate-200"><Link2 size={15} /> Link</button>
        <button onClick={() => download()} data-testid="export-leads-btn" className="flex items-center gap-1.5 rounded-lg bg-slate-100 px-3 py-2 text-sm font-semibold text-[#0B1A30] hover:bg-slate-200"><FileSpreadsheet size={15} /> Exportar</button>
        <button onClick={() => { loadArchives(); setArchOpen(true); }} data-testid="archives-btn" className="flex items-center gap-1.5 rounded-lg bg-slate-100 px-3 py-2 text-sm font-semibold text-[#0B1A30] hover:bg-slate-200"><Archive size={15} /> Mês anterior</button>
        <button onClick={closeMonth} data-testid="close-month-btn" className="flex items-center gap-1.5 rounded-lg bg-[#0B1A30] px-3 py-2 text-sm font-semibold text-white hover:bg-[#132845]"><Clock size={15} /> Encerrar mês</button>
        <GoldButton data-testid="new-lead-btn" onClick={() => { setForm(empty); setEditId(null); setOpen(true); }}><Plus size={16} /> Novo lead</GoldButton>
      </PageHeader>

      <div className="mb-5 grid gap-4 md:grid-cols-4">
        <Card><div className="text-xs uppercase text-slate-400">Total de leads</div><div className="font-head text-2xl font-bold text-[#0B1A30]" data-testid="leads-total">{stats?.total_leads ?? 0}</div></Card>
        <Card><div className="text-xs uppercase text-slate-400">Valor total</div><div className="font-head text-2xl font-bold text-[#0B1A30]">{eur(stats?.total_value || 0)}</div></Card>
        <Card className="md:col-span-2 navy-gradient text-white">
          <div className="flex items-center gap-2 text-xs uppercase text-[#D4AF37]"><Trophy size={14} /> Mais vendidos</div>
          <div className="mt-2 grid grid-cols-3 gap-2 text-sm" data-testid="best-winners">
            <div><div className="text-slate-400 text-xs">Affiliate</div><div className="font-semibold">{best.affiliate?.name || "—"}</div><div className="text-[#D4AF37] text-xs">{best.affiliate ? eur(best.affiliate.value) : ""}</div></div>
            <div><div className="text-slate-400 text-xs">Funil</div><div className="font-semibold">{best.funnel?.name || "—"}</div><div className="text-[#D4AF37] text-xs">{best.funnel ? eur(best.funnel.value) : ""}</div></div>
            <div><div className="text-slate-400 text-xs">Vendedor</div><div className="font-semibold">{best.seller?.name || "—"}</div><div className="text-[#D4AF37] text-xs">{best.seller ? eur(best.seller.value) : ""}</div></div>
          </div>
        </Card>
      </div>

      <div className="mb-5 grid gap-4 lg:grid-cols-3">
        <PieBox title="Affiliates mais vendidos" arr={stats?.top_affiliates} />
        <PieBox title="Funis mais vendidos" arr={stats?.top_funnels} />
        <PieBox title="Vendedores mais vendidos" arr={stats?.top_sellers} />
      </div>

      <Card>
        <div className="mb-3 flex items-center gap-2">
          <select value={fStatus} onChange={(e) => setFStatus(e.target.value)} data-testid="filter-status" className="rounded-lg border border-slate-200 px-3 py-2 text-sm"><option value="">Todos os estados</option>{STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}</select>
        </div>
        <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="text-left text-xs uppercase text-slate-400"><th className="py-2">Nome</th><th>Vendedor</th><th>Valor</th><th>Affiliate</th><th>Funil</th><th>Tipo</th><th>Status</th><th></th></tr></thead>
          <tbody>{leads.map((l) => (<tr key={l.id} className="border-t border-slate-100" data-testid={`lead-row-${l.id}`}>
            <td className="cursor-pointer py-2 font-medium text-[#0B1A30]" onClick={() => edit(l)}>{l.name || "—"}</td>
            <td>{l.seller || "—"}</td><td>{eur(l.value_eur)}</td><td>{l.affiliate || "—"}</td><td>{l.funnel || "—"}</td>
            <td><span className="rounded bg-slate-100 px-2 py-0.5 text-xs">{l.type}</span></td>
            <td><span className={`rounded px-2 py-0.5 text-xs font-semibold ${STATUS_CLS[l.status] || "bg-slate-100"}`}>{l.status}</span></td>
            <td className="text-right"><button onClick={() => del(l.id)} data-testid={`delete-lead-${l.id}`} className="rounded p-1.5 text-red-600 hover:bg-red-50"><Trash2 size={15} /></button></td>
          </tr>))}{!leads.length && <tr><td colSpan={8} className="py-6 text-center text-slate-400">Sem leads. Crie o primeiro.</td></tr>}</tbody></table></div>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}><DialogContent><DialogHeader><DialogTitle>{editId ? "Editar lead" : "Novo lead"}</DialogTitle></DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2"><label className="text-xs text-slate-500">Nome</label><input className={inp} data-testid="lead-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
          <div><label className="text-xs text-slate-500">Vendedor</label><input className={inp} data-testid="lead-seller" value={form.seller} onChange={(e) => setForm({ ...form, seller: e.target.value })} /></div>
          <div><label className="text-xs text-slate-500">Valor (€)</label><input type="number" className={inp} data-testid="lead-value" value={form.value_eur} onChange={(e) => setForm({ ...form, value_eur: e.target.value })} /></div>
          <div><label className="text-xs text-slate-500">Affiliate</label><input className={inp} data-testid="lead-affiliate" value={form.affiliate} onChange={(e) => setForm({ ...form, affiliate: e.target.value })} /></div>
          <div><label className="text-xs text-slate-500">Funil</label><input className={inp} data-testid="lead-funnel" value={form.funnel} onChange={(e) => setForm({ ...form, funnel: e.target.value })} /></div>
          <div><label className="text-xs text-slate-500">Tipo</label><select className={inp} data-testid="lead-type" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}><option>Novo</option><option>Velho</option></select></div>
          <div><label className="text-xs text-slate-500">Status</label><select className={inp} data-testid="lead-status" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>{STATUSES.map((s) => <option key={s}>{s}</option>)}</select></div>
        </div>
        <DialogFooter><GoldButton onClick={save} data-testid="save-lead-btn">Guardar</GoldButton></DialogFooter>
      </DialogContent></Dialog>

      <Dialog open={archOpen} onOpenChange={setArchOpen}><DialogContent><DialogHeader><DialogTitle>Mês anterior — Arquivo</DialogTitle></DialogHeader>
        <div className="max-h-[60vh] space-y-3 overflow-auto">
          {archives.map((a) => (
            <div key={a.period} className="rounded-xl border border-slate-200 p-3" data-testid={`archive-${a.period}`}>
              <div className="flex items-center justify-between">
                <div className="font-head font-semibold text-[#0B1A30]">{a.label}</div>
                <button onClick={() => download(a.period)} className="flex items-center gap-1.5 rounded-lg bg-slate-100 px-2.5 py-1.5 text-xs font-semibold hover:bg-slate-200"><FileSpreadsheet size={13} /> Excel</button>
              </div>
              <div className="mt-1 text-sm text-slate-600">{a.stats?.total_leads || 0} leads · {eur(a.stats?.total_value || 0)}</div>
              <div className="mt-1 flex flex-wrap gap-2 text-xs text-slate-500">
                <span className="flex items-center gap-1"><Crown size={12} className="text-[#D4AF37]" /> Affiliate: <b>{a.stats?.best?.affiliate?.name || "—"}</b></span>
                <span>Funil: <b>{a.stats?.best?.funnel?.name || "—"}</b></span>
                <span>Vendedor: <b>{a.stats?.best?.seller?.name || "—"}</b></span>
              </div>
            </div>
          ))}
          {!archives.length && <div className="py-6 text-center text-sm text-slate-400">Ainda não há meses arquivados. Use “Encerrar mês”.</div>}
        </div>
      </DialogContent></Dialog>
    </>
  );
}
