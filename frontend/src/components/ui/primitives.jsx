// Shared lightweight UI primitives for INVEST pages
export function PageHeader({ title, subtitle, children }) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="font-head text-2xl sm:text-3xl font-bold tracking-tight text-[#0B1A30]">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}
      </div>
      {children && <div className="flex flex-wrap items-center gap-2">{children}</div>}
    </div>
  );
}

export function Card({ children, className = "", ...rest }) {
  return (
    <div className={`rounded-xl border border-slate-200 bg-white p-5 shadow-sm ${className}`} {...rest}>
      {children}
    </div>
  );
}

export function Loading({ label = "A carregar…" }) {
  return (
    <div className="grid place-items-center py-20 text-slate-400">
      <div className="mb-3 h-8 w-8 rounded-full border-2 border-[#D4AF37] border-t-transparent spin-slow" />
      {label}
    </div>
  );
}

export function Empty({ icon: Icon, title, subtitle }) {
  return (
    <div className="grid place-items-center rounded-xl border border-dashed border-slate-300 bg-white/60 py-16 text-center">
      {Icon && <Icon className="mb-3 text-slate-300" size={40} />}
      <div className="font-head text-lg font-semibold text-slate-600">{title}</div>
      {subtitle && <div className="mt-1 text-sm text-slate-400">{subtitle}</div>}
    </div>
  );
}

export function GoldButton({ children, className = "", ...rest }) {
  return (
    <button
      className={`gold-gradient rounded-lg px-4 py-2 text-sm font-semibold text-[#0B1A30] hover:brightness-105 transition-all shadow-sm disabled:opacity-50 ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}

export function NavyButton({ children, className = "", ...rest }) {
  return (
    <button
      className={`rounded-lg bg-[#0B1A30] px-4 py-2 text-sm font-semibold text-white hover:bg-[#172F54] transition-all disabled:opacity-50 ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}
