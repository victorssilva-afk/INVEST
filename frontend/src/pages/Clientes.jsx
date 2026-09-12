/* eslint-disable react-hooks/exhaustive-deps */
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api, { apiError } from "@/lib/api";
import { PageHeader, Card, Loading, Empty, GoldButton } from "@/components/ui/primitives";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Users, Search, Building2, Mail, Phone } from "lucide-react";
import { toast } from "sonner";

const empty = { name: "", company: "", nif: "", email: "", phone: "", address: "", city: "", postal_code: "", country: "Portugal" };

export default function Clientes() {
  const [clients, setClients] = useState(null);
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(empty);
  const [editId, setEditId] = useState(null);
  const navigate = useNavigate();

  const load = () => api.get("/clients", { params: { q } }).then((r) => setClients(r.data)).catch((e) => toast.error(apiError(e)));
  useEffect(() => { load(); }, []);

  const save = async () => {
    if (!form.name) return toast.error("Nome obrigatório");
    try {
      if (editId) await api.put(`/clients/${editId}`, form);
      else await api.post("/clients", form);
      toast.success("Cliente guardado"); setOpen(false); setForm(empty); setEditId(null); load();
    } catch (e) { toast.error(apiError(e)); }
  };

  const inp = "w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-[#D4AF37]";

  return (
    <>
      <PageHeader title="Clientes (CRM)" subtitle="Gestão de clientes, métricas e histórico">
        <GoldButton data-testid="new-client-btn" onClick={() => { setForm(empty); setEditId(null); setOpen(true); }}>+ Novo Cliente</GoldButton>
      </PageHeader>

      <Card className="mb-5">
        <div className="flex items-center gap-2 rounded-lg border border-slate-200 px-3">
          <Search size={16} className="text-slate-400" />
          <input data-testid="client-search-input" className="w-full bg-transparent py-2 text-sm outline-none" placeholder="Pesquisar por nome, empresa, NIF…" value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === "Enter" && load()} />
        </div>
      </Card>

      {!clients ? <Loading /> : clients.length === 0 ? <Empty icon={Users} title="Sem clientes" subtitle="Adicione o primeiro cliente" /> : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {clients.map((c) => (
            <Card key={c.id} className="card-hover cursor-pointer" data-testid={`client-card-${c.id}`} onClick={() => navigate(`/app/clientes/${c.id}`)}>
              <div className="flex items-center gap-3">
                <div className="grid h-11 w-11 place-items-center rounded-full bg-[#0B1A30] font-head font-bold text-[#D4AF37]">{c.name.slice(0, 1).toUpperCase()}</div>
                <div className="min-w-0"><div className="font-semibold text-[#0B1A30] truncate">{c.name}</div>{c.company && <div className="flex items-center gap-1 text-xs text-slate-500"><Building2 size={12} /> {c.company}</div>}</div>
              </div>
              <div className="mt-3 space-y-1 text-sm text-slate-500">
                {c.email && <div className="flex items-center gap-2"><Mail size={13} /> {c.email}</div>}
                {c.phone && <div className="flex items-center gap-2"><Phone size={13} /> {c.phone}</div>}
                {c.nif && <div className="text-xs">NIF: {c.nif}</div>}
              </div>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg bg-white">
          <DialogHeader><DialogTitle className="font-head">{editId ? "Editar" : "Novo"} Cliente</DialogTitle></DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            <input className={inp} placeholder="Nome *" data-testid="client-name-input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            <input className={inp} placeholder="Empresa" value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} />
            <input className={inp} placeholder="NIF" value={form.nif} onChange={(e) => setForm({ ...form, nif: e.target.value })} />
            <input className={inp} placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            <input className={inp} placeholder="Telefone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            <input className={inp} placeholder="Cidade" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
            <input className={`${inp} sm:col-span-2`} placeholder="Morada" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
            <input className={inp} placeholder="Código postal" value={form.postal_code} onChange={(e) => setForm({ ...form, postal_code: e.target.value })} />
            <input className={inp} placeholder="País" value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })} />
          </div>
          <DialogFooter><GoldButton data-testid="save-client-btn" onClick={save}>Guardar</GoldButton></DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
