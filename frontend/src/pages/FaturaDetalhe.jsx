import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import api, { apiError } from "@/lib/api";
import { eur, fmtDate } from "@/lib/format";
import StatusBadge from "@/components/StatusBadge";
import { generateInvoicePdf } from "@/lib/invoicePdf";
import { maskIban } from "@/lib/iban";
import { PageHeader, Card, Loading, NavyButton, GoldButton } from "@/components/ui/primitives";
import { FileDown, Pencil, MessageCircle, Link2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";

const STATUSES = [["pendente", "Pendente"], ["analise", "Em Análise"], ["pago", "Pagamento Concluído"], ["expirado", "Expirado"], ["cancelado", "Cancelado"]];

export default function FaturaDetalhe() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [inv, setInv] = useState(null);

  const load = () => api.get(`/invoices/${id}`).then((r) => setInv(r.data)).catch((e) => { toast.error(apiError(e)); navigate("/app/faturas"); });
  useEffect(() => { load(); }, [id]);
  if (!inv) return <Loading />;

  const changeStatus = async (s) => { try { await api.patch(`/invoices/${id}/status`, { status: s }); toast.success("Estado atualizado"); load(); } catch (e) { toast.error(apiError(e)); } };
  const whatsapp = () => window.open(`https://wa.me/?text=${encodeURIComponent(`Fatura ${inv.number} — ${eur(inv.totals.total, inv.currency)}. Consulte: ${inv.public_link}`)}`, "_blank");
  const copyLink = () => { navigator.clipboard.writeText(inv.public_link); toast.success("Link copiado"); };
  const del = async () => { if (!window.confirm("Eliminar esta fatura?")) return; try { await api.delete(`/invoices/${id}`); toast.success("Eliminada"); navigate("/app/faturas"); } catch (e) { toast.error(apiError(e)); } };

  return (
    <>
      <PageHeader title={<span className="font-mono">{inv.number}</span>} subtitle={<StatusBadge status={inv.status} />}>
        <NavyButton onClick={() => navigate("/app/faturas")}>Voltar</NavyButton>
        <button data-testid="whatsapp-btn" onClick={whatsapp} className="flex items-center gap-1.5 rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700"><MessageCircle size={15} /> WhatsApp</button>
        <button data-testid="copy-link-btn" onClick={copyLink} className="flex items-center gap-1.5 rounded-lg bg-slate-100 px-4 py-2 text-sm font-semibold text-[#0B1A30] hover:bg-slate-200"><Link2 size={15} /> Copiar link</button>
        <NavyButton data-testid="edit-invoice-btn" onClick={() => navigate(`/app/faturas/${id}/editar`)}><Pencil size={14} className="mr-1 inline" /> Editar</NavyButton>
        <GoldButton data-testid="download-pdf-btn" onClick={() => generateInvoicePdf(inv)}><FileDown size={15} className="mr-1 inline" /> Descarregar PDF</GoldButton>
      </PageHeader>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-5">
          <Card>
            <div className="grid gap-6 sm:grid-cols-2">
              <div>
                <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-[#D4AF37]">Remetente</div>
                <div className="text-sm text-slate-700">{inv.sender?.name || "—"}<br />{inv.sender?.nif && `NIF: ${inv.sender.nif}`}<br />{inv.sender?.email}</div>
              </div>
              <div>
                <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-[#D4AF37]">Destinatário</div>
                <div className="text-sm text-slate-700">{inv.recipient?.name || "—"}<br />{inv.recipient?.nif && `NIF: ${inv.recipient.nif}`}<br />{inv.recipient?.email}</div>
              </div>
            </div>
            <div className="mt-4 flex flex-wrap gap-6 border-t border-slate-100 pt-4 text-sm">
              <div><span className="text-slate-400">Emissão:</span> {fmtDate(inv.issue_date, true)}</div>
              <div><span className="text-slate-400">Vencimento:</span> {fmtDate(inv.due_date, true)} ({inv.due_label})</div>
            </div>
          </Card>

          <Card className="p-0 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-50"><tr className="text-left text-xs uppercase text-slate-400"><th className="px-5 py-2">Descrição</th><th className="text-right">Qt</th><th className="text-right">Preço</th><th className="text-right">Desc</th><th className="text-right">IVA</th><th className="px-5 text-right">Total</th></tr></thead>
              <tbody>
                {inv.items.map((it, i) => (
                  <tr key={i} className="border-t border-slate-100"><td className="px-5 py-2.5">{it.description}</td><td className="text-right">{it.quantity}</td><td className="text-right">{eur(it.unit_price, inv.currency)}</td><td className="text-right">{it.discount}%</td><td className="text-right">{it.vat}%</td><td className="px-5 text-right font-semibold">{eur(it.quantity * it.unit_price * (1 - it.discount / 100), inv.currency)}</td></tr>
                ))}
              </tbody>
            </table>
            <div className="border-t border-slate-100 p-5">
              <div className="ml-auto max-w-xs space-y-1.5 text-sm">
                <div className="flex justify-between"><span className="text-slate-400">Subtotal</span><span>{eur(inv.totals.subtotal, inv.currency)}</span></div>
                <div className="flex justify-between"><span className="text-slate-400">Desconto</span><span>-{eur(inv.totals.discount, inv.currency)}</span></div>
                <div className="flex justify-between"><span className="text-slate-400">IVA</span><span>{eur(inv.totals.vat, inv.currency)}</span></div>
                <div className="flex justify-between border-t border-slate-200 pt-2 text-lg font-bold text-[#0B1A30]"><span>Total</span><span>{eur(inv.totals.total, inv.currency)}</span></div>
              </div>
            </div>
          </Card>

          {(inv.bank?.iban || inv.bank?.entity || inv.international?.country) && (
            <Card className="border-[#D4AF37]/40 bg-[#FFFBEB]">
              <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-[#0B1A30]">Dados de pagamento</div>
              <div className="space-y-1 text-sm text-slate-700">
                {inv.bank?.bank_name && <div>Banco: {inv.bank.bank_name}</div>}
                {inv.bank?.holder && <div>Titular: {inv.bank.holder}</div>}
                {inv.bank?.iban && <div className="font-mono">IBAN: {maskIban(inv.bank.iban)}</div>}
                {inv.bank?.swift && <div>SWIFT/BIC: {inv.bank.swift}</div>}
                {inv.bank?.entity && <div>Multibanco — Entidade: {inv.bank.entity} · Referência: {inv.bank.reference}</div>}
                {inv.international?.country && <div>Internacional: {inv.international.country} · {inv.international.swift}</div>}
              </div>
            </Card>
          )}
        </div>

        <div className="space-y-5">
          <Card>
            <div className="mb-3 font-head font-semibold text-[#0B1A30]">Alterar estado</div>
            <div className="grid gap-2">
              {STATUSES.map(([k, l]) => (
                <button key={k} data-testid={`set-status-${k}`} onClick={() => changeStatus(k)}
                  className={`rounded-lg border px-3 py-2 text-sm font-medium text-left transition-colors ${inv.status === k ? "border-[#D4AF37] bg-[#FFFBEB] text-[#0B1A30]" : "border-slate-200 hover:bg-slate-50"}`}>{l}</button>
              ))}
            </div>
          </Card>

          <Card>
            <div className="mb-3 font-head font-semibold text-[#0B1A30]">Verificação</div>
            {inv.qr_code && <img src={inv.qr_code} alt="QR" className="mx-auto h-36 w-36" data-testid="invoice-qr" />}
            <div className="mt-2 break-all text-center text-xs text-slate-400">{inv.public_link}</div>
          </Card>

          {inv.proofs?.length > 0 && <Card><div className="mb-2 font-head font-semibold text-[#0B1A30]">Comprovativos</div>{inv.proofs.map((p) => <div key={p.id} className="flex items-center justify-between border-b border-slate-100 py-2 text-sm"><span>{p.filename}</span><StatusBadge status={p.status === "aceite" ? "pago" : p.status === "recusado" ? "expirado" : "analise"} /></div>)}</Card>}

          {user?.role === "admin" && <button data-testid="delete-invoice-btn" onClick={del} className="flex w-full items-center justify-center gap-2 rounded-lg border border-red-200 py-2 text-sm font-semibold text-red-600 hover:bg-red-50"><Trash2 size={15} /> Eliminar fatura</button>}
        </div>
      </div>
    </>
  );
}
