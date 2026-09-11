import { useEffect, useState } from "react";
import api, { apiError } from "@/lib/api";
import { fmtDate } from "@/lib/format";
import { PageHeader, Card, Loading, Empty, GoldButton } from "@/components/ui/primitives";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { LayoutTemplate, Trash2 } from "lucide-react";
import { toast } from "sonner";

export default function Modelos() {
  const [items, setItems] = useState(null);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", type: "fatura", data: {} });
  const [raw, setRaw] = useState("{}");
  const load = () => api.get("/templates").then((r) => setItems(r.data)).catch((e) => toast.error(apiError(e)));
  useEffect(() => { load(); }, []);

  const save = async () => {
    if (!form.name) return toast.error("Nome obrigatório");
    let data = {};
    try { data = JSON.parse(raw || "{}"); } catch { return toast.error("Dados JSON inválidos"); }
    try { await api.post("/templates", { ...form, data }); toast.success("Modelo guardado"); setOpen(false); setForm({ name: "", type: "fatura", data: {} }); setRaw("{}"); load(); }
    catch (e) { toast.error(apiError(e)); }
  };
  const del = async (id) => { try { await api.delete(`/templates/${id}`); load(); } catch (e) { toast.error(apiError(e)); } };
  const inp = "w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-[#D4AF37]";

  return (
    <>
      <PageHeader title="Modelos" subtitle="Guardar e reutilizar modelos de faturas e documentos">
        <GoldButton data-testid="new-template-btn" onClick={() => setOpen(true)}>+ Novo Modelo</GoldButton>
      </PageHeader>
      {!items ? <Loading /> : items.length === 0 ? <Empty icon={LayoutTemplate} title="Sem modelos" /> : (
        <div className="grid gap-4 md:grid-cols-3">
          {items.map((t) => (
            <Card key={t.id} className="card-hover" data-testid={`template-${t.id}`}>
              <div className="flex items-center justify-between">
                <div className="font-head font-semibold text-[#0B1A30]">{t.name}</div>
                <button onClick={() => del(t.id)} className="rounded p-1.5 text-red-500 hover:bg-red-50"><Trash2 size={15} /></button>
              </div>
              <div className="mt-1 text-xs uppercase text-slate-400">{t.type}</div>
              <div className="mt-1 text-xs text-slate-400">{fmtDate(t.created_at)}</div>
            </Card>
          ))}
        </div>
      )}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg bg-white">
          <DialogHeader><DialogTitle className="font-head">Novo Modelo</DialogTitle></DialogHeader>
          <input className={inp} placeholder="Nome *" data-testid="template-name-input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <select className={inp} value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}><option value="fatura">Fatura</option><option value="contrato">Contrato</option><option value="mensagem">Mensagem</option></select>
          <textarea className={`${inp} font-mono text-xs`} rows={5} placeholder='{"campo": "valor"}' value={raw} onChange={(e) => setRaw(e.target.value)} />
          <DialogFooter><GoldButton data-testid="save-template-btn" onClick={save}>Guardar</GoldButton></DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
