import { STATUS } from "@/lib/format";

export default function StatusBadge({ status, className = "" }) {
  const s = STATUS[status] || STATUS.pendente;
  return (
    <span
      data-testid={`status-badge-${status}`}
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${s.cls} ${className}`}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current opacity-70" />
      {s.label}
    </span>
  );
}
