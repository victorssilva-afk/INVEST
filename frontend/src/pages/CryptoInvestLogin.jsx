import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { LOGO } from "@/lib/logo";
import { Headphones, Loader2 } from "lucide-react";
import { toast } from "sonner";

export default function CryptoInvestLogin() {
  const { login } = useAuth();
  const nav = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await login(email, password);
      nav("/crypto-invest/painel");
    } catch (err) {
      toast.error("Credenciais inválidas");
    } finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen bg-[#171A1F] flex items-center justify-center px-4">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-white/[0.04] p-8 backdrop-blur">
        <div className="mb-6 flex items-center gap-3">
          <img src={LOGO} alt="logo" className="h-11 w-11 rounded bg-white p-1" />
          <div>
            <div className="font-head text-2xl font-bold text-white">Crypto<span className="text-[#4ADE80]">.Invest</span></div>
            <div className="text-xs text-slate-400">Suporte técnico remoto · acesso do técnico</div>
          </div>
        </div>
        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="text-xs text-slate-400">Email</label>
            <input data-testid="ci-login-email" value={email} onChange={(e) => setEmail(e.target.value)} className="mt-1 w-full rounded-lg border border-white/20 bg-[#171A1F] px-3 py-2.5 text-white outline-none focus:border-[#4ADE80]" placeholder="tecnico@invest.pt" />
          </div>
          <div>
            <label className="text-xs text-slate-400">Palavra-passe</label>
            <input data-testid="ci-login-password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="mt-1 w-full rounded-lg border border-white/20 bg-[#171A1F] px-3 py-2.5 text-white outline-none focus:border-[#4ADE80]" placeholder="••••••••" />
          </div>
          <button data-testid="ci-login-submit" disabled={loading} className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#4ADE80] py-3 font-bold text-[#0B1A30] hover:bg-[#3fce74] disabled:opacity-60">
            {loading ? <Loader2 size={16} className="animate-spin" /> : <Headphones size={16} />}{loading ? "A entrar…" : "Entrar"}
          </button>
        </form>
        <p className="mt-4 text-center text-xs text-slate-500">Página independente do CRM · ligação segura</p>
      </div>
    </div>
  );
}
