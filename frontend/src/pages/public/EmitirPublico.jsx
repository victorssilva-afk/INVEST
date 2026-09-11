import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import axios from "axios";
import { API } from "@/lib/api";
import { eur } from "@/lib/format";
import { maskIban } from "@/lib/iban";
import { toast } from "sonner";
import { Send } from "lucide-react";

const emptyItem = { description: "", quantity: 1, unit_price: 0, discount: 0, vat: 23 };

export default function EmitirPublico() {
  const { tenant } = useParams();
  const [f, setF] = useState({ recipient: { name: "", nif: "", email: "" }, items: [{ ...emptyItem }], due_label: "3d", currency: "EUR", notes: "" });
  const [result, setResult] = useState(null);
  const [saving, setSaving] = useState(false);

  const setItem = (i, k, v) => setF((p) => ({ ...p, items: p.items.map((it, idx) => idx === i ? { ...it, [k]: v } : it) }));
  const total = f.items.reduce((a, it) => { const line = it.quantity * it.unit_price * (1 - it.discount / 100); return a + line * (1 + it.vat / 100); }, 0);

  const submit = async () => {
    if (!f.recipient.name || f.items.some((i) => !i.description)) return toast.error("Preencha nome e descrição dos itens");
    setSaving(true);
    try {
      const payload = { ...f, items: f.items.map((it) => ({ ...it, quantity: +it.quantity, unit_price: +it.unit_price, discount: +it.discount, vat: +it.vat })) };
      const { data } = await axios.post(`${API}/public/invoice/create?tenant=${tenant}`, payload);
      setResult(data); toast.success(`Fatura ${data.number} emitida`);
    } catch { toast.error("Erro ao emitir fatura"); } finally { setSaving(false); }
  };

  const inp = "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#D4AF37]";

  if (result) return (
    <div className="min-h-screen navy-gradient grid place-items-center p-6 text-white">
      <div className="max-w-md rounded-2xl bg-white p-8 text-center text-[#0B1A30]">
        <div className="font-head text-2xl font-bold">Fatura emitida</div>
        <div className="my-2 font-mono text-lg text-[#D4AF37]">{result.number}</div>
        <div className="text-3xl font-bold">{eur(result.totals.total, result.currency)}</div>
        {result.qr_code && <img src={result.qr_code} alt="QR" className="mx-auto my-4 h-40 w-40" />}
        <a href={result.public_link} className="text-blue-600 underline break-all text-sm">{result.public_link}</a>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#F8FAFC] p-6">
      <div className="mx-auto max-w-2xl">
        <div className="mb-6 text-center"><div className="font-head text-3xl font-extrabold text-[#0B1A30]">IN<span className="text-[#D4AF37]">VEST</span></div><p className="text-slate-500">Emissão pública · Mesa {tenant}</p></div>
        <div className="space-y-4 rounded-2xl bg-white p-6 shadow-sm">
          <div className="grid gap-3 sm:grid-cols-3">
            <input className={inp} placeholder="Nome *" data-testid="pub-recipient-name" value={f.recipient.name} onChange={(e) => setF({ ...f, recipient: { ...f.recipient, name: e.target.value } })} />
            <input className={inp} placeholder="NIF" value={f.recipient.nif} onChange={(e) => setF({ ...f, recipient: { ...f.recipient, nif: e.target.value } })} />
            <input className={inp} placeholder="Email" value={f.recipient.email} onChange={(e) => setF({ ...f, recipient: { ...f.recipient, email: e.target.value } })} />
          </div>
          {f.items.map((it, i) => (
            <div key={i} className="grid grid-cols-12 gap-2">
              <input className={`${inp} col-span-6`} placeholder="Descrição" value={it.description} onChange={(e) => setItem(i, "description", e.target.value)} />
              <input className={`${inp} col-span-2`} type="number" placeholder="Qt" value={it.quantity} onChange={(e) => setItem(i, "quantity", e.target.value)} />
              <input className={`${inp} col-span-2`} type="number" placeholder="Preço" value={it.unit_price} onChange={(e) => setItem(i, "unit_price", e.target.value)} />
              <input className={`${inp} col-span-2`} type="number" placeholder="IVA%" value={it.vat} onChange={(e) => setItem(i, "vat", e.target.value)} />
            </div>
          ))}
          <button onClick={() => setF((p) => ({ ...p, items: [...p.items, { ...emptyItem }] }))} className="text-sm font-semibold text-[#0B1A30]">+ Adicionar item</button>
          <div className="flex items-center justify-between border-t pt-4"><span className="text-lg font-bold">Total: {eur(total, f.currency)}</span>
            <button data-testid="pub-emit-btn" onClick={submit} disabled={saving} className="gold-gradient flex items-center gap-2 rounded-lg px-6 py-2.5 font-semibold text-[#0B1A30]"><Send size={16} /> {saving ? "A emitir…" : "Emitir Fatura"}</button>
          </div>
        </div>
      </div>
    </div>
  );
}
