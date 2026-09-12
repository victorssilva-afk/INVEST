import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import Layout from "@/components/Layout";
import Login from "@/pages/Login";
import Dashboard from "@/pages/Dashboard";
import Clientes from "@/pages/Clientes";
import ClienteDetalhe from "@/pages/ClienteDetalhe";
import Faturas from "@/pages/Faturas";
import FaturaForm from "@/pages/FaturaForm";
import FaturaDetalhe from "@/pages/FaturaDetalhe";
import Comprovativos from "@/pages/Comprovativos";
import Uploads from "@/pages/Uploads";
import Contratos from "@/pages/Contratos";
import Modelos from "@/pages/Modelos";
import Relatorios from "@/pages/Relatorios";
import Utilizadores from "@/pages/Utilizadores";
import Historico from "@/pages/Historico";
import Definicoes from "@/pages/Definicoes";
import Calculo from "@/pages/Calculo";
import Monitorizacao from "@/pages/Monitorizacao";
import Crypto from "@/pages/Crypto";
import CryptoHistorico from "@/pages/CryptoHistorico";
import Leads from "@/pages/Leads";
import CryptoPublico from "@/pages/CryptoPublico";
import CryptoInvestLogin from "@/pages/CryptoInvestLogin";
import CryptoInvest from "@/pages/CryptoInvest";
import CryptoInvestViewer from "@/pages/CryptoInvestViewer";
import SuporteCliente from "@/pages/SuporteCliente";
import EmitirPublico from "@/pages/public/EmitirPublico";
import EnviarPublico from "@/pages/public/EnviarPublico";
import FaturaPublica from "@/pages/public/FaturaPublica";

function Protected({ children }) {
  const { user, ready } = useAuth();
  if (!ready || user === null) {
    return (
      <div className="min-h-screen grid place-items-center bg-[#0B1A30]">
        <div className="text-center">
          <div className="mx-auto mb-4 h-10 w-10 rounded-full border-2 border-[#D4AF37] border-t-transparent spin-slow" />
          <div className="text-slate-300 font-head">A carregar INVEST…</div>
        </div>
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  return <Layout>{children}</Layout>;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/emitir/:tenant" element={<EmitirPublico />} />
        <Route path="/enviar/:tenant" element={<EnviarPublico />} />
        <Route path="/fatura/:number" element={<FaturaPublica />} />
        <Route path="/crypto-publico" element={<CryptoPublico />} />
        <Route path="/crypto-invest" element={<CryptoInvestLogin />} />
        <Route path="/crypto-invest/painel" element={<CryptoInvest />} />
        <Route path="/crypto-invest/sessao/:code" element={<CryptoInvestViewer />} />
        <Route path="/suporte/:code" element={<SuporteCliente />} />
        <Route path="/" element={<Navigate to="/app" replace />} />
        <Route path="/app" element={<Protected><Dashboard /></Protected>} />
        <Route path="/app/faturas" element={<Protected><Faturas /></Protected>} />
        <Route path="/app/faturas/nova" element={<Protected><FaturaForm /></Protected>} />
        <Route path="/app/faturas/:id" element={<Protected><FaturaDetalhe /></Protected>} />
        <Route path="/app/faturas/:id/editar" element={<Protected><FaturaForm /></Protected>} />
        <Route path="/app/clientes" element={<Protected><Clientes /></Protected>} />
        <Route path="/app/clientes/:id" element={<Protected><ClienteDetalhe /></Protected>} />
        <Route path="/app/comprovativos" element={<Protected><Comprovativos /></Protected>} />
        <Route path="/app/uploads" element={<Protected><Uploads /></Protected>} />
        <Route path="/app/contratos" element={<Protected><Contratos /></Protected>} />
        <Route path="/app/modelos" element={<Protected><Modelos /></Protected>} />
        <Route path="/app/relatorios" element={<Protected><Relatorios /></Protected>} />
        <Route path="/app/utilizadores" element={<Protected><Utilizadores /></Protected>} />
        <Route path="/app/historico" element={<Protected><Historico /></Protected>} />
        <Route path="/app/definicoes" element={<Protected><Definicoes /></Protected>} />
        <Route path="/app/calculo" element={<Protected><Calculo /></Protected>} />
        <Route path="/app/monitorizacao" element={<Protected><Monitorizacao /></Protected>} />
        <Route path="/app/crypto" element={<Protected><Crypto /></Protected>} />
        <Route path="/app/crypto/historico" element={<Protected><CryptoHistorico /></Protected>} />
        <Route path="/app/leads" element={<Protected><Leads /></Protected>} />
        <Route path="*" element={<Navigate to="/app" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
