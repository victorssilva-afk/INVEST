import { useEffect, useState } from "react";
import api, { apiError } from "@/lib/api";
import { fmtDate } from "@/lib/format";
import { PageHeader, Card, Loading, Empty, GoldButton } from "@/components/ui/primitives";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { FileSignature, Archive, Trash2, Pencil } from "lucide-react";
import { toast } from "sonner";

const empty = { title: "", client_id: "", content: "", status: "ativo" };

export default function Contratos() {
  const [items, setItems] = useState(null);
  const [clients, setClients] = useState([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(empty);
  const [editId, setEditId] = useState(null);
  const load = () => api.get("/contracts").then((r) => setItems(r.data)).catch((e) => toast.error(apiError(e)));
  useEffect(() => { load(); api.get("/clients").then((r) => setClients(r.data)).catch(() => {}); }, []);

  const save = async () => {
    if (!form.title) return toast.error("Título obrigatório");
    try { editId ? await api.put(`/contracts/${editId}`, form) : await api.post("/contracts", form); toast.success("Contrato guardado"); setOpen(false); setForm(empty); setEditId(null); load(); }
    catch (e) { toast.error(apiError(e)); }
  };
  const setStatus = async (c, status) => { try { await api.put(`/contracts/${c.id}`, { ...c, status }); load(); } catch (e) { toast.error(apiError(e)); } };
  const del = async (id) => { if (!window.confirm("Eliminar contrato?")) return; try { await api.delete(`/contracts/${id}`); load(); } catch (e) { toast.error(apiError(e)); } };

  const inp = "w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-[#D4AF37]";
  return (
    <>
      <PageHeader title="Contratos" subtitle="Criar, organizar e arquivar contratos">
        <GoldButton data-testid="new-contract-btn" onClick={() => { setForm(empty); setEditId(null); setOpen(true); }}>+ Novo Contrato</GoldButton>
      </PageHeader>
      {!items ? <Loading /> : items.length === 0 ? <Empty icon={FileSignature} title="Sem contratos" /> : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {items.map((c) => (
            <Card key={c.id} className={`card-hover ${c.status === "arquivado" ? "opacity-60" : ""}`} data-testid={`contract-${c.id}`}>
              <div className="flex items-center justify-between">
                <div className="font-head font-semibold text-[#0B1A30]">{c.title}</div>
                <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${c.status === "ativo" ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-500"}`}>{c.status}</span>
              </div>
              <div className="mt-1 text-xs text-slate-400">{fmtDate(c.created_at)}</div>
              <p className="mt-2 line-clamp-3 text-sm text-slate-600">{c.content || "—"}</p>
              <div className="mt-3 flex gap-2">
                <button onClick={() => { setForm(c); setEditId(c.id); setOpen(true); }} className="rounded p-1.5 text-slate-500 hover:bg-slate-100"><Pencil size={15} /></button>
                <button onClick={() => setStatus(c, c.status === "ativo" ? "arquivado" : "ativo")} className="rounded p-1.5 text-amber-600 hover:bg-amber-50"><Archive size={15} /></button>
                <button onClick={() => del(c.id)} className="ml-auto rounded p-1.5 text-red-500 hover:bg-red-50"><Trash2 size={15} /></button>
              </div>
            </Card>
          ))}
        </div>
      )}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg bg-white">
          <DialogHeader><DialogTitle className="font-head">{editId ? "Editar" : "Novo"} Contrato</DialogTitle></DialogHeader>
          <input className={inp} placeholder="Título *" data-testid="contract-title-input" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          <select className={inp} value={form.client_id} onChange={(e) => setForm({ ...form, client_id: e.target.value })}><option value="">Sem cliente associado</option>{clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
          <textarea className={inp} rows={6} placeholder="Conteúdo do contrato…" value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} />
          <DialogFooter><GoldButton data-testid="save-contract-btn" onClick={save}>Guardar</GoldButton></DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
