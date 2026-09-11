import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import api, { apiError } from "@/lib/api";
import { eur } from "@/lib/format";
import { maskIban, validateIban, PT_BANKS_MAIN, PT_BANKS_OTHER } from "@/lib/iban";
import { PageHeader, Card, GoldButton, NavyButton, Loading } from "@/components/ui/primitives";
import { Trash2, Plus, Save } from "lucide-react";
import { toast } from "sonner";

const DUE = [
  { k: "1h", l: "1 hora" }, { k: "3h", l: "3 horas" }, { k: "1d", l: "1 dia" },
  { k: "3d", l: "3 dias" }, { k: "4d", l: "4 dias" }, { k: "5d", l: "5 dias" },
];
const emptyItem = { description: "", quantity: 1, unit_price: 0, discount: 0, vat: 23 };

export default function FaturaForm() {
  const { id } = useParams();
  const editing = !!id;
  const navigate = useNavigate();
  const [clients, setClients] = useState([]);
  const [nextNumber, setNextNumber] = useState("");
  const [loading, setLoading] = useState(editing);
  const [saving, setSaving] = useState(false);
  const [f, setF] = useState({
    client_id: "", recipient: {}, sender: {}, items: [{ ...emptyItem }],
    due_label: "3d", currency: "EUR", bank: {}, international: {},
    notes: "", company_message: "Obrigado pela preferência.", status: "pendente",
  });
  const [bankMode, setBankMode] = useState("iban");

  useEffect(() => {
    api.get("/clients").then((r) => setClients(r.data)).catch(() => {});
    api.get("/settings").then((r) => setF((p) => ({ ...p, sender: r.data.sender || {}, bank: r.data.bank || {}, currency: r.data.default_currency || "EUR" }))).catch(() => {});
    if (!editing) api.get("/invoices/next-number").then((r) => setNextNumber(r.data.number)).catch(() => {});
    if (editing) api.get(`/invoices/${id}`).then((r) => {
      const d = r.data;
      setF({ client_id: d.client_id || "", recipient: d.recipient || {}, sender: d.sender || {}, items: d.items?.length ? d.items : [{ ...emptyItem }], due_label: "3d", currency: d.currency, bank: d.bank || {}, international: d.international || {}, notes: d.notes || "", company_message: d.company_message || "", status: d.status });
      setNextNumber(d.number);
    }).catch((e) => toast.error(apiError(e))).finally(() => setLoading(false));
  }, [id]);

  const totals = useMemo(() => {
    let subtotal = 0, discount = 0, vat = 0;
    f.items.forEach((it) => {
      const line = (+it.quantity || 0) * (+it.unit_price || 0);
      const d = line * ((+it.discount || 0) / 100);
      const base = line - d;
      subtotal += line; discount += d; vat += base * ((+it.vat || 0) / 100);
    });
    return { subtotal, discount, vat, total: subtotal - discount + vat };
  }, [f.items]);

  const setItem = (i, key, val) => setF((p) => ({ ...p, items: p.items.map((it, idx) => idx === i ? { ...it, [key]: val } : it) }));
  const addItem = () => setF((p) => ({ ...p, items: [...p.items, { ...emptyItem }] }));
  const rmItem = (i) => setF((p) => ({ ...p, items: p.items.filter((_, idx) => idx !== i) }));

  const submit = async () => {
    if (!f.client_id && !f.recipient?.name) return toast.error("Selecione um cliente ou preencha o destinatário");
    if (f.items.some((it) => !it.description)) return toast.error("Preencha a descrição de todos os itens");
    if (bankMode === "iban" && f.bank.iban && !validateIban(f.bank.iban)) return toast.error("IBAN português inválido");
    setSaving(true);
    try {
      const payload = { ...f, items: f.items.map((it) => ({ ...it, quantity: +it.quantity, unit_price: +it.unit_price, discount: +it.discount, vat: +it.vat })) };
      if (editing) { await api.put(`/invoices/${id}`, payload); toast.success("Fatura atualizada"); navigate(`/app/faturas/${id}`); }
      else { const { data } = await api.post("/invoices", payload); toast.success(`Fatura ${data.number} emitida`); navigate(`/app/faturas/${data.id}`); }
    } catch (e) { toast.error(apiError(e)); } finally { setSaving(false); }
  };

  if (loading) return <Loading />;
  const inp = "w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-[#D4AF37]";
  const lbl = "mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500";

  return (
    <>
      <PageHeader title={editing ? "Editar Fatura" : "Nova Fatura"} subtitle={<span className="font-mono">{nextNumber}</span>}>
        <NavyButton onClick={() => navigate(-1)}>Cancelar</NavyButton>
        <GoldButton data-testid="save-invoice-btn" onClick={submit} disabled={saving}><Save size={15} className="mr-1 inline" /> {saving ? "A guardar…" : editing ? "Guardar" : "Emitir Fatura"}</GoldButton>
      </PageHeader>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-5">
          <Card>
            <h3 className="mb-3 font-head font-semibold text-[#0B1A30]">Destinatário</h3>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className={lbl}>Cliente</label>
                <select data-testid="invoice-client-select" className={inp} value={f.client_id}
                  onChange={(e) => setF((p) => ({ ...p, client_id: e.target.value }))}>
                  <option value="">— Destinatário manual —</option>
                  {clients.map((c) => <option key={c.id} value={c.id}>{c.name}{c.company ? ` · ${c.company}` : ""}</option>)}
                </select>
              </div>
              {!f.client_id && <>
                <div><label className={lbl}>Nome</label><input className={inp} data-testid="recipient-name-input" value={f.recipient.name || ""} onChange={(e) => setF((p) => ({ ...p, recipient: { ...p.recipient, name: e.target.value } }))} /></div>
                <div><label className={lbl}>NIF</label><input className={inp} value={f.recipient.nif || ""} onChange={(e) => setF((p) => ({ ...p, recipient: { ...p.recipient, nif: e.target.value } }))} /></div>
                <div><label className={lbl}>Email</label><input className={inp} value={f.recipient.email || ""} onChange={(e) => setF((p) => ({ ...p, recipient: { ...p.recipient, email: e.target.value } }))} /></div>
              </>}
            </div>
          </Card>

          <Card>
            <div className="mb-3 flex items-center justify-between">
              <h3 className="font-head font-semibold text-[#0B1A30]">Itens</h3>
              <button data-testid="add-item-btn" onClick={addItem} className="flex items-center gap-1 rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-semibold text-[#0B1A30] hover:bg-slate-200"><Plus size={14} /> Adicionar item</button>
            </div>
            <div className="space-y-3">
              {f.items.map((it, i) => (
                <div key={i} className="grid grid-cols-12 gap-2 rounded-lg bg-slate-50 p-3" data-testid={`item-row-${i}`}>
                  <input className={`${inp} col-span-12 sm:col-span-4`} placeholder="Descrição" data-testid={`item-desc-${i}`} value={it.description} onChange={(e) => setItem(i, "description", e.target.value)} />
                  <input className={`${inp} col-span-3 sm:col-span-2`} type="number" placeholder="Qt" data-testid={`item-qty-${i}`} value={it.quantity} onChange={(e) => setItem(i, "quantity", e.target.value)} />
                  <input className={`${inp} col-span-4 sm:col-span-2`} type="number" placeholder="Preço" data-testid={`item-price-${i}`} value={it.unit_price} onChange={(e) => setItem(i, "unit_price", e.target.value)} />
                  <input className={`${inp} col-span-2 sm:col-span-1`} type="number" placeholder="Desc%" data-testid={`item-discount-${i}`} value={it.discount} onChange={(e) => setItem(i, "discount", e.target.value)} />
                  <input className={`${inp} col-span-2 sm:col-span-1`} type="number" placeholder="IVA%" data-testid={`item-vat-${i}`} value={it.vat} onChange={(e) => setItem(i, "vat", e.target.value)} />
                  <div className="col-span-10 sm:col-span-1 flex items-center justify-end text-sm font-semibold text-[#0B1A30]">{eur((it.quantity * it.unit_price) * (1 - it.discount / 100))}</div>
                  <button className="col-span-2 sm:col-span-1 grid place-items-center text-red-500 hover:text-red-700" onClick={() => rmItem(i)} data-testid={`remove-item-${i}`}><Trash2 size={16} /></button>
                </div>
              ))}
            </div>
          </Card>

          <Card>
            <h3 className="mb-3 font-head font-semibold text-[#0B1A30]">Pagamento</h3>
            <div className="mb-3 flex gap-2">
              {[["iban", "IBAN"], ["multibanco", "Multibanco"], ["internacional", "Internacional"]].map(([k, l]) => (
                <button key={k} data-testid={`bankmode-${k}`} onClick={() => setBankMode(k)} className={`rounded-full px-3 py-1.5 text-xs font-semibold ${bankMode === k ? "bg-[#D4AF37] text-[#0B1A30]" : "bg-slate-100 text-slate-600"}`}>{l}</button>
              ))}
            </div>
            {bankMode === "iban" && <div className="grid gap-3 sm:grid-cols-2">
              <div><label className={lbl}>Banco</label>
                <select className={inp} value={f.bank.bank_name || ""} onChange={(e) => setF((p) => ({ ...p, bank: { ...p.bank, bank_name: e.target.value } }))}>
                  <option value="">— Selecionar —</option>
                  <optgroup label="Principais">{PT_BANKS_MAIN.map((b) => <option key={b}>{b}</option>)}</optgroup>
                  <optgroup label="Outros">{PT_BANKS_OTHER.map((b) => <option key={b}>{b}</option>)}</optgroup>
                  <option value="__custom">Outro (escrever)</option>
                </select>
                {f.bank.bank_name === "__custom" && <input className={`${inp} mt-2`} placeholder="Nome do banco" onChange={(e) => setF((p) => ({ ...p, bank: { ...p.bank, bank_name: e.target.value } }))} />}
              </div>
              <div><label className={lbl}>Titular</label><input className={inp} value={f.bank.holder || ""} onChange={(e) => setF((p) => ({ ...p, bank: { ...p.bank, holder: e.target.value } }))} /></div>
              <div className="sm:col-span-2"><label className={lbl}>IBAN</label>
                <input className={`${inp} font-mono ${f.bank.iban && !validateIban(f.bank.iban) ? "border-red-400" : ""}`} data-testid="iban-input" placeholder="PT50 0000 0000 0000 0000 0000 0"
                  value={maskIban(f.bank.iban || "")} onChange={(e) => setF((p) => ({ ...p, bank: { ...p.bank, iban: e.target.value } }))} />
                {f.bank.iban && (validateIban(f.bank.iban) ? <span className="text-xs text-green-600">IBAN válido</span> : <span className="text-xs text-red-500">IBAN inválido</span>)}
              </div>
              <div><label className={lbl}>SWIFT/BIC</label><input className={inp} value={f.bank.swift || ""} onChange={(e) => setF((p) => ({ ...p, bank: { ...p.bank, swift: e.target.value } }))} /></div>
            </div>}
            {bankMode === "multibanco" && <div className="grid gap-3 sm:grid-cols-2">
              <div><label className={lbl}>Entidade</label><input className={inp} data-testid="mb-entity-input" value={f.bank.entity || ""} onChange={(e) => setF((p) => ({ ...p, bank: { ...p.bank, entity: e.target.value } }))} /></div>
              <div><label className={lbl}>Referência</label><input className={inp} value={f.bank.reference || ""} onChange={(e) => setF((p) => ({ ...p, bank: { ...p.bank, reference: e.target.value } }))} /></div>
            </div>}
            {bankMode === "internacional" && <div className="grid gap-3 sm:grid-cols-2">
              <div><label className={lbl}>País</label><input className={inp} value={f.international.country || ""} onChange={(e) => setF((p) => ({ ...p, international: { ...p.international, country: e.target.value } }))} /></div>
              <div><label className={lbl}>SWIFT/BIC</label><input className={inp} value={f.international.swift || ""} onChange={(e) => setF((p) => ({ ...p, international: { ...p.international, swift: e.target.value } }))} /></div>
              <div className="sm:col-span-2"><label className={lbl}>IBAN internacional</label><input className={`${inp} font-mono`} value={f.international.iban || ""} onChange={(e) => setF((p) => ({ ...p, international: { ...p.international, iban: e.target.value } }))} /></div>
            </div>}
          </Card>
        </div>

        <div className="space-y-5">
          <Card>
            <h3 className="mb-3 font-head font-semibold text-[#0B1A30]">Configuração</h3>
            <label className={lbl}>Prazo de vencimento</label>
            <div className="mb-3 grid grid-cols-3 gap-2">
              {DUE.map((d) => (
                <button key={d.k} data-testid={`due-${d.k}`} onClick={() => setF((p) => ({ ...p, due_label: d.k }))}
                  className={`rounded-lg py-2 text-xs font-semibold ${f.due_label === d.k ? "bg-[#0B1A30] text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}>{d.l}</button>
              ))}
            </div>
            <label className={lbl}>Moeda</label>
            <select className={`${inp} mb-3`} value={f.currency} onChange={(e) => setF((p) => ({ ...p, currency: e.target.value }))}>
              <option>EUR</option><option>USD</option><option>GBP</option><option>BRL</option>
            </select>
            <label className={lbl}>Estado inicial</label>
            <select className={inp} data-testid="status-select" value={f.status} onChange={(e) => setF((p) => ({ ...p, status: e.target.value }))}>
              <option value="pendente">Pendente</option><option value="analise">Em Análise</option><option value="pago">Pagamento Concluído</option>
            </select>
          </Card>

          <Card className="navy-gradient text-white">
            <h3 className="mb-3 font-head font-semibold text-[#D4AF37]">Resumo</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-slate-300">Subtotal</span><span>{eur(totals.subtotal, f.currency)}</span></div>
              <div className="flex justify-between"><span className="text-slate-300">Desconto</span><span>-{eur(totals.discount, f.currency)}</span></div>
              <div className="flex justify-between"><span className="text-slate-300">IVA</span><span>{eur(totals.vat, f.currency)}</span></div>
              <div className="mt-2 flex justify-between border-t border-[#172F54] pt-3 text-lg font-bold text-[#D4AF37]"><span>Total</span><span data-testid="invoice-total">{eur(totals.total, f.currency)}</span></div>
            </div>
          </Card>

          <Card>
            <label className={lbl}>Mensagem da empresa</label>
            <textarea className={`${inp} mb-3`} rows={2} value={f.company_message} onChange={(e) => setF((p) => ({ ...p, company_message: e.target.value }))} />
            <label className={lbl}>Notas</label>
            <textarea className={inp} rows={2} value={f.notes} onChange={(e) => setF((p) => ({ ...p, notes: e.target.value }))} />
          </Card>
        </div>
      </div>
    </>
  );
}
