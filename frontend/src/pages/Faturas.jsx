import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api, { apiError } from "@/lib/api";
import { eur, fmtDate } from "@/lib/format";
import StatusBadge from "@/components/StatusBadge";
import { Card, PageHeader, Loading, Empty, GoldButton } from "@/components/ui/primitives";
import { Search, Receipt, Eye, Copy, ExternalLink, MessageCircle, Link2, Upload } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";

const FILTERS = [
  { k: "", l: "Todas" }, { k: "pendente", l: "Pendentes" }, { k: "pago", l: "Pagas" },
  { k: "analise", l: "Em Análise" }, { k: "expirado", l: "Expiradas" }, { k: "cancelado", l: "Canceladas" },
];

export default function Faturas() {
  const [invoices, setInvoices] = useState(null);
  const [status, setStatus] = useState("");
  const [q, setQ] = useState("");
  const navigate = useNavigate();
  const { user } = useAuth();
  const tenant = user?.tenant_id || "invest";
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const emitLink = `${origin}/emitir/${tenant}`;
  const uploadLink = `${origin}/enviar/${tenant}`;
  const copy = (t) => { navigator.clipboard.writeText(t); toast.success("Link copiado"); };
  const wa = (t) => window.open(`https://wa.me/?text=${encodeURIComponent(t)}`, "_blank");

  const load = () => {
    setInvoices(null);
    api.get("/invoices", { params: { status, q } }).then((r) => setInvoices(r.data)).catch((e) => toast.error(apiError(e)));
  };
  useEffect(() => { load(); }, [status]);

  return (
    <>
      <PageHeader title="Faturas" subtitle="Emitir, gerir e acompanhar o estado das faturas">
        <GoldButton data-testid="new-invoice-btn" onClick={() => navigate("/app/faturas/nova")}>+ Nova Fatura</GoldButton>
      </PageHeader>

      <Card className="mb-5 navy-gradient text-white">
        <div className="flex items-center gap-2 font-head font-semibold"><Link2 size={18} className="text-[#D4AF37]" /> Páginas públicas — Mesa {tenant}</div>
        <p className="mt-1 text-sm text-slate-300">Partilhe estes links. Qualquer pessoa pode emitir uma fatura ou enviar documentos sem precisar de conta.</p>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {[
            { title: "Emitir fatura", desc: "Formulário público de emissão", link: emitLink, icon: Receipt, testid: "public-emit" },
            { title: "Enviar fotos/documentos", desc: "Envio direto de ficheiros", link: uploadLink, icon: Upload, testid: "public-upload" },
          ].map((x) => (
            <div key={x.testid} className="rounded-xl border border-white/10 bg-white/5 p-4">
              <div className="flex items-center gap-2 font-semibold"><x.icon size={16} className="text-[#D4AF37]" /> {x.title}</div>
              <div className="mt-1 truncate font-mono text-xs text-slate-300" data-testid={`${x.testid}-link`}>{x.link}</div>
              <div className="mt-3 flex flex-wrap gap-2">
                <a href={x.link} target="_blank" rel="noreferrer" data-testid={`${x.testid}-open`} className="flex items-center gap-1.5 rounded-lg gold-gradient px-3 py-1.5 text-xs font-semibold text-[#0B1A30]"><ExternalLink size={13} /> Abrir</a>
                <button onClick={() => copy(x.link)} data-testid={`${x.testid}-copy`} className="flex items-center gap-1.5 rounded-lg bg-white/10 px-3 py-1.5 text-xs font-semibold hover:bg-white/20"><Copy size={13} /> Copiar</button>
                <button onClick={() => wa(`${x.title} INVEST: ${x.link}`)} data-testid={`${x.testid}-wa`} className="flex items-center gap-1.5 rounded-lg bg-white/10 px-3 py-1.5 text-xs font-semibold hover:bg-white/20"><MessageCircle size={13} /> WhatsApp</button>
              </div>
            </div>
          ))}
        </div>
      </Card>

      <Card className="mb-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="flex flex-1 items-center gap-2 rounded-lg border border-slate-200 px-3">
            <Search size={16} className="text-slate-400" />
            <input data-testid="invoice-search-input" value={q} onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && load()}
              placeholder="Pesquisar por número ou cliente…" className="w-full bg-transparent py-2 text-sm outline-none" />
          </div>
          <div className="flex flex-wrap gap-2">
            {FILTERS.map((f) => (
              <button key={f.k} data-testid={`filter-${f.k || "all"}`} onClick={() => setStatus(f.k)}
                className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${status === f.k ? "bg-[#0B1A30] text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}>
                {f.l}
              </button>
            ))}
          </div>
        </div>
      </Card>

      {!invoices ? <Loading /> : invoices.length === 0 ? (
        <Empty icon={Receipt} title="Sem faturas" subtitle="Crie a primeira fatura para começar" />
      ) : (
        <Card className="p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50">
                <tr className="text-left text-xs uppercase tracking-wide text-slate-400">
                  <th className="px-5 py-3">Número</th><th>Cliente</th><th>Emissão</th><th>Vencimento</th><th>Estado</th><th className="text-right">Total</th><th></th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((inv) => (
                  <tr key={inv.id} className="border-t border-slate-100 hover:bg-slate-50" data-testid={`invoice-row-${inv.number}`}>
                    <td className="px-5 py-3 font-mono text-xs font-semibold text-[#0B1A30]">{inv.number}</td>
                    <td>{inv.recipient?.name || "—"}</td>
                    <td className="text-slate-500">{fmtDate(inv.issue_date)}</td>
                    <td className="text-slate-500">{fmtDate(inv.due_date, true)}</td>
                    <td><StatusBadge status={inv.status} /></td>
                    <td className="text-right font-semibold">{eur(inv.totals?.total, inv.currency)}</td>
                    <td className="px-4 text-right">
                      <button data-testid={`view-invoice-${inv.number}`} onClick={() => navigate(`/app/faturas/${inv.id}`)}
                        className="rounded-lg p-2 text-slate-500 hover:bg-slate-200 hover:text-[#0B1A30]"><Eye size={16} /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </>
  );
}
