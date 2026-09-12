/* eslint-disable react-hooks/exhaustive-deps */
import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import api, { apiError } from "@/lib/api";
import { PageHeader, Card, Loading, GoldButton, NavyButton } from "@/components/ui/primitives";
import { AreaChart, Area, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";
import { Bitcoin, TrendingUp, TrendingDown, Sparkles, RefreshCw, Newspaper, Gauge, Activity, History, Star, Plus, X } from "lucide-react";
import { toast } from "sonner";

const TIMEFRAMES = ["1h", "4h", "1D", "1W", "1M"];
const pct = (v) => (v == null ? "—" : `${v >= 0 ? "+" : ""}${v.toFixed(2)}%`);
const usd = (v) => v == null ? "—" : "$" + Number(v).toLocaleString("en-US", { maximumFractionDigits: v < 10 ? 4 : 2 });
const big = (v) => v == null ? "—" : "$" + (v >= 1e9 ? (v / 1e9).toFixed(2) + "B" : (v / 1e6).toFixed(1) + "M");
const scoreColor = (s) => s >= 15 ? "#22c55e" : s <= -15 ? "#ef4444" : "#eab308";

function ChangeBadge({ v }) {
  if (v == null) return <span className="text-slate-400">—</span>;
  const up = v >= 0;
  return <span className={`inline-flex items-center gap-0.5 text-xs font-semibold ${up ? "text-green-600" : "text-red-600"}`}>{up ? <TrendingUp size={12} /> : <TrendingDown size={12} />}{pct(v)}</span>;
}

export default function Crypto() {
  const navigate = useNavigate();
  const [market, setMarket] = useState(null);
  const [selected, setSelected] = useState("BTC");
  const [tf, setTf] = useState("4h");
  const [asset, setAsset] = useState(null);
  const [analysis, setAnalysis] = useState(null);
  const [generating, setGenerating] = useState(false);
  const [news, setNews] = useState([]);
  const [sources, setSources] = useState([]);
  const [newSym, setNewSym] = useState("");
  const [accuracy, setAccuracy] = useState(null);
  const loadAccuracy = useCallback(() => { api.get("/crypto/accuracy").then((r) => setAccuracy(r.data)).catch(() => {}); }, []);

  const loadMarket = useCallback(() => {
    api.get("/crypto/market").then((r) => setMarket(r.data)).catch((e) => toast.error(apiError(e, "Dados de mercado indisponíveis")));
  }, []);
  const loadAsset = useCallback((sym, days) => {
    setAsset(null);
    api.get(`/crypto/assets/${sym}`, { params: { days } }).then((r) => setAsset(r.data)).catch(() => setAsset({ error: true }));
  }, []);

  useEffect(() => { loadMarket(); loadAccuracy(); api.get("/crypto/news").then((r) => setNews(r.data.news)).catch(() => {}); api.get("/crypto/sources").then((r) => setSources(r.data)).catch(() => {}); }, [loadMarket, loadAccuracy]);
  useEffect(() => { const days = { "1h": "1", "4h": "7", "1D": "30", "1W": "90", "1M": "365" }[tf]; loadAsset(selected, days); }, [selected, tf, loadAsset]);
  useEffect(() => { const t = setInterval(loadMarket, 60000); return () => clearInterval(t); }, [loadMarket]);

  const generate = async () => {
    setGenerating(true); setAnalysis(null);
    try { const { data } = await api.post("/crypto/analysis", { symbol: selected, timeframe: tf }); setAnalysis(data); loadAccuracy(); toast.success("Análise gerada"); }
    catch (e) { toast.error(apiError(e)); } finally { setGenerating(false); }
  };
  const addWatch = async () => { if (!newSym) return; try { await api.post("/crypto/watchlist", { symbol: newSym.toUpperCase() }); setNewSym(""); loadMarket(); } catch (e) { toast.error(apiError(e)); } };

  if (!market) return <Loading label="A obter dados de mercado…" />;
  const top = market.market;
  const btc = top.find((c) => c.symbol === "BTC");
  const eth = top.find((c) => c.symbol === "ETH");
  const ind = asset?.indicators;
  const chartData = (asset?.chart?.prices || []).map((p) => ({ t: new Date(p.t).toLocaleDateString("pt-PT", { day: "2-digit", month: "2-digit" }), p: p.p }));

  return (
    <>
      <PageHeader title="Análise Crypto" subtitle="Central de inteligência · dados reais CoinGecko + análise IA">
        <button onClick={() => { navigator.clipboard.writeText(`${window.location.origin}/crypto-publico`); toast.success("Link público copiado"); }} data-testid="copy-crypto-public-link" className="flex items-center gap-1.5 rounded-lg bg-slate-100 px-4 py-2 text-sm font-semibold text-[#0B1A30] hover:bg-slate-200"><Star size={15} /> Copiar link público</button>
        <a href="/crypto-publico" target="_blank" rel="noreferrer" data-testid="open-crypto-public" className="flex items-center gap-1.5 rounded-lg gold-gradient px-4 py-2 text-sm font-bold text-[#0B1A30]"><Newspaper size={15} /> Análise Pública</a>
        <NavyButton data-testid="crypto-history-btn" onClick={() => navigate("/app/crypto/historico")}><History size={15} className="mr-1 inline" /> Histórico</NavyButton>
        <button onClick={loadMarket} className="flex items-center gap-1.5 rounded-lg bg-slate-100 px-4 py-2 text-sm font-semibold text-[#0B1A30] hover:bg-slate-200"><RefreshCw size={15} /> Atualizar</button>
      </PageHeader>

      {/* Top BTC/ETH + market */}
      <div className="grid gap-4 lg:grid-cols-4">
        {[btc, eth].filter(Boolean).map((c) => (
          <Card key={c.symbol} className="navy-gradient text-white lg:col-span-1" data-testid={`crypto-top-${c.symbol}`}>
            <div className="flex items-center gap-2"><Bitcoin size={18} className="text-[#D4AF37]" /><span className="font-head font-bold">{c.symbol}</span><span className="text-xs text-slate-400">{c.name}</span></div>
            <div className="mt-2 font-head text-2xl font-bold">{usd(c.price)}</div>
            <div className="mt-2 grid grid-cols-4 gap-1 text-center text-[11px]">
              {[["1h", c.change_1h], ["24h", c.change_24h], ["7d", c.change_7d], ["30d", c.change_30d]].map(([l, v]) => (
                <div key={l}><div className="text-slate-500">{l}</div><ChangeBadge v={v} /></div>
              ))}
            </div>
          </Card>
        ))}
        <Card><div className="text-xs uppercase text-slate-400">Market Cap Total</div><div className="mt-1 font-head text-lg font-bold text-[#0B1A30]">{big(market.global.total_market_cap)}</div>
          <div className="mt-2 text-xs text-slate-500">BTC {market.global.btc_dominance?.toFixed(1)}% · ETH {market.global.eth_dominance?.toFixed(1)}%</div></Card>
        <Card><div className="flex items-center gap-1.5 text-xs uppercase text-slate-400"><Gauge size={13} /> Fear & Greed</div>
          {market.fear_greed.available ? <><div className="mt-1 font-head text-2xl font-bold" style={{ color: scoreColor((market.fear_greed.value - 50) * 2) }}>{market.fear_greed.value}</div><div className="text-xs text-slate-500">{market.fear_greed.classification}</div></> : <div className="mt-2 text-sm text-slate-400">Dados indisponíveis nesta fonte.</div>}</Card>
      </div>

      {/* Selector */}
      <div className="mt-5 flex flex-wrap items-center gap-2">
        {top.slice(0, 8).map((c) => (
          <button key={c.symbol} data-testid={`select-asset-${c.symbol}`} onClick={() => setSelected(c.symbol)}
            className={`rounded-full px-3 py-1.5 text-xs font-semibold ${selected === c.symbol ? "bg-[#0B1A30] text-white" : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"}`}>{c.symbol} <span className="opacity-70">{pct(c.change_24h)}</span></button>
        ))}
        <div className="ml-auto flex gap-1">{TIMEFRAMES.map((t) => (
          <button key={t} data-testid={`tf-${t}`} onClick={() => setTf(t)} className={`rounded px-2.5 py-1 text-xs font-semibold ${tf === t ? "bg-[#D4AF37] text-[#0B1A30]" : "bg-white border border-slate-200 text-slate-600"}`}>{t}</button>
        ))}</div>
      </div>

      <div className="mt-4 grid gap-5 lg:grid-cols-3">
        {/* Chart + indicators */}
        <Card className="lg:col-span-2">
          <div className="mb-3 flex items-center justify-between"><h3 className="font-head font-semibold text-[#0B1A30]">{selected} · {tf}</h3><span className="text-sm text-slate-400">Fonte: CoinGecko</span></div>
          {!asset ? <Loading /> : asset.error ? <div className="grid h-64 place-items-center text-slate-400">Dados indisponíveis nesta fonte.</div> : (
            <>
              <ResponsiveContainer width="100%" height={260}>
                <AreaChart data={chartData}>
                  <defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#D4AF37" stopOpacity={0.4} /><stop offset="100%" stopColor="#D4AF37" stopOpacity={0} /></linearGradient></defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#eef2f7" vertical={false} />
                  <XAxis dataKey="t" tick={{ fontSize: 11, fill: "#94a3b8" }} minTickGap={40} />
                  <YAxis domain={["auto", "auto"]} tick={{ fontSize: 11, fill: "#94a3b8" }} width={60} tickFormatter={(v) => "$" + (v >= 1000 ? (v / 1000).toFixed(0) + "k" : v.toFixed(2))} />
                  <Tooltip formatter={(v) => usd(v)} contentStyle={{ borderRadius: 10, border: "1px solid #e2e8f0" }} />
                  <Area type="monotone" dataKey="p" stroke="#D4AF37" strokeWidth={2} fill="url(#g)" />
                </AreaChart>
              </ResponsiveContainer>
              {ind && (
                <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-6 text-center text-xs">
                  {[["RSI", ind.rsi], ["MACD", ind.macd], ["EMA50", ind.ema50], ["EMA200", ind.ema200], ["Suporte", ind.support], ["Resist.", ind.resistance]].map(([l, v]) => (
                    <div key={l} className="rounded-lg bg-slate-50 p-2"><div className="text-slate-400">{l}</div><div className="font-semibold text-[#0B1A30]">{typeof v === "number" && v > 100 ? usd(v) : v ?? "—"}</div></div>
                  ))}
                </div>
              )}
            </>
          )}
        </Card>

        {/* AI analysis */}
        <Card>
          <div className="mb-3 flex items-center justify-between"><h3 className="flex items-center gap-1.5 font-head font-semibold text-[#0B1A30]"><Sparkles size={16} className="text-[#D4AF37]" /> Análise IA</h3></div>
          <GoldButton data-testid="generate-analysis-btn" className="w-full" onClick={generate} disabled={generating}>{generating ? "A analisar…" : `Gerar análise ${selected}`}</GoldButton>
          {generating && <div className="mt-4"><Loading label="A cruzar dados e a gerar relatório…" /></div>}
          {analysis && (
            <div className="mt-4 space-y-3" data-testid="analysis-result">
              <div className="rounded-xl navy-gradient p-4 text-white text-center">
                <div className="text-xs uppercase text-slate-400">Score final</div>
                <div className="font-head text-4xl font-bold" style={{ color: scoreColor(analysis.final_score) }}>{analysis.final_score > 0 ? "+" : ""}{analysis.final_score}</div>
                <div className="text-sm font-semibold" style={{ color: scoreColor(analysis.final_score) }}>{analysis.trend}</div>
                <div className="mt-1 text-xs text-slate-400">Confiança: {analysis.confidence}/100</div>
              </div>
              {analysis.signal && (
                <div className="rounded-xl border border-slate-200 p-3" data-testid="signal-box">
                  <div className="mb-2 flex items-center justify-between text-xs"><span className="font-semibold text-[#0B1A30]">Sinal de mercado</span><span className="rounded-full px-2 py-0.5 text-[11px] font-bold" style={{ background: analysis.signal.recommendation === "Compra" ? "#dcfce7" : analysis.signal.recommendation === "Venda" ? "#fee2e2" : "#f1f5f9", color: analysis.signal.recommendation === "Compra" ? "#15803d" : analysis.signal.recommendation === "Venda" ? "#b91c1c" : "#475569" }}>{analysis.signal.recommendation}</span></div>
                  <div className="flex h-3 overflow-hidden rounded-full">
                    <div style={{ width: `${analysis.signal.buy}%`, background: "#22c55e" }} />
                    <div style={{ width: `${analysis.signal.neutral}%`, background: "#cbd5e1" }} />
                    <div style={{ width: `${analysis.signal.sell}%`, background: "#ef4444" }} />
                  </div>
                  <div className="mt-1 flex justify-between text-[11px]"><span className="text-green-600">Compra {analysis.signal.buy}%</span><span className="text-slate-500">Neutro {analysis.signal.neutral}%</span><span className="text-red-600">Venda {analysis.signal.sell}%</span></div>
                </div>
              )}
              <div className="grid grid-cols-5 gap-1 text-center text-[10px]">
                {[["Téc", analysis.technical_score], ["Macro", analysis.macro_score], ["Sent", analysis.sentiment_score], ["Chain", analysis.onchain_score], ["Liq", analysis.liquidity_score]].map(([l, v]) => (
                  <div key={l} className="rounded bg-slate-50 p-1.5"><div className="text-slate-400">{l}</div><div className="font-bold" style={{ color: scoreColor(v) }}>{v > 0 ? "+" : ""}{v}</div></div>
                ))}
              </div>
              {analysis.report && <div className="max-h-80 overflow-y-auto whitespace-pre-wrap rounded-lg bg-slate-50 p-3 text-xs leading-relaxed text-slate-700">{analysis.report}</div>}
              <div className="text-[11px] text-amber-600">{analysis.data_notes}</div>
              <div className="text-[11px] text-slate-400">Fontes: {analysis.sources?.join(", ")}</div>
            </div>
          )}
        </Card>
      </div>

      {accuracy && (
        <Card className="mt-5" data-testid="accuracy-card">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 font-head font-semibold text-[#0B1A30]"><Gauge size={16} className="text-[#D4AF37]" /> Precisão da IA · auto-aprendizagem</div>
            <div className="flex flex-wrap gap-4 text-sm">
              <span>Previsões: <b>{accuracy.total}</b></span>
              <span>Avaliadas: <b>{accuracy.evaluated}</b></span>
              <span>Acertos: <b className="text-green-600">{accuracy.correct}</b></span>
              <span>Taxa de acerto: <b className="text-[#0B1A30]">{accuracy.accuracy_pct != null ? `${accuracy.accuracy_pct}%` : "— (a aguardar horizonte)"}</b></span>
              <span className="text-slate-400">Pendentes: {accuracy.pending}</span>
            </div>
          </div>
          {accuracy.by_symbol?.length > 0 && <div className="mt-2 flex flex-wrap gap-2">{accuracy.by_symbol.map((s) => <span key={s.symbol} className="rounded bg-slate-100 px-2 py-0.5 text-xs">{s.symbol}: {s.accuracy_pct != null ? `${s.accuracy_pct}%` : "—"} ({s.correct}/{s.evaluated})</span>)}</div>}
          <div className="mt-1 text-[11px] text-slate-400">O sistema regista cada previsão (Compra/Venda/Neutro) e compara com o preço real no fim do horizonte, aprendendo a sua taxa de acerto ao longo do tempo.</div>
        </Card>
      )}

      {/* Sources + Watchlist + News */}
      <div className="mt-5 grid gap-5 lg:grid-cols-3">
        <Card>
          <h3 className="mb-3 flex items-center gap-1.5 font-head font-semibold text-[#0B1A30]"><Activity size={16} /> Estado das fontes</h3>
          <div className="space-y-2 text-sm">{sources.map((s) => (
            <div key={s.name} className="flex items-center justify-between"><span>{s.name} <span className="text-xs text-slate-400">· {s.type}</span></span>
              <span className={`flex items-center gap-1 text-xs font-semibold ${s.status === "disponivel" ? "text-green-600" : "text-slate-400"}`}><span className={`h-2 w-2 rounded-full ${s.status === "disponivel" ? "bg-green-500" : "bg-slate-300"}`} />{s.status === "disponivel" ? "Disponível" : "Indisponível"}</span></div>
          ))}</div>
        </Card>

        <Card>
          <div className="mb-3 flex items-center justify-between"><h3 className="flex items-center gap-1.5 font-head font-semibold text-[#0B1A30]"><Star size={16} className="text-[#D4AF37]" /> Watchlist</h3></div>
          <div className="mb-3 flex gap-2"><input className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm outline-none" placeholder="BTC, SOL…" value={newSym} onChange={(e) => setNewSym(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addWatch()} /><button onClick={addWatch} className="rounded-lg bg-[#0B1A30] px-2 text-white"><Plus size={15} /></button></div>
          <div className="space-y-1.5">{top.map((c) => (
            <div key={c.symbol} className="flex items-center justify-between rounded-lg px-2 py-1.5 text-sm hover:bg-slate-50 cursor-pointer" onClick={() => setSelected(c.symbol)}>
              <span className="font-semibold text-[#0B1A30]">{c.symbol}</span><span>{usd(c.price)}</span><ChangeBadge v={c.change_24h} />
            </div>
          ))}</div>
        </Card>

        <Card>
          <h3 className="mb-3 flex items-center gap-1.5 font-head font-semibold text-[#0B1A30]"><Newspaper size={16} /> Notícias</h3>
          {news.length === 0 ? <div className="text-sm text-slate-400">Dados indisponíveis nesta fonte.</div> : (
            <div className="max-h-80 space-y-3 overflow-y-auto">{news.slice(0, 12).map((n, i) => (
              <a key={i} href={n.url} target="_blank" rel="noreferrer" className="block border-b border-slate-100 pb-2">
                <div className="flex items-center gap-2"><span className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${n.sentiment === "bullish" ? "bg-green-100 text-green-700" : n.sentiment === "bearish" ? "bg-red-100 text-red-700" : "bg-slate-100 text-slate-500"}`}>{n.sentiment}</span><span className="text-[11px] text-slate-400">{n.source}</span></div>
                <div className="mt-1 text-sm text-slate-700 line-clamp-2">{n.title}</div>
              </a>
            ))}</div>
          )}
        </Card>
      </div>
      <p className="mt-4 text-center text-xs text-slate-400">Os dados apresentados destinam-se a apoio à decisão e não constituem garantia de movimentos futuros. Macro e On-chain sem fonte gratuita fiável integrada.</p>
    </>
  );
}
