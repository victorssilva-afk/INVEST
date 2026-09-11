import { useEffect, useState } from "react";
import api, { apiError } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { PageHeader, Card, Loading, Empty, GoldButton } from "@/components/ui/primitives";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { ShieldCheck, Trash2, Power } from "lucide-react";
import { toast } from "sonner";

export default function Utilizadores() {
  const { user } = useAuth();
  const [items, setItems] = useState(null);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", password: "", role: "agente", active: true });
  const load = () => api.get("/users").then((r) => setItems(r.data)).catch((e) => toast.error(apiError(e)));
  useEffect(() => { load(); }, []);

  if (user?.role !== "admin") return <Empty icon={ShieldCheck} title="Acesso restrito" subtitle="Apenas administradores" />;

  const save = async () => {
    if (!form.name || !form.email || !form.password) return toast.error("Preencha todos os campos");
    try { await api.post("/users", form); toast.success("Utilizador criado"); setOpen(false); setForm({ name: "", email: "", password: "", role: "agente", active: true }); load(); }
    catch (e) { toast.error(apiError(e)); }
  };
  const toggle = async (u) => { try { await api.put(`/users/${u.id}`, { active: !u.active }); load(); } catch (e) { toast.error(apiError(e)); } };
  const del = async (id) => { if (!window.confirm("Eliminar utilizador?")) return; try { await api.delete(`/users/${id}`); load(); } catch (e) { toast.error(apiError(e)); } };
  const inp = "w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-[#D4AF37]";

  return (
    <>
      <PageHeader title="Utilizadores" subtitle="Gestão de acessos da Mesa (RBAC)">
        <GoldButton data-testid="new-user-btn" onClick={() => setOpen(true)}>+ Novo Utilizador</GoldButton>
      </PageHeader>
      {!items ? <Loading /> : (
        <Card className="p-0 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50"><tr className="text-left text-xs uppercase text-slate-400"><th className="px-5 py-3">Nome</th><th>Email</th><th>Papel</th><th>Estado</th><th></th></tr></thead>
            <tbody>{items.map((u) => (
              <tr key={u.id} className="border-t border-slate-100" data-testid={`user-row-${u.email}`}>
                <td className="px-5 py-3 font-medium">{u.name}</td><td className="text-slate-500">{u.email}</td>
                <td><span className="rounded-full bg-[#0B1A30] px-2 py-0.5 text-xs font-semibold text-[#D4AF37] capitalize">{u.role}</span></td>
                <td><span className={`text-xs font-semibold ${u.active ? "text-green-600" : "text-red-500"}`}>{u.active ? "Ativo" : "Inativo"}</span></td>
                <td className="px-4 text-right">
                  <button onClick={() => toggle(u)} className="rounded p-1.5 text-amber-600 hover:bg-amber-50"><Power size={15} /></button>
                  {u.id !== user.id && <button onClick={() => del(u.id)} className="rounded p-1.5 text-red-500 hover:bg-red-50"><Trash2 size={15} /></button>}
                </td>
              </tr>))}
            </tbody>
          </table>
        </Card>
      )}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md bg-white">
          <DialogHeader><DialogTitle className="font-head">Novo Utilizador</DialogTitle></DialogHeader>
          <input className={inp} placeholder="Nome" data-testid="user-name-input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <input className={inp} placeholder="Email" data-testid="user-email-input" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          <input className={inp} type="password" placeholder="Password" data-testid="user-password-input" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
          <select className={inp} value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}><option value="agente">Agente</option><option value="admin">Admin</option></select>
          <DialogFooter><GoldButton data-testid="save-user-btn" onClick={save}>Criar</GoldButton></DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
