import { useEffect, useState } from "react";
import api, { apiError } from "@/lib/api";
import { fmtDate } from "@/lib/format";
import jsPDF from "jspdf";
import { PageHeader, Card, Loading, Empty, GoldButton, NavyButton } from "@/components/ui/primitives";
import { Calculator, Plus, Trash2, FileDown, FileSpreadsheet, CalendarClock } from "lucide-react";
import { toast } from "sonner";

const euro = (v) => "€" + Number(v || 0).toLocaleString("pt-PT", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function Calculo() {
  const [profiles, setProfiles] = useState(null);
  const [sel, setSel] = useState(null);
  const [newName, setNewName] = useState("");
  const [entry, setEntry] = useState({ deposit: "", date: new Date().toISOString().slice(0, 10) });

  const load = () => api.get("/calc/profiles").then((r) => { setProfiles(r.data); if (sel) setSel(r.data.find((p) => p.id === sel.id) || null); }).catch((e) => toast.error(apiError(e)));
  useEffect(() => { load(); }, []);

  const addProfile = async () => { if (!newName) return; try { await api.post("/calc/profiles", { name: newName }); setNewName(""); toast.success("Perfil criado"); load(); } catch (e) { toast.error(apiError(e)); } };
  const delProfile = async (id) => { if (!window.confirm("Eliminar perfil e histórico?")) return; try { await api.delete(`/calc/profiles/${id}`); if (sel?.id === id) setSel(null); load(); } catch (e) { toast.error(apiError(e)); } };
  const addEntry = async () => {
    if (!entry.deposit || !sel) return toast.error("Indique o depósito");
    try { await api.post("/calc/entries", { profile_id: sel.id, deposit: parseFloat(entry.deposit), date: entry.date }); setEntry({ ...entry, deposit: "" }); toast.success("Depósito registado"); load(); }
    catch (e) { toast.error(apiError(e)); }
  };
  const delEntry = async (id) => { try { await api.delete(`/calc/entries/${id}`); load(); } catch (e) { toast.error(apiError(e)); } };
  const exportXlsx = async () => { try { const res = await api.get("/calc/export", { params: { profile_id: sel.id }, responseType: "blob" }); const url = URL.createObjectURL(res.data); const a = document.createElement("a"); a.href = url; a.download = `calculo_${sel.name}.xlsx`; a.click(); } catch (e) { toast.error(apiError(e)); } };

  const bonus = entry.deposit ? parseFloat(entry.deposit) * 0.2 : 0;

  const exportPdf = () => {
    const doc = new jsPDF();
    doc.setFillColor(11, 26, 48); doc.rect(0, 0, 210, 26, "F");
    doc.setTextColor(255, 255, 255); doc.setFont("helvetica", "bold"); doc.setFontSize(18); doc.text("INVEST — Cálculo", 14, 16);
    doc.setTextColor(30, 41, 59); doc.setFontSize(12); doc.text(`Perfil: ${sel.name}`, 14, 36);
    let y = 46; doc.setFontSize(9); doc.setFont("helvetica", "bold");
    doc.text("Data", 14, y); doc.text("Depósito", 55, y); doc.text("Bónus 20%", 95, y); doc.text("Total", 135, y); doc.text("Sexta-feira", 165, y); y += 3;
    doc.line(14, y, 196, y); y += 6; doc.setFont("helvetica", "normal");
    sel.entries.forEach((e) => { doc.text(e.date.slice(0, 10), 14, y); doc.text(euro(e.deposit), 55, y); doc.text(euro(e.bonus), 95, y); doc.text(euro(e.total), 135, y); doc.text(e.payment_friday, 165, y); y += 6; });
    y += 2; doc.line(14, y, 196, y); y += 6; doc.setFont("helvetica", "bold");
    doc.text("TOTAL GERAL", 14, y); doc.text(euro(sel.total_deposit), 55, y); doc.text(euro(sel.total_bonus), 95, y); doc.text(euro(sel.total), 135, y);
    doc.save(`calculo_${sel.name}.pdf`);
  };

  const inp = "w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-[#D4AF37]";
  return (
    <>
      <PageHeader title="Cálculo" subtitle="Perfis de depósito · Bónus 20% · Sexta-feira de pagamento" />
      <div className="grid gap-5 lg:grid-cols-3">
        <Card>
          <h3 className="mb-3 font-head font-semibold text-[#0B1A30]">Perfis</h3>
          <div className="mb-3 flex gap-2">
            <input className={inp} placeholder="Nome do perfil" data-testid="calc-profile-input" value={newName} onChange={(e) => setNewName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addProfile()} />
            <button data-testid="add-profile-btn" onClick={addProfile} className="grid place-items-center rounded-lg bg-[#0B1A30] px-3 text-white"><Plus size={16} /></button>
          </div>
          {!profiles ? <Loading /> : profiles.length === 0 ? <Empty icon={Calculator} title="Sem perfis" /> : (
            <div className="space-y-2">
              {profiles.map((p) => (
                <div key={p.id} onClick={() => setSel(p)} data-testid={`profile-${p.id}`}
                  className={`flex cursor-pointer items-center justify-between rounded-lg border px-3 py-2.5 ${sel?.id === p.id ? "border-[#D4AF37] bg-[#FFFBEB]" : "border-slate-200 hover:bg-slate-50"}`}>
                  <div><div className="font-semibold text-[#0B1A30]">{p.name}</div><div className="text-xs text-slate-400">{p.entries.length} depósitos · {euro(p.total)}</div></div>
                  <button onClick={(e) => { e.stopPropagation(); delProfile(p.id); }} className="rounded p-1 text-red-500 hover:bg-red-50"><Trash2 size={15} /></button>
                </div>
              ))}
            </div>
          )}
        </Card>

        <div className="lg:col-span-2">
          {!sel ? <Empty icon={Calculator} title="Selecione um perfil" subtitle="Escolha ou crie um perfil para registar depósitos" /> : (
            <>
              <Card className="mb-5">
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="font-head font-semibold text-[#0B1A30]">{sel.name}</h3>
                  <div className="flex gap-2">
                    <GoldButton data-testid="calc-export-pdf" onClick={exportPdf}><FileDown size={14} className="mr-1 inline" /> PDF</GoldButton>
                    <NavyButton data-testid="calc-export-xlsx" onClick={exportXlsx}><FileSpreadsheet size={14} className="mr-1 inline" /> XLSX</NavyButton>
                  </div>
                </div>
                <div className="grid gap-3 sm:grid-cols-3">
                  <div><label className="mb-1 block text-xs font-semibold uppercase text-slate-500">Depósito (€)</label><input type="number" className={inp} data-testid="deposit-input" value={entry.deposit} onChange={(e) => setEntry({ ...entry, deposit: e.target.value })} /></div>
                  <div><label className="mb-1 block text-xs font-semibold uppercase text-slate-500">Data</label><input type="date" className={inp} value={entry.date} onChange={(e) => setEntry({ ...entry, date: e.target.value })} /></div>
                  <div className="flex items-end"><GoldButton data-testid="add-deposit-btn" className="w-full" onClick={addEntry}>Registar · Bónus {euro(bonus)}</GoldButton></div>
                </div>
              </Card>

              <div className="mb-5 grid grid-cols-3 gap-4">
                <Card><div className="text-xs uppercase text-slate-400">Depósitos</div><div className="mt-1 font-head text-lg font-bold text-[#0B1A30]">{euro(sel.total_deposit)}</div></Card>
                <Card><div className="text-xs uppercase text-slate-400">Bónus 20%</div><div className="mt-1 font-head text-lg font-bold text-[#D4AF37]">{euro(sel.total_bonus)}</div></Card>
                <Card><div className="text-xs uppercase text-slate-400">Total</div><div className="mt-1 font-head text-lg font-bold text-green-600">{euro(sel.total)}</div></Card>
              </div>

              <Card className="p-0 overflow-hidden">
                {sel.entries.length === 0 ? <Empty icon={CalendarClock} title="Sem depósitos" /> : (
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50"><tr className="text-left text-xs uppercase text-slate-400"><th className="px-5 py-3">Data</th><th>Depósito</th><th>Bónus</th><th>Total</th><th>Sexta-feira</th><th>Estado</th><th></th></tr></thead>
                    <tbody>{sel.entries.map((e) => (
                      <tr key={e.id} className="border-t border-slate-100" data-testid={`entry-${e.id}`}>
                        <td className="px-5 py-2.5">{e.date.slice(0, 10)}</td><td>{euro(e.deposit)}</td><td className="text-[#D4AF37] font-semibold">{euro(e.bonus)}</td><td className="font-semibold">{euro(e.total)}</td>
                        <td className="text-slate-600">{e.payment_friday}</td>
                        <td><span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${e.status === "ativo" ? "bg-blue-100 text-blue-700" : "bg-slate-100 text-slate-500"}`}>{e.status === "ativo" ? "Ativo" : "Arquivado"}</span></td>
                        <td className="px-4 text-right"><button onClick={() => delEntry(e.id)} className="rounded p-1.5 text-red-500 hover:bg-red-50"><Trash2 size={15} /></button></td>
                      </tr>))}
                    </tbody>
                  </table>
                )}
              </Card>
            </>
          )}
        </div>
      </div>
    </>
  );
}
