export const STATUS = {
  pendente: { label: "Pendente", cls: "bg-amber-100 text-amber-700 border-amber-300" },
  pago: { label: "Pagamento Concluído", cls: "bg-green-100 text-green-700 border-green-300" },
  expirado: { label: "Expirado", cls: "bg-red-100 text-red-700 border-red-300" },
  cancelado: { label: "Cancelado", cls: "bg-slate-100 text-slate-600 border-slate-300" },
  analise: { label: "Em Análise", cls: "bg-blue-100 text-blue-700 border-blue-300" },
};

export function eur(v, currency = "EUR") {
  const n = Number(v || 0);
  try {
    return new Intl.NumberFormat("pt-PT", { style: "currency", currency }).format(n);
  } catch {
    return "€" + n.toFixed(2);
  }
}

export function fmtDate(iso, withTime = false) {
  if (!iso) return "—";
  const d = new Date(iso);
  const opts = withTime
    ? { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }
    : { day: "2-digit", month: "2-digit", year: "numeric" };
  return d.toLocaleString("pt-PT", opts);
}

export function timeAgo(iso) {
  if (!iso) return "—";
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "há instantes";
  if (s < 3600) return `há ${Math.floor(s / 60)} min`;
  if (s < 86400) return `há ${Math.floor(s / 3600)} h`;
  return `há ${Math.floor(s / 86400)} dias`;
}
