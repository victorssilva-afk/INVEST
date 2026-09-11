import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import api, { apiError } from "@/lib/api";
import { eur, fmtDate } from "@/lib/format";
import StatusBadge from "@/components/StatusBadge";
import { PageHeader, Card, Loading, NavyButton } from "@/components/ui/primitives";
import { toast } from "sonner";

export default function ClienteDetalhe() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  useEffect(() => { api.get(`/clients/${id}`).then((r) => setData(r.data)).catch((e) => { toast.error(apiError(e)); navigate("/app/clientes"); }); }, [id]);
  if (!data) return <Loading />;
  const { client, invoices, metrics } = data;

  return (
    <>
      <PageHeader title={client.name} subtitle={client.company}>
        <NavyButton onClick={() => navigate("/app/clientes")}>Voltar</NavyButton>
      </PageHeader>
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {[["Total faturado", metrics.total_faturado], ["Pago", metrics.pago], ["Pendente", metrics.pendente]].map(([l, v]) => (
          <Card key={l}><div className="text-xs uppercase text-slate-400">{l}</div><div className="mt-1 font-head text-xl font-bold text-[#0B1A30]">{eur(v)}</div></Card>
        ))}
        <Card><div className="text-xs uppercase text-slate-400">Nº Faturas</div><div className="mt-1 font-head text-xl font-bold text-[#0B1A30]">{metrics.n_faturas}</div></Card>
      </div>
      <div className="mt-5 grid gap-5 lg:grid-cols-3">
        <Card><h3 className="mb-3 font-head font-semibold text-[#0B1A30]">Dados</h3>
          <div className="space-y-1.5 text-sm text-slate-600">
            {client.nif && <div>NIF: {client.nif}</div>}{client.email && <div>{client.email}</div>}{client.phone && <div>{client.phone}</div>}
            {client.address && <div>{client.address}</div>}<div>{[client.postal_code, client.city].filter(Boolean).join(" ")}</div><div>{client.country}</div>
          </div>
        </Card>
        <Card className="lg:col-span-2"><h3 className="mb-3 font-head font-semibold text-[#0B1A30]">Histórico de faturas</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-slate-200 text-left text-xs uppercase text-slate-400"><th className="py-2">Número</th><th>Data</th><th>Estado</th><th className="text-right">Total</th></tr></thead>
              <tbody>{invoices.map((i) => (
                <tr key={i.id} className="cursor-pointer border-b border-slate-100 hover:bg-slate-50" onClick={() => navigate(`/app/faturas/${i.id}`)}>
                  <td className="py-2.5 font-mono text-xs">{i.number}</td><td className="text-slate-500">{fmtDate(i.issue_date)}</td><td><StatusBadge status={i.status} /></td><td className="text-right font-semibold">{eur(i.totals.total, i.currency)}</td>
                </tr>))}
                {invoices.length === 0 && <tr><td colSpan={4} className="py-6 text-center text-slate-400">Sem faturas</td></tr>}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </>
  );
}
