/* eslint-disable react-hooks/exhaustive-deps */
import { useEffect, useState } from "react";
import api, { apiError, API } from "@/lib/api";
import { eur, fmtDate } from "@/lib/format";
import StatusBadge from "@/components/StatusBadge";
import { PageHeader, Card, Loading, GoldButton, NavyButton } from "@/components/ui/primitives";
import { FileSpreadsheet, FileText } from "lucide-react";
import { toast } from "sonner";

export default function Relatorios() {
  const [data, setData] = useState(null);
  const [filters, setFilters] = useState({ date_from: "", date_to: "", status: "" });
  const load = () => { setData(null); api.get("/reports", { params: filters }).then((r) => setData(r.data)).catch((e) => toast.error(apiError(e))); };
  useEffect(() => { load(); }, []);

  const download = async (fmt) => {
    try {
      const res = await api.get("/reports/export", { params: { fmt, status: filters.status }, responseType: "blob" });
      const url = URL.createObjectURL(res.data);
      const a = document.createElement("a"); a.href = url; a.download = `relatorio_invest.${fmt === "xlsx" ? "xlsx" : "csv"}`; a.click(); URL.revokeObjectURL(url);
      toast.success(`Exportado ${fmt.toUpperCase()}`);
    } catch (e) { toast.error(apiError(e)); }
  };
  const inp = "rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-[#D4AF37]";

  return (
    <>
      <PageHeader title="Relatórios" subtitle="Métricas, filtros e exportação real (CSV / XLSX)">
        <GoldButton data-testid="export-csv-btn" onClick={() => download("csv")}><FileText size={15} className="mr-1 inline" /> CSV</GoldButton>
        <NavyButton data-testid="export-xlsx-btn" onClick={() => download("xlsx")}><FileSpreadsheet size={15} className="mr-1 inline" /> XLSX</NavyButton>
      </PageHeader>

      <Card className="mb-5">
        <div className="flex flex-wrap items-end gap-3">
          <div><label className="mb-1 block text-xs font-semibold uppercase text-slate-500">De</label><input type="date" className={inp} value={filters.date_from} onChange={(e) => setFilters({ ...filters, date_from: e.target.value })} /></div>
          <div><label className="mb-1 block text-xs font-semibold uppercase text-slate-500">Até</label><input type="date" className={inp} value={filters.date_to} onChange={(e) => setFilters({ ...filters, date_to: e.target.value })} /></div>
          <div><label className="mb-1 block text-xs font-semibold uppercase text-slate-500">Estado</label>
            <select className={inp} value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value })}>
              <option value="">Todos</option><option value="pendente">Pendente</option><option value="pago">Pago</option><option value="expirado">Expirado</option><option value="analise">Em Análise</option><option value="cancelado">Cancelado</option>
            </select>
          </div>
          <GoldButton data-testid="apply-filters-btn" onClick={load}>Aplicar</GoldButton>
        </div>
      </Card>

      {!data ? <Loading /> : (
        <>
          <div className="mb-5 grid grid-cols-2 gap-4 md:grid-cols-4">
            <Card><div className="text-xs uppercase text-slate-400">Faturas</div><div className="mt-1 font-head text-xl font-bold text-[#0B1A30]">{data.count}</div></Card>
            <Card><div className="text-xs uppercase text-slate-400">Total</div><div className="mt-1 font-head text-xl font-bold text-[#0B1A30]">{eur(data.total)}</div></Card>
            <Card><div className="text-xs uppercase text-slate-400">Pago</div><div className="mt-1 font-head text-xl font-bold text-green-600">{eur(data.pago)}</div></Card>
            <Card><div className="text-xs uppercase text-slate-400">Pendente</div><div className="mt-1 font-head text-xl font-bold text-amber-600">{eur(data.pendente)}</div></Card>
          </div>
          <Card className="p-0 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50"><tr className="text-left text-xs uppercase text-slate-400"><th className="px-5 py-3">Número</th><th>Cliente</th><th>Data</th><th>Estado</th><th className="px-5 text-right">Total</th></tr></thead>
                <tbody>{data.invoices.map((i) => (
                  <tr key={i.id} className="border-t border-slate-100"><td className="px-5 py-2.5 font-mono text-xs">{i.number}</td><td>{i.recipient?.name || "—"}</td><td className="text-slate-500">{fmtDate(i.issue_date)}</td><td><StatusBadge status={i.status} /></td><td className="px-5 text-right font-semibold">{eur(i.totals.total, i.currency)}</td></tr>
                ))}
                  {data.invoices.length === 0 && <tr><td colSpan={5} className="py-8 text-center text-slate-400">Sem resultados</td></tr>}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}
    </>
  );
}
