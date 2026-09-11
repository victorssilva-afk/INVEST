import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "@/lib/api";
import { eur, fmtDate } from "@/lib/format";
import StatusBadge from "@/components/StatusBadge";
import { Card, PageHeader, Loading } from "@/components/ui/primitives";
import { TrendingUp, CheckCircle2, Clock, XCircle, Search, Ban, Users, FileText } from "lucide-react";
import { BarChart, Bar, ResponsiveContainer, XAxis, YAxis, Tooltip, PieChart, Pie, Cell, CartesianGrid } from "recharts";

const KPIS = [
  { key: "faturado", label: "Faturado", icon: TrendingUp, color: "#0B1A30" },
  { key: "pago", label: "Pago", icon: CheckCircle2, color: "#15803D" },
  { key: "pendente", label: "Pendente", icon: Clock, color: "#D97706" },
  { key: "expirado", label: "Expirado", icon: XCircle, color: "#B91C1C" },
  { key: "analise", label: "Em Análise", icon: Search, color: "#1D4ED8" },
  { key: "cancelado", label: "Cancelado", icon: Ban, color: "#475569" },
];
const PIE_COLORS = { pendente: "#D97706", pago: "#15803D", expirado: "#B91C1C", cancelado: "#94A3B8", analise: "#1D4ED8" };

export default function Dashboard() {
  const [data, setData] = useState(null);
  const navigate = useNavigate();

  useEffect(() => { api.get("/dashboard").then((r) => setData(r.data)).catch(() => {}); }, []);
  if (!data) return <Loading />;

  const pie = Object.entries(data.by_status).filter(([, v]) => v > 0).map(([k, v]) => ({ name: k, value: v }));

  return (
    <>
      <PageHeader title="Dashboard Executivo" subtitle="Visão geral da Mesa · valores em tempo real do backend" />

      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
        {KPIS.map((k, i) => (
          <Card key={k.key} className="card-hover" style={{ animationDelay: `${i * 40}ms` }} data-testid={`kpi-${k.key}`}>
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">{k.label}</span>
              <k.icon size={18} style={{ color: k.color }} />
            </div>
            <div className="mt-2 font-head text-xl font-bold text-[#0B1A30] truncate">{eur(data.kpis[k.key])}</div>
          </Card>
        ))}
      </div>

      <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-head text-lg font-semibold text-[#0B1A30]">Faturação mensal</h2>
            <div className="flex gap-4 text-xs text-slate-500">
              <span className="flex items-center gap-1.5"><Users size={14} /> {data.kpis.n_clientes} clientes</span>
              <span className="flex items-center gap-1.5"><FileText size={14} /> {data.kpis.n_faturas} faturas</span>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={data.monthly}>
              <CartesianGrid strokeDasharray="3 3" stroke="#eef2f7" vertical={false} />
              <XAxis dataKey="month" tick={{ fontSize: 12, fill: "#64748b" }} />
              <YAxis tick={{ fontSize: 12, fill: "#64748b" }} />
              <Tooltip formatter={(v) => eur(v)} contentStyle={{ borderRadius: 10, border: "1px solid #e2e8f0" }} />
              <Bar dataKey="total" fill="#D4AF37" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>

        <Card>
          <h2 className="mb-4 font-head text-lg font-semibold text-[#0B1A30]">Distribuição por estado</h2>
          {pie.length === 0 ? (
            <div className="grid h-[240px] place-items-center text-sm text-slate-400">Sem faturas ainda</div>
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie data={pie} dataKey="value" nameKey="name" innerRadius={55} outerRadius={90} paddingAngle={3}>
                  {pie.map((e) => <Cell key={e.name} fill={PIE_COLORS[e.name]} />)}
                </Pie>
                <Tooltip contentStyle={{ borderRadius: 10, border: "1px solid #e2e8f0" }} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </Card>
      </div>

      <Card className="mt-5">
        <h2 className="mb-4 font-head text-lg font-semibold text-[#0B1A30]">Faturas recentes</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-400">
                <th className="py-2">Número</th><th>Cliente</th><th>Emissão</th><th>Estado</th><th className="text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {data.recent.map((inv) => (
                <tr key={inv.id} onClick={() => navigate(`/app/faturas/${inv.id}`)} data-testid={`recent-invoice-${inv.number}`}
                    className="cursor-pointer border-b border-slate-100 hover:bg-slate-50">
                  <td className="py-3 font-mono text-xs font-semibold text-[#0B1A30]">{inv.number}</td>
                  <td>{inv.recipient?.name || "—"}</td>
                  <td className="text-slate-500">{fmtDate(inv.issue_date)}</td>
                  <td><StatusBadge status={inv.status} /></td>
                  <td className="text-right font-semibold">{eur(inv.totals?.total, inv.currency)}</td>
                </tr>
              ))}
              {data.recent.length === 0 && <tr><td colSpan={5} className="py-8 text-center text-slate-400">Ainda não existem faturas</td></tr>}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  );
}
