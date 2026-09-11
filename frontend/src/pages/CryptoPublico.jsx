import { useEffect, useState } from "react";
import axios from "axios";
import { LOGO } from "@/lib/logo";
import { Bitcoin, Loader2 } from "lucide-react";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const fmtUsd = (v) => (v == null ? "—" : new Intl.NumberFormat("pt-PT", { style: "currency", currency: "USD" }).format(v));
const pct = (v) => (v == null ? "—" : `${v > 0 ? "+" : ""}${Number(v).toFixed(2)}%`);

export default function CryptoPublico() {
  const [data, setData] = useState(null);
  const [symbol, setSymbol] = useState("BTC");
  const [tf, setTf] = useState("4h");
  const [analysis, setAnalysis] = useState(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    axios.get(`${API}/public/crypto/market`).then((r) => setData(r.data)).catch(() => setErr("Dados de mercado indisponíveis de momento."));
  }, []);

  const gerar = async () => {
    setLoading(true); setErr("");
    try { const r = await axios.post(`${API}/public/crypto/analysis`, { symbol, timeframe: tf }); setAnalysis(r.data); }
    catch (e) { setErr("Não foi possível gerar a análise agora. Tente novamente."); }
    setLoading(false);
  };

  const top = (data?.market || []).slice(0, 8);
  const scoreCard = (label, val) => (
    <div className="rounded-xl border border-white/10 bg-white/5 p-3"><div className="text-xs text-slate-400">{label}</div><div className="font-head text-xl font-bold" style={{ color: val >= 0 ? "#22c55e" : "#ef4444" }}>{val > 0 ? "+" : ""}{val}</div></div>
  );

  return (
    <div className="min-h-screen bg-[#0B1A30] text-white">
      <header className="flex items-center gap-3 border-b border-white/10 px-6 py-4">
        <img src={LOGO} alt="logo" className="h-9 w-9 rounded bg-white p-1" />
        <div><div className="font-head text-lg font-bold">Análise Crypto <span className="text-[#D4AF37]">· Pública</span></div><div className="text-xs text-slate-400">Central de inteligência · dados de fontes públicas · em português</div></div>
      </header>

      <main className="mx-auto max-w-6xl space-y-6 px-6 py-8">
        {err && <div className="rounded-lg border border-red-500/30 bg-red-500/15 px-4 py-3 text-sm text-red-200">{err}</div>}

        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {top.map((m) => (
            <div key={m.symbol} className="rounded-2xl border border-white/10 bg-white/5 p-4" data-testid={`pub-coin-${m.symbol}`}>
              <div className="flex items-center justify-between"><span className="font-head font-bold">{m.symbol}</span><span className="text-xs text-slate-400">{m.name}</span></div>
              <div className="mt-2 font-head text-2xl font-bold">{fmtUsd(m.price)}</div>
              <div className="mt-1 flex gap-3 text-xs"><span style={{ color: (m.change_24h || 0) >= 0 ? "#22c55e" : "#ef4444" }}>24h {pct(m.change_24h)}</span><span className="text-slate-400">7d {pct(m.change_7d)}</span></div>
            </div>
          ))}
          {!top.length && <div className="col-span-full text-slate-400">A carregar mercado…</div>}
        </section>

        <section className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4"><div className="text-xs text-slate-400">Dominância BTC</div><div className="font-head text-xl font-bold">{data?.global?.btc_dominance != null ? `${data.global.btc_dominance.toFixed(1)}%` : "—"}</div></div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4"><div className="text-xs text-slate-400">Índice de Medo & Ganância</div><div className="font-head text-xl font-bold">{data?.fear_greed?.available ? `${data.fear_greed.value} · ${data.fear_greed.classification}` : "Indisponível"}</div></div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4"><div className="text-xs text-slate-400">Última atualização</div><div className="font-head text-sm font-bold">{data?.updated_at ? new Date(data.updated_at).toLocaleString("pt-PT") : "—"}</div></div>
        </section>

        <section className="rounded-2xl border border-white/10 bg-white/5 p-5">
          <div className="flex flex-wrap items-end gap-3">
            <div><label className="text-xs text-slate-400">Ativo</label><select value={symbol} onChange={(e) => setSymbol(e.target.value)} data-testid="pub-symbol" className="block rounded-lg border border-white/20 bg-[#0B1A30] px-3 py-2">{(data?.market || [{ symbol: "BTC" }, { symbol: "ETH" }]).map((m) => <option key={m.symbol} value={m.symbol}>{m.symbol}</option>)}</select></div>
            <div><label className="text-xs text-slate-400">Horizonte</label><select value={tf} onChange={(e) => setTf(e.target.value)} data-testid="pub-tf" className="block rounded-lg border border-white/20 bg-[#0B1A30] px-3 py-2">{["1h", "4h", "1D", "1W", "1M"].map((x) => <option key={x}>{x}</option>)}</select></div>
            <button onClick={gerar} disabled={loading} data-testid="pub-generate" className="flex items-center gap-2 rounded-lg gold-gradient px-5 py-2.5 font-bold text-[#0B1A30] disabled:opacity-60">{loading ? <Loader2 size={16} className="animate-spin" /> : <Bitcoin size={16} />}{loading ? "A analisar…" : "Gerar análise"}</button>
          </div>

          {analysis && (
            <div className="mt-6 space-y-5">
              <div className="flex flex-wrap items-center gap-4">
                <div className="font-head text-2xl font-bold">{analysis.asset} · {analysis.timeframe}</div>
                <span className="rounded-full bg-[#D4AF37] px-3 py-1 text-sm font-bold text-[#0B1A30]">{analysis.trend}</span>
                <span className="text-sm text-slate-300">Confiança: <b>{analysis.confidence}/100</b></span>
              </div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
                {scoreCard("Técnico", analysis.technical_score)}{scoreCard("Macro", analysis.macro_score)}{scoreCard("On-chain", analysis.onchain_score)}{scoreCard("Sentimento", analysis.sentiment_score)}{scoreCard("Liquidez", analysis.liquidity_score)}
                <div className="rounded-xl border border-[#D4AF37]/40 bg-[#D4AF37]/10 p-3"><div className="text-xs text-[#D4AF37]">Score final</div><div className="font-head text-xl font-bold">{analysis.final_score > 0 ? "+" : ""}{analysis.final_score}</div></div>
              </div>
              <div className="whitespace-pre-wrap rounded-xl border border-white/10 bg-[#0B1A30] p-4 text-sm leading-relaxed text-slate-200" data-testid="pub-report">{analysis.report || "Relatório indisponível."}</div>
              <p className="text-xs text-slate-500">Aviso: análise informativa baseada em dados públicos; não constitui aconselhamento financeiro nem garantia de movimentos futuros.</p>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
