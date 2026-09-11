import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api, { apiError } from "@/lib/api";
import { fmtDate } from "@/lib/format";
import { PageHeader, Card, Loading, Empty, NavyButton } from "@/components/ui/primitives";
import { History, Trash2 } from "lucide-react";
import { toast } from "sonner";

const scoreColor = (s) => s >= 15 ? "#22c55e" : s <= -15 ? "#ef4444" : "#eab308";

export default function CryptoHistorico() {
  const navigate = useNavigate();
  const [items, setItems] = useState(null);
  const load = () => api.get("/crypto/history").then((r) => setItems(r.data)).catch((e) => toast.error(apiError(e)));
  useEffect(() => { load(); }, []);
  const del = async (id) => { try { await api.delete(`/crypto/history/${id}`); load(); } catch (e) { toast.error(apiError(e)); } };

  return (
    <>
      <PageHeader title="Histórico de Análises Crypto" subtitle="Evolução dos scores gerados">
        <NavyButton onClick={() => navigate("/app/crypto")}>Voltar</NavyButton>
      </PageHeader>
      {!items ? <Loading /> : items.length === 0 ? <Empty icon={History} title="Sem análises" subtitle="Gere a primeira análise na Central Crypto" /> : (
        <Card className="p-0 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50"><tr className="text-left text-xs uppercase text-slate-400"><th className="px-5 py-3">Ativo</th><th>Timeframe</th><th>Score</th><th>Tendência</th><th>Confiança</th><th>Data</th><th></th></tr></thead>
            <tbody>{items.map((a) => (
              <tr key={a.id} className="border-t border-slate-100" data-testid={`analysis-${a.id}`}>
                <td className="px-5 py-3 font-semibold text-[#0B1A30]">{a.asset}</td><td>{a.timeframe}</td>
                <td className="font-bold" style={{ color: scoreColor(a.final_score) }}>{a.final_score > 0 ? "+" : ""}{a.final_score}</td>
                <td>{a.trend}</td><td>{a.confidence}/100</td><td className="text-slate-500">{fmtDate(a.generated_at, true)}</td>
                <td className="px-4 text-right"><button onClick={() => del(a.id)} className="rounded p-1.5 text-red-500 hover:bg-red-50"><Trash2 size={15} /></button></td>
              </tr>))}
            </tbody>
          </table>
        </Card>
      )}
    </>
  );
}
