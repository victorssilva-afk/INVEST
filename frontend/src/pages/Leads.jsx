import { useEffect, useState } from "react";
import api, { apiError } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { eur } from "@/lib/format";
import { PageHeader, Card, GoldButton } from "@/components/ui/primitives";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Plus, Trash2, TrendingUp, Users, Link2 } from "lucide-react";
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
const empty = { name: "", seller: "", value_eur: "", affiliate: "", funnel: "", type: "Novo", status: "No Answer" };

export default function Leads() {
  const { user } = useAuth();
  const [leads, setLeads] = useState([]);
  const [stats, setStats] = useState(null);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(empty);
  const [editId, setEditId] = useState(null);
  const [fStatus, setFStatus] = useState("");

  const load = async () => {
    try {
      const { data } = await api.get("/leads", { params: fStatus ? { status: fStatus } : {} });
      setLeads(data);
      const s = await api.get("/leads/stats");
      setStats(s.data);
    } catch (e) { toast.error(apiError(e)); }
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [fStatus]);

  const save = async () => {
    try {
      if (editId) await api.put(`/leads/${editId}`, form);
      else await api.post("/leads", form);
      toast.success("Lead guardado");
      setOpen(false); setForm(empty); setEditId(null); load();
    } catch (e) { toast.error(apiError(e)); }
  };
  const edit = (l) => { setForm({ name: l.name, seller: l.seller, value_eur: l.value_eur, affiliate: l.affiliate, funnel: l.funnel, type: l.type, status: l.status }); setEditId(l.id); setOpen(true); };
  const del = async (id) => { if (!window.confirm("Eliminar lead?")) return; try { await api.delete(`/leads/${id}`); load(); } catch (e) { toast.error(apiError(e)); } };
  const link = `${window.location.origin}/app/leads`;
  const inp = "w-full rounded-lg border border-slate-200 px-3 py-2 text-sm";

  return (
    <>
      <PageHeader title="Leads" subtitle={`Acesso individual · ${user?.name || ""}`}>
        <button onClick={() => { navigator.clipboard.writeText(link); toast.success("Link copiado"); }} data-testid="copy-leads-link" className="flex items-center gap-1.5 rounded-lg bg-slate-100 px-3 py-2 text-sm font-semibold text-[#0B1A30] hover:bg-slate-200"><Link2 size={15} /> Copiar link</button>
        <GoldButton data-testid="new-lead-btn" onClick={() => { setForm(empty); setEditId(null); setOpen(true); }}><Plus size={16} /> Novo lead</GoldButton>
      </PageHeader>

      <div className="mb-5 grid gap-4 md:grid-cols-3">
        <Card><div className="text-xs uppercase text-slate-400">Total de leads</div><div className="font-head text-2xl font-bold text-[#0B1A30]" data-testid="leads-total">{stats?.total_leads ?? 0}</div></Card>
        <Card><div className="text-xs uppercase text-slate-400">Valor total</div><div className="font-head text-2xl font-bold text-[#0B1A30]">{eur(stats?.total_value || 0)}</div></Card>
        <Card><div className="text-xs uppercase text-slate-400">Estados</div><div className="mt-1 flex flex-wrap gap-1">{(stats?.status_breakdown || []).map((s) => <span key={s.status} className={`rounded px-2 py-0.5 text-xs font-semibold ${STATUS_CLS[s.status] || "bg-slate-100"}`}>{s.status}: {s.count}</span>)}</div></Card>
      </div>

      <div className="mb-5 grid gap-4 md:grid-cols-2">
        <Card><div className="flex items-center gap-2 font-semibold text-[#0B1A30]"><TrendingUp size={16} className="text-[#D4AF37]" /> Funis mais vendidos</div>
          <table className="mt-3 w-full text-sm"><tbody>{(stats?.top_funnels || []).map((f, i) => <tr key={i} className="border-t border-slate-100"><td className="py-1.5">{f.name}</td><td className="text-right text-slate-500">{f.count}</td><td className="text-right font-semibold">{eur(f.value)}</td></tr>)}{!(stats?.top_funnels || []).length && <tr><td className="py-2 text-slate-400">Sem dados</td></tr>}</tbody></table></Card>
        <Card><div className="flex items-center gap-2 font-semibold text-[#0B1A30]"><Users size={16} className="text-[#D4AF37]" /> Affiliates mais vendidos</div>
          <table className="mt-3 w-full text-sm"><tbody>{(stats?.top_affiliates || []).map((a, i) => <tr key={i} className="border-t border-slate-100"><td className="py-1.5">{a.name}</td><td className="text-right text-slate-500">{a.count}</td><td className="text-right font-semibold">{eur(a.value)}</td></tr>)}{!(stats?.top_affiliates || []).length && <tr><td className="py-2 text-slate-400">Sem dados</td></tr>}</tbody></table></Card>
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
    </>
  );
}
