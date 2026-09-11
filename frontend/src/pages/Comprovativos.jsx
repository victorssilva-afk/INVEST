import { useEffect, useState } from "react";
import api, { apiError, API } from "@/lib/api";
import { fmtDate } from "@/lib/format";
import StatusBadge from "@/components/StatusBadge";
import { PageHeader, Card, Loading, Empty } from "@/components/ui/primitives";
import { FileText, Check, X, RotateCcw, Eye, Download } from "lucide-react";
import { toast } from "sonner";

const MAP = { pendente: "analise", aceite: "pago", recusado: "expirado", pedir_novo: "cancelado" };
const LABEL = { pendente: "Pendente", aceite: "Aceite", recusado: "Recusado", pedir_novo: "Pedir novo" };

export default function Comprovativos() {
  const [proofs, setProofs] = useState(null);
  const [preview, setPreview] = useState(null);
  const load = () => api.get("/proofs").then((r) => setProofs(r.data)).catch((e) => toast.error(apiError(e)));
  useEffect(() => { load(); }, []);

  const review = async (id, status) => { try { await api.patch(`/proofs/${id}`, { status }); toast.success("Comprovativo atualizado"); load(); } catch (e) { toast.error(apiError(e)); } };
  const view = async (id) => { try { const { data } = await api.get(`/proofs/${id}/file`); setPreview(data); } catch (e) { toast.error(apiError(e)); } };

  return (
    <>
      <PageHeader title="Comprovativos" subtitle="Rever comprovativos de pagamento submetidos" />
      {!proofs ? <Loading /> : proofs.length === 0 ? <Empty icon={FileText} title="Sem comprovativos" subtitle="Os comprovativos submetidos aparecerão aqui" /> : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {proofs.map((p) => (
            <Card key={p.id} className="card-hover" data-testid={`proof-${p.id}`}>
              <div className="flex items-center justify-between">
                <div className="font-mono text-xs font-semibold text-[#0B1A30]">{p.invoice_number}</div>
                <StatusBadge status={MAP[p.status] || "analise"} />
              </div>
              <div className="mt-2 truncate text-sm text-slate-600">{p.filename}</div>
              {p.message && <div className="mt-1 text-xs text-slate-400">"{p.message}"</div>}
              <div className="mt-1 text-xs text-slate-400">{fmtDate(p.created_at, true)}</div>
              <div className="mt-3 flex flex-wrap gap-2">
                <button onClick={() => view(p.id)} className="flex items-center gap-1 rounded-lg bg-slate-100 px-2.5 py-1.5 text-xs font-semibold hover:bg-slate-200"><Eye size={13} /> Ver</button>
                <a href={p.file_data} download={p.filename} data-testid={`download-proof-${p.id}`} className="flex items-center gap-1 rounded-lg bg-[#0B1A30] px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-[#132845]"><Download size={13} /> Descarregar</a>
                <button data-testid={`accept-proof-${p.id}`} onClick={() => review(p.id, "aceite")} className="flex items-center gap-1 rounded-lg bg-green-600 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-green-700"><Check size={13} /> Aceitar</button>
                <button data-testid={`reject-proof-${p.id}`} onClick={() => review(p.id, "recusado")} className="flex items-center gap-1 rounded-lg bg-red-600 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-red-700"><X size={13} /> Recusar</button>
                <button onClick={() => review(p.id, "pedir_novo")} className="flex items-center gap-1 rounded-lg bg-amber-500 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-amber-600"><RotateCcw size={13} /> Pedir novo</button>
              </div>
            </Card>
          ))}
        </div>
      )}
      {preview && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4" onClick={() => setPreview(null)}>
          <div className="max-h-[85vh] max-w-2xl overflow-auto rounded-xl bg-white p-4" onClick={(e) => e.stopPropagation()}>
            <div className="mb-3 flex items-center justify-between gap-3">
              <div className="font-semibold">{preview.filename}</div>
              <a href={preview.file_data} download={preview.filename} data-testid="modal-download-proof" className="flex items-center gap-1.5 rounded-lg bg-[#0B1A30] px-3 py-1.5 text-sm font-semibold text-white hover:bg-[#132845]"><Download size={14} /> Descarregar</a>
            </div>
            {preview.file_data.startsWith("data:image") ? <img src={preview.file_data} alt="comprovativo" className="max-w-full rounded-lg" /> : <div className="rounded-lg bg-slate-50 p-6 text-center text-sm text-slate-500">Pré-visualização não disponível para este tipo de ficheiro. Use “Descarregar”.</div>}
          </div>
        </div>
      )}
    </>
  );
}
