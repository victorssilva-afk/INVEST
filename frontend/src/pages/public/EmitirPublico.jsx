import { useState } from "react";
import { useParams } from "react-router-dom";
import axios from "axios";
import { API } from "@/lib/api";
import { eur } from "@/lib/format";
import { maskIban } from "@/lib/iban";
import { PT_BANKS_MAIN, PT_BANKS_OTHER } from "@/lib/iban";
import { generateInvoicePdf } from "@/lib/invoicePdf";
import { toast } from "sonner";
import { FileText, Download, CheckCircle2 } from "lucide-react";

const DUE = [["1h", "1 hora"], ["3h", "3 horas"], ["1d", "1 dia"], ["3d", "3 dias"], ["4d", "4 dias"], ["5d", "5 dias"]];

export default function EmitirPublico() {
  const { tenant } = useParams();
  const [f, setF] = useState({
    sender: "", amount: "", currency: "EUR", recipient: "", iban: "",
    entity: "", reference: "", bank: "", bankOther: "",
    description: "Atlas Financeiro & Jurídico", due_label: "5d", international: false, swift: "", country: "",
  });
  const [result, setResult] = useState(null);
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));

  const bankName = f.bank === "__other__" ? f.bankOther : f.bank;
  const total = (+f.amount || 0);

  const submit = async () => {
    if (!f.sender.trim()) return toast.error("Indique o nome do remetente");
    if (!total) return toast.error("Indique o valor a transferir");
    if (!f.recipient.trim()) return toast.error("Indique o nome do destinatário");
    setSaving(true);
    try {
      const payload = {
        sender: { name: f.sender.trim() },
        recipient: { name: f.recipient.trim() },
        bank: {
          bank_name: bankName, holder: f.recipient.trim(), iban: f.iban.replace(/\s+/g, ""),
          swift: f.international ? f.swift : "", entity: f.entity, reference: f.reference,
        },
        international: f.international ? { swift: f.swift, country: f.country, iban: f.iban.replace(/\s+/g, "") } : {},
        items: [{ description: f.description || "Atlas Financeiro & Jurídico", quantity: 1, unit_price: total, discount: 0, vat: 0 }],
        due_label: f.due_label, currency: f.currency, notes: "", company_message: "", status: "pendente",
      };
      const { data } = await axios.post(`${API}/public/invoice/create?tenant=${tenant}`, payload);
      setResult(data);
      toast.success(`Fatura ${data.number} emitida`);
    } catch { toast.error("Erro ao emitir a fatura"); } finally { setSaving(false); }
  };

  const label = "block text-sm font-medium text-slate-700 mb-1.5";
  const inp = "w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-800 outline-none transition-colors focus:border-[#0B1A30] focus:ring-1 focus:ring-[#0B1A30]";

  if (result) return (
    <div className="min-h-screen bg-[#F4F5F7] px-4 py-10">
      <div className="mx-auto max-w-lg rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        <CheckCircle2 className="mx-auto text-emerald-600" size={44} />
        <h1 className="mt-3 font-head text-2xl font-bold text-[#0B1A30]">Fatura emitida</h1>
        <div className="my-1 font-mono text-lg font-semibold text-[#0B1A30]">{result.number}</div>
        <div className="text-3xl font-bold text-[#0B1A30]">{eur(result.totals.total, result.currency)}</div>
        {result.qr_code && <img src={result.qr_code} alt="QR" className="mx-auto my-4 h-36 w-36" />}
        <div className="flex flex-col gap-2">
          <button data-testid="pub-download-pdf" onClick={() => generateInvoicePdf(result)}
            className="flex items-center justify-center gap-2 rounded-lg bg-[#0B1A30] px-5 py-3 font-semibold text-white hover:bg-[#132845]">
            <Download size={17} /> Descarregar fatura (PDF)
          </button>
          <a href={result.public_link} className="break-all text-xs text-slate-500 underline">{result.public_link}</a>
          <button onClick={() => setResult(null)} className="mt-1 text-sm font-medium text-slate-500 hover:text-[#0B1A30]">Emitir outra fatura</button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#F4F5F7] px-4 py-8">
      <div className="mx-auto max-w-2xl rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <h1 className="font-head text-2xl font-bold text-[#0B1A30]">Emitir nova fatura</h1>
        <p className="mt-1 mb-6 text-sm text-slate-500">Preencha os dados abaixo. A fatura é gerada com número automático e link partilhável.</p>

        <div className="space-y-5">
          <div>
            <label className={label}>Nome do Remetente *</label>
            <input className={inp} data-testid="pub-sender" placeholder="Quem emite / envia" value={f.sender} onChange={(e) => set("sender", e.target.value)} />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <label className={label}>Valor a Transferir *</label>
              <input className={inp} data-testid="pub-amount" type="number" placeholder="0,00" value={f.amount} onChange={(e) => set("amount", e.target.value)} />
            </div>
            <div>
              <label className={label}>Moeda</label>
              <select className={inp} value={f.currency} onChange={(e) => set("currency", e.target.value)}>
                <option>EUR</option><option>USD</option><option>GBP</option><option>CHF</option>
              </select>
            </div>
          </div>

          <div>
            <label className={label}>Nome do Destinatário completo *</label>
            <input className={inp} data-testid="pub-recipient" placeholder="Titular que recebe o pagamento" value={f.recipient} onChange={(e) => set("recipient", e.target.value)} />
          </div>

          <div>
            <label className={label}>IBAN do Destinatário</label>
            <input className={`${inp} font-mono`} data-testid="pub-iban" placeholder="PT50 0000 0000 0000 0000 0000 0" value={maskIban(f.iban)} onChange={(e) => set("iban", e.target.value)} />
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <div className="font-head text-sm font-semibold text-[#0B1A30]">Pagamento por Referência (Multibanco)</div>
            <p className="mb-3 text-xs text-slate-500">Opcional. Preencha o IBAN acima <b>ou</b> a Entidade + Referência abaixo.</p>
            <div className="grid grid-cols-2 gap-3">
              <div><label className={label}>Entidade</label><input className={inp} placeholder="Ex.: 21234" value={f.entity} onChange={(e) => set("entity", e.target.value)} /></div>
              <div><label className={label}>Referência</label><input className={inp} placeholder="Ex.: 123 456 789" value={f.reference} onChange={(e) => set("reference", e.target.value)} /></div>
            </div>
          </div>

          <div>
            <label className={label}>Banco</label>
            <select className={inp} data-testid="pub-bank" value={f.bank} onChange={(e) => set("bank", e.target.value)}>
              <option value="">Selecionar banco…</option>
              {PT_BANKS_MAIN.map((b) => <option key={b} value={b}>{b}</option>)}
              {PT_BANKS_OTHER.map((b) => <option key={b} value={b}>{b}</option>)}
              <option value="__other__">Outros (escrever)…</option>
            </select>
            {f.bank === "__other__" && <input className={`${inp} mt-2`} placeholder="Escreva o nome do banco" value={f.bankOther} onChange={(e) => set("bankOther", e.target.value)} />}
          </div>

          <div>
            <label className={label}>Descrição</label>
            <input className={inp} data-testid="pub-description" value={f.description} onChange={(e) => set("description", e.target.value)} />
          </div>

          <div>
            <label className={label}>Prazo de Vencimento / Expiração</label>
            <select className={inp} data-testid="pub-due" value={f.due_label} onChange={(e) => set("due_label", e.target.value)}>
              {DUE.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>

          <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-slate-200 p-4">
            <input type="checkbox" className="h-4 w-4" checked={f.international} onChange={(e) => set("international", e.target.checked)} />
            <span className="text-sm font-medium text-slate-700">Fatura Internacional</span>
          </label>
          {f.international && (
            <div className="grid grid-cols-2 gap-3">
              <div><label className={label}>SWIFT / BIC</label><input className={inp} value={f.swift} onChange={(e) => set("swift", e.target.value)} /></div>
              <div><label className={label}>País</label><input className={inp} value={f.country} onChange={(e) => set("country", e.target.value)} /></div>
            </div>
          )}

          <div className="rounded-lg bg-slate-50 px-4 py-3 text-sm text-slate-600">Total da fatura: <b className="text-[#0B1A30]">{eur(total, f.currency)}</b></div>

          <button data-testid="pub-emit-btn" onClick={submit} disabled={saving}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#0B1A30] px-6 py-3.5 font-semibold text-white transition-colors hover:bg-[#132845] disabled:opacity-60">
            <FileText size={17} /> {saving ? "A emitir…" : "Emitir Fatura"}
          </button>
        </div>
      </div>
    </div>
  );
}
