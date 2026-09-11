import { useEffect, useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import api from "@/lib/api";
import {
  LayoutDashboard, Users, FileText, Receipt, Upload, FileSignature,
  LayoutTemplate, BarChart3, History, Settings, Calculator, Activity,
  Bitcoin, LogOut, Menu, X, ShieldCheck,
} from "lucide-react";

const NAV = [
  { to: "/app", icon: LayoutDashboard, label: "Dashboard", testid: "nav-dashboard", end: true },
  { to: "/app/faturas", icon: Receipt, label: "Faturas", testid: "nav-faturas" },
  { to: "/app/clientes", icon: Users, label: "Clientes", testid: "nav-clientes" },
  { to: "/app/comprovativos", icon: FileText, label: "Comprovativos", testid: "nav-comprovativos", counter: "proofs_pending" },
  { to: "/app/uploads", icon: Upload, label: "Fotos & Documentos", testid: "nav-uploads", counter: "uploads_pending" },
  { to: "/app/contratos", icon: FileSignature, label: "Contratos", testid: "nav-contratos" },
  { to: "/app/modelos", icon: LayoutTemplate, label: "Modelos", testid: "nav-modelos" },
  { to: "/app/calculo", icon: Calculator, label: "Cálculo", testid: "nav-calculo" },
  { to: "/app/crypto", icon: Bitcoin, label: "Análise Crypto", testid: "nav-crypto" },
  { to: "/app/relatorios", icon: BarChart3, label: "Relatórios", testid: "nav-relatorios" },
  { to: "/app/historico", icon: History, label: "Histórico", testid: "nav-historico" },
  { to: "/app/monitorizacao", icon: Activity, label: "Monitorização", testid: "nav-monitorizacao" },
  { to: "/app/utilizadores", icon: ShieldCheck, label: "Utilizadores", testid: "nav-utilizadores", adminOnly: true },
  { to: "/app/definicoes", icon: Settings, label: "Definições", testid: "nav-definicoes" },
];

export default function Layout({ children }) {
  const { user, logout } = useAuth();
  const [counters, setCounters] = useState({});
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const load = () => api.get("/counters").then((r) => setCounters(r.data)).catch(() => {});
    load();
    const t = setInterval(load, 30000);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="min-h-screen bg-[#F8FAFC]">
      {/* Sidebar */}
      <aside
        className={`fixed left-0 top-0 bottom-0 z-40 w-64 navy-gradient text-white border-r border-[#172F54] flex flex-col navy-scroll overflow-y-auto transition-transform duration-300 ${open ? "translate-x-0" : "-translate-x-full"} lg:translate-x-0`}
        data-testid="sidebar"
      >
        <div className="px-6 h-16 flex items-center gap-2 border-b border-[#172F54]">
          <span className="text-2xl font-head font-extrabold tracking-tight text-white">IN<span className="text-[#D4AF37]">VEST</span></span>
          <button className="ml-auto lg:hidden" onClick={() => setOpen(false)} data-testid="close-sidebar-btn"><X size={20} /></button>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-1">
          {NAV.filter((n) => !n.adminOnly || user?.role === "admin").map((n) => {
            const c = counters[n.counter];
            return (
              <NavLink
                key={n.to}
                to={n.to}
                end={n.end}
                onClick={() => setOpen(false)}
                data-testid={n.testid}
                className={({ isActive }) =>
                  `group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all ${isActive ? "bg-[#D4AF37] text-[#0B1A30] shadow-lg shadow-[#D4AF37]/20" : "text-slate-300 hover:bg-[#172F54] hover:text-white"}`
                }
              >
                <n.icon size={18} />
                <span className="flex-1">{n.label}</span>
                {c > 0 && (
                  <span className="min-w-[20px] rounded-full bg-red-500 px-1.5 text-center text-[11px] font-bold text-white">{c}</span>
                )}
              </NavLink>
            );
          })}
        </nav>
        <div className="border-t border-[#172F54] p-4">
          <div className="mb-3">
            <div className="text-sm font-semibold truncate">{user?.name}</div>
            <div className="text-xs text-slate-400 capitalize">{user?.role} · {user?.tenant_id}</div>
          </div>
          <button
            onClick={logout}
            data-testid="logout-btn"
            className="flex w-full items-center gap-2 rounded-lg bg-[#172F54] px-3 py-2 text-sm text-slate-200 hover:bg-red-600/80 hover:text-white transition-colors"
          >
            <LogOut size={16} /> Terminar sessão
          </button>
        </div>
      </aside>

      {open && <div className="fixed inset-0 z-30 bg-black/40 lg:hidden" onClick={() => setOpen(false)} />}

      {/* Main */}
      <div className="lg:pl-64">
        <header className="sticky top-0 z-20 h-16 border-b border-slate-200 bg-white/85 backdrop-blur-md px-4 sm:px-8 flex items-center gap-3">
          <button className="lg:hidden" onClick={() => setOpen(true)} data-testid="open-sidebar-btn"><Menu size={22} /></button>
          <div className="ml-auto flex items-center gap-3">
            <button
              onClick={() => navigate("/app/faturas/nova")}
              data-testid="header-new-invoice-btn"
              className="gold-gradient rounded-lg px-4 py-2 text-sm font-semibold text-[#0B1A30] hover:brightness-105 transition-all shadow-sm"
            >
              + Nova Fatura
            </button>
            <div className="h-9 w-9 rounded-full bg-[#0B1A30] text-[#D4AF37] grid place-items-center font-head font-bold">
              {(user?.name || "?").slice(0, 1).toUpperCase()}
            </div>
          </div>
        </header>
        <main className="p-4 sm:p-8 animate-fade-up">{children}</main>
      </div>
    </div>
  );
}
