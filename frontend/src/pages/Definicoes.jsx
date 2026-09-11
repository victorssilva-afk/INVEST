import { useEffect, useState } from "react";
import api, { apiError } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { maskIban, validateIban, PT_BANKS_MAIN, PT_BANKS_OTHER } from "@/lib/iban";
import { PageHeader, Card, Loading, GoldButton } from "@/components/ui/primitives";
import { toast } from "sonner";

export default function Definicoes() {
  const { user } = useAuth();
  const [s, setS] = useState(null);
  const readOnly = user?.role !== "admin";
  useEffect(() => { api.get("/settings").then((r) => setS(r.data)).catch((e) => toast.error(apiError(e))); }, []);
  if (!s) return <Loading />;

  const save = async () => {
    if (s.bank?.iban && !validateIban(s.bank.iban)) return toast.error("IBAN inválido");
    try { await api.put("/settings", { sender: s.sender, bank: s.bank, default_currency: s.default_currency }); toast.success("Definições guardadas"); }
    catch (e) { toast.error(apiError(e)); }
  };
  const inp = "w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-[#D4AF37] disabled:bg-slate-50";
  const lbl = "mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500";
  const setSender = (k, v) => setS({ ...s, sender: { ...s.sender, [k]: v } });
  const setBank = (k, v) => setS({ ...s, bank: { ...s.bank, [k]: v } });

  return (
    <>
      <PageHeader title="Definições" subtitle="Dados do remetente, dados bancários e moeda padrão">
        {!readOnly && <GoldButton data-testid="save-settings-btn" onClick={save}>Guardar</GoldButton>}
      </PageHeader>
      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <h3 className="mb-3 font-head font-semibold text-[#0B1A30]">Remetente</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2"><label className={lbl}>Nome / Empresa</label><input className={inp} disabled={readOnly} data-testid="sender-name-input" value={s.sender?.name || ""} onChange={(e) => setSender("name", e.target.value)} /></div>
            <div><label className={lbl}>NIF</label><input className={inp} disabled={readOnly} value={s.sender?.nif || ""} onChange={(e) => setSender("nif", e.target.value)} /></div>
            <div><label className={lbl}>Email</label><input className={inp} disabled={readOnly} value={s.sender?.email || ""} onChange={(e) => setSender("email", e.target.value)} /></div>
            <div><label className={lbl}>Telefone</label><input className={inp} disabled={readOnly} value={s.sender?.phone || ""} onChange={(e) => setSender("phone", e.target.value)} /></div>
            <div className="sm:col-span-2"><label className={lbl}>Morada</label><input className={inp} disabled={readOnly} value={s.sender?.address || ""} onChange={(e) => setSender("address", e.target.value)} /></div>
          </div>
          <label className={`${lbl} mt-4`}>Moeda padrão</label>
          <select className={inp} disabled={readOnly} value={s.default_currency} onChange={(e) => setS({ ...s, default_currency: e.target.value })}><option>EUR</option><option>USD</option><option>GBP</option><option>BRL</option></select>
        </Card>
        <Card>
          <h3 className="mb-3 font-head font-semibold text-[#0B1A30]">Dados bancários</h3>
          <div className="grid gap-3">
            <div><label className={lbl}>Banco</label>
              <select className={inp} disabled={readOnly} value={s.bank?.bank_name || ""} onChange={(e) => setBank("bank_name", e.target.value)}>
                <option value="">— Selecionar —</option><optgroup label="Principais">{PT_BANKS_MAIN.map((b) => <option key={b}>{b}</option>)}</optgroup><optgroup label="Outros">{PT_BANKS_OTHER.map((b) => <option key={b}>{b}</option>)}</optgroup>
              </select>
            </div>
            <div><label className={lbl}>Titular</label><input className={inp} disabled={readOnly} value={s.bank?.holder || ""} onChange={(e) => setBank("holder", e.target.value)} /></div>
            <div><label className={lbl}>IBAN</label><input className={`${inp} font-mono`} disabled={readOnly} data-testid="settings-iban-input" placeholder="PT50 …" value={maskIban(s.bank?.iban || "")} onChange={(e) => setBank("iban", e.target.value)} />
              {s.bank?.iban && (validateIban(s.bank.iban) ? <span className="text-xs text-green-600">IBAN válido</span> : <span className="text-xs text-red-500">IBAN inválido</span>)}</div>
            <div><label className={lbl}>SWIFT/BIC</label><input className={inp} disabled={readOnly} value={s.bank?.swift || ""} onChange={(e) => setBank("swift", e.target.value)} /></div>
          </div>
        </Card>
      </div>
    </>
  );
}
