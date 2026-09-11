import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { apiError } from "@/lib/api";
import { toast } from "sonner";
import { Lock, Mail, ShieldCheck } from "lucide-react";

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await login(email, password);
      toast.success("Sessão iniciada");
      navigate("/app");
    } catch (err) {
      toast.error(apiError(err, "Credenciais inválidas"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-2 bg-[#0B1A30]">
      {/* Left brand panel */}
      <div className="relative hidden lg:flex flex-col justify-between p-12 navy-gradient overflow-hidden">
        <div className="absolute -right-20 -top-20 h-80 w-80 rounded-full bg-[#D4AF37]/10 blur-3xl" />
        <div className="absolute -left-10 bottom-10 h-64 w-64 rounded-full bg-[#D4AF37]/5 blur-3xl" />
        <div className="relative z-10">
          <div className="font-head text-4xl font-extrabold text-white">IN<span className="text-[#D4AF37]">VEST</span></div>
          <p className="mt-2 text-slate-400">Plataforma empresarial de faturação, CRM e inteligência de mercado.</p>
        </div>
        <div className="relative z-10 space-y-4 text-slate-300">
          {["Faturação profissional com PDF & QR Code", "CRM, comprovativos e documentos", "Módulo Cálculo e Análise Crypto", "Monitorização contínua 24/7"].map((t) => (
            <div key={t} className="flex items-center gap-3">
              <ShieldCheck className="text-[#D4AF37]" size={18} /> <span className="text-sm">{t}</span>
            </div>
          ))}
        </div>
        <div className="relative z-10 text-xs text-slate-500">© 2026 INVEST · Todos os direitos reservados</div>
      </div>

      {/* Right form */}
      <div className="flex items-center justify-center p-6">
        <form onSubmit={submit} className="w-full max-w-sm" data-testid="login-form">
          <div className="mb-8 text-center lg:hidden">
            <div className="font-head text-3xl font-extrabold text-white">IN<span className="text-[#D4AF37]">VEST</span></div>
          </div>
          <div className="rounded-2xl bg-white p-8 shadow-2xl">
            <h1 className="font-head text-2xl font-bold text-[#0B1A30]">Iniciar sessão</h1>
            <p className="mb-6 mt-1 text-sm text-slate-500">Aceda à sua Mesa INVEST</p>

            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">Email</label>
            <div className="mb-4 flex items-center gap-2 rounded-lg border border-slate-200 px-3 focus-within:border-[#D4AF37]">
              <Mail size={16} className="text-slate-400" />
              <input
                data-testid="login-email-input"
                type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-transparent py-2.5 text-sm outline-none" placeholder="nome@empresa.pt"
              />
            </div>

            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">Password</label>
            <div className="mb-6 flex items-center gap-2 rounded-lg border border-slate-200 px-3 focus-within:border-[#D4AF37]">
              <Lock size={16} className="text-slate-400" />
              <input
                data-testid="login-password-input"
                type="password" required value={password} onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-transparent py-2.5 text-sm outline-none" placeholder="••••••••"
              />
            </div>

            <button
              data-testid="login-submit-btn" type="submit" disabled={loading}
              className="gold-gradient w-full rounded-lg py-2.5 font-semibold text-[#0B1A30] hover:brightness-105 transition-all disabled:opacity-60"
            >
              {loading ? "A entrar…" : "Entrar"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
