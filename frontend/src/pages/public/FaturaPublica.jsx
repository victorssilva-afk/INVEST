import { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import axios from "axios";
import { API } from "@/lib/api";
import { eur, fmtDate } from "@/lib/format";
import { maskIban } from "@/lib/iban";
import StatusBadge from "@/components/StatusBadge";
import { generateInvoicePdf } from "@/lib/invoicePdf";
import { toast } from "sonner";
import { FileDown, Upload } from "lucide-react";

export default function FaturaPublica() {
  const { number } = useParams();
  const [inv, setInv] = useState(undefined);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef();

  useEffect(() => { axios.get(`${API}/public/invoice/${number}`).then((r) => setInv(r.data)).catch(() => setInv(null)); }, [number]);

  const sendProof = async (file) => {
    if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData(); fd.append("invoice_number", number); fd.append("file", file);
      await axios.post(`${API}/public/proof/${inv.tenant_id}`, fd);
      toast.success("Comprovativo submetido. Em análise.");
      const r = await axios.get(`${API}/public/invoice/${number}`); setInv(r.data);
    } catch { toast.error("Falha ao enviar comprovativo"); } finally { setUploading(false); }
  };

  if (inv === undefined) return <div className="min-h-screen navy-gradient grid place-items-center text-white">A carregar…</div>;
  if (inv === null) return <div className="min-h-screen navy-gradient grid place-items-center text-white">Fatura não encontrada</div>;

  return (
    <div className="min-h-screen bg-[#F8FAFC] p-4 sm:p-8">
      <div className="mx-auto max-w-2xl">
        <div className="mb-6 flex items-center justify-between">
          <div className="font-head text-2xl font-extrabold text-[#0B1A30]">IN<span className="text-[#D4AF37]">VEST</span></div>
          <button data-testid="public-pdf-btn" onClick={() => generateInvoicePdf(inv)} className="gold-gradient flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold text-[#0B1A30]"><FileDown size={15} /> PDF</button>
        </div>
        <div className="rounded-2xl bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <div><div className="font-mono text-lg font-bold text-[#0B1A30]">{inv.number}</div><div className="text-sm text-slate-400">Vencimento: {fmtDate(inv.due_date, true)}</div></div>
            <StatusBadge status={inv.status} />
          </div>
          <div className="my-4 border-y border-slate-100 py-4">
            {inv.items.map((it, i) => (
              <div key={i} className="flex justify-between py-1 text-sm"><span>{it.description} ×{it.quantity}</span><span>{eur(it.quantity * it.unit_price * (1 - it.discount / 100), inv.currency)}</span></div>
            ))}
          </div>
          <div className="flex justify-between text-xl font-bold text-[#0B1A30]"><span>Total</span><span>{eur(inv.totals.total, inv.currency)}</span></div>
          {inv.bank?.iban && <div className="mt-4 rounded-lg bg-[#FFFBEB] p-4 text-sm"><div className="font-semibold text-[#0B1A30]">Pagamento</div><div className="font-mono">{maskIban(inv.bank.iban)}</div>{inv.bank.holder && <div>{inv.bank.holder}</div>}</div>}
          {inv.bank?.entity && <div className="mt-2 rounded-lg bg-[#FFFBEB] p-4 text-sm">Multibanco — Entidade {inv.bank.entity} · Ref {inv.bank.reference}</div>}
          {inv.qr_code && <img src={inv.qr_code} alt="QR" className="mx-auto mt-4 h-32 w-32" />}

          <div className="mt-6 border-t border-slate-100 pt-4">
            <button data-testid="public-submit-proof-btn" onClick={() => fileRef.current.click()} disabled={uploading} className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#0B1A30] py-3 font-semibold text-white hover:bg-[#172F54]"><Upload size={16} /> {uploading ? "A enviar…" : "Submeter comprovativo"}</button>
            <input ref={fileRef} type="file" hidden onChange={(e) => sendProof(e.target.files[0])} />
          </div>
        </div>
      </div>
    </div>
  );
}
