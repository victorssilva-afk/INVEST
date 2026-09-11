import { useEffect, useRef, useState, useCallback } from "react";
import { WS_URL, API } from "@/lib/api";
import { PageHeader, Card } from "@/components/ui/primitives";
import { Activity, Server, Database, Wifi, Users, Clock, Maximize2, RefreshCw, AlertTriangle, ExternalLink, Monitor, RotateCw, Zap, ZapOff } from "lucide-react";

const BROWSERLING = "https://www.browserling.com/browse/android15/chrome126";

const STATE = {
  online: { label: "Online", color: "#22c55e" },
  instavel: { label: "Instável", color: "#eab308" },
  reconectando: { label: "Reconectando…", color: "#f97316" },
  offline: { label: "Offline", color: "#ef4444" },
};

export default function Monitorizacao() {
  const [conn, setConn] = useState("reconectando");
  const [stats, setStats] = useState(null);
  const [clock, setClock] = useState(new Date());
  const [wake, setWake] = useState(false);
  const [frameKey, setFrameKey] = useState(0);
  const [keepAlive, setKeepAlive] = useState(false);
  const [renewSecs, setRenewSecs] = useState(150);
  const [countdown, setCountdown] = useState(150);
  const [pings, setPings] = useState(0);

  const wsRef = useRef(null);
  const retryRef = useRef(0);
  const heartbeatRef = useRef(null);
  const reconnectRef = useRef(null);
  const mounted = useRef(true);
  const rootRef = useRef(null);
  const frameRef = useRef(null);
  const wakeRef = useRef(null);
  const audioRef = useRef(null);
  const workerRef = useRef(null);
  const renewSecsRef = useRef(150);
  const countdownRef = useRef(150);

  useEffect(() => { renewSecsRef.current = renewSecs; }, [renewSecs]);

  const connect = useCallback(() => {
    if (!mounted.current) return;
    setConn((c) => (c === "online" ? "instavel" : "reconectando"));
    let ws;
    try { ws = new WebSocket(WS_URL); } catch { scheduleReconnect(); return; }
    wsRef.current = ws;
    ws.onopen = () => {
      retryRef.current = 0;
      setConn("online");
      heartbeatRef.current = setInterval(() => { if (ws.readyState === 1) ws.send("ping"); }, 5000);
    };
    ws.onmessage = (e) => { try { setStats(JSON.parse(e.data)); setConn("online"); } catch {} };
    ws.onclose = () => { clearInterval(heartbeatRef.current); if (mounted.current) { setConn("offline"); scheduleReconnect(); } };
    ws.onerror = () => { try { ws.close(); } catch {} };
  }, []);

  const scheduleReconnect = useCallback(() => {
    if (!mounted.current) return;
    setConn("reconectando");
    const delay = Math.min(1000 * 2 ** retryRef.current, 15000);
    retryRef.current += 1;
    clearTimeout(reconnectRef.current);
    reconnectRef.current = setTimeout(connect, delay);
  }, [connect]);

  const requestWake = useCallback(async () => {
    try {
      if ("wakeLock" in navigator && (!wakeRef.current || wakeRef.current.released)) {
        wakeRef.current = await navigator.wakeLock.request("screen");
        wakeRef.current.addEventListener("release", () => setWake(false));
        setWake(true);
      }
    } catch { setWake(false); }
  }, []);

  const pingHealth = useCallback(() => {
    fetch(`${API}/health`).then(() => setPings((p) => p + 1)).catch(() => {});
  }, []);

  const startKeepAlive = useCallback(() => {
    // 1) áudio silencioso -> o Chrome considera o separador "a reproduzir" e não o suspende
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (AC && !audioRef.current) {
        const ctx = new AC();
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        g.gain.value = 0.0001;
        osc.frequency.value = 30;
        osc.connect(g); g.connect(ctx.destination);
        osc.start();
        if (ctx.state === "suspended") ctx.resume();
        audioRef.current = { ctx, osc };
      }
    } catch {}
    // 2) timer em Web Worker -> não é abrandado quando o separador está em segundo plano
    if (!workerRef.current) {
      const code = "let n=0;setInterval(function(){n++;postMessage(n);},1000);";
      const url = URL.createObjectURL(new Blob([code], { type: "application/javascript" }));
      const w = new Worker(url);
      w.onmessage = () => {
        countdownRef.current -= 1;
        setCountdown(countdownRef.current);
        try { document.dispatchEvent(new MouseEvent("mousemove", { bubbles: true })); } catch {}
        if (countdownRef.current % 10 === 0) { pingHealth(); requestWake(); }
        if (countdownRef.current <= 0) {
          setFrameKey((k) => k + 1);                 // renova a sessão do browserling antes de expirar
          countdownRef.current = renewSecsRef.current;
          setCountdown(renewSecsRef.current);
        }
      };
      workerRef.current = { w, url };
    }
    countdownRef.current = renewSecsRef.current;
    setCountdown(renewSecsRef.current);
    requestWake();
    setKeepAlive(true);
  }, [pingHealth, requestWake]);

  const stopKeepAlive = useCallback(() => {
    try { audioRef.current?.osc.stop(); audioRef.current?.ctx.close(); } catch {}
    audioRef.current = null;
    if (workerRef.current) { try { workerRef.current.w.terminate(); URL.revokeObjectURL(workerRef.current.url); } catch {} workerRef.current = null; }
    setKeepAlive(false);
  }, []);

  useEffect(() => {
    mounted.current = true;
    connect();
    requestWake();
    const onVis = () => { if (document.visibilityState === "visible") requestWake(); };
    document.addEventListener("visibilitychange", onVis);
    const clockT = setInterval(() => setClock(new Date()), 1000);
    return () => {
      mounted.current = false;
      clearInterval(clockT);
      clearInterval(heartbeatRef.current);
      clearTimeout(reconnectRef.current);
      document.removeEventListener("visibilitychange", onVis);
      try { wakeRef.current?.release?.(); } catch {}
      try { audioRef.current?.osc.stop(); audioRef.current?.ctx.close(); } catch {}
      if (workerRef.current) { try { workerRef.current.w.terminate(); URL.revokeObjectURL(workerRef.current.url); } catch {} }
      if (wsRef.current) { wsRef.current.onclose = null; try { wsRef.current.close(); } catch {} }
    };
  }, [connect, requestWake]);

  const fullscreen = (el) => { if (!document.fullscreenElement) el?.requestFullscreen?.(); else document.exitFullscreen?.(); };
  const renewNow = () => { setFrameKey((k) => k + 1); countdownRef.current = renewSecsRef.current; setCountdown(renewSecsRef.current); };

  const s = STATE[conn];
  const items = [
    { label: "Sistema", value: conn === "online" ? "Online" : s.label, icon: Activity, ok: conn === "online" },
    { label: "Backend", value: stats?.backend === "online" ? "Online" : "—", icon: Server, ok: stats?.backend === "online" },
    { label: "Base de dados", value: stats?.database === "ok" ? "Online" : "—", icon: Database, ok: stats?.database === "ok" },
    { label: "API", value: stats?.api === "operacional" ? "Operacional" : "—", icon: Wifi, ok: !!stats?.api },
  ];
  const mmss = (n) => `${String(Math.floor(Math.max(0, n) / 60)).padStart(2, "0")}:${String(Math.max(0, n) % 60).padStart(2, "0")}`;

  return (
    <div ref={rootRef} className="min-h-full">
      <PageHeader title="Monitorização" subtitle="Painel permanente · ligação em tempo real com reconexão automática">
        <button data-testid="fullscreen-btn" onClick={() => fullscreen(rootRef.current)} className="flex items-center gap-1.5 rounded-lg bg-slate-100 px-4 py-2 text-sm font-semibold text-[#0B1A30] hover:bg-slate-200"><Maximize2 size={15} /> Ecrã inteiro</button>
      </PageHeader>

      <Card className="navy-gradient mb-5 text-white">
        <div className="flex flex-col items-center gap-3 py-6 text-center">
          <div className="flex items-center gap-3">
            <span className="h-4 w-4 rounded-full pulse-dot" style={{ background: s.color }} />
            <span className="font-head text-3xl font-bold" data-testid="system-status" style={{ color: s.color }}>{conn === "online" ? "Sistema Online" : s.label}</span>
          </div>
          <div className="font-mono text-5xl font-bold tracking-tight text-white" data-testid="monitor-clock">{clock.toLocaleTimeString("pt-PT")}</div>
          <div className="text-sm text-slate-400">{clock.toLocaleDateString("pt-PT", { weekday: "long", day: "2-digit", month: "long", year: "numeric" })}</div>
          {conn === "reconectando" && <div className="flex items-center gap-2 text-orange-400"><RefreshCw size={16} className="spin-slow" /> A reconectar ao servidor…</div>}
        </div>
      </Card>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {items.map((it) => (
          <Card key={it.label} data-testid={`monitor-${it.label.toLowerCase().replace(/[^a-z]/g, "")}`}>
            <div className="flex items-center justify-between"><it.icon size={18} className="text-slate-400" /><span className="h-2.5 w-2.5 rounded-full pulse-dot" style={{ background: it.ok ? "#22c55e" : "#ef4444" }} /></div>
            <div className="mt-2 text-xs uppercase text-slate-400">{it.label}</div>
            <div className="font-head text-lg font-bold text-[#0B1A30]">{it.value}</div>
          </Card>
        ))}
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-4">
        <Card><div className="flex items-center gap-2 text-slate-400"><Clock size={16} /> <span className="text-xs uppercase">Uptime</span></div><div className="mt-2 font-head text-xl font-bold text-[#0B1A30]" data-testid="uptime">{stats?.uptime || "—"}</div></Card>
        <Card><div className="flex items-center gap-2 text-slate-400"><Users size={16} /> <span className="text-xs uppercase">Utilizadores online</span></div><div className="mt-2 font-head text-xl font-bold text-[#0B1A30]">{stats?.online_users ?? "—"}</div></Card>
        <Card><div className="flex items-center gap-2 text-slate-400"><Monitor size={16} /> <span className="text-xs uppercase">Ecrã ativo (Wake Lock)</span></div><div className="mt-2 font-head text-xl font-bold" style={{ color: wake ? "#16a34a" : "#94a3b8" }}>{wake ? "Ativo" : "Inativo"}</div></Card>
        <Card><div className="flex items-center gap-2 text-slate-400"><Zap size={16} /> <span className="text-xs uppercase">Pings keep-alive</span></div><div className="mt-2 font-head text-xl font-bold text-[#0B1A30]">{pings}</div></Card>
      </div>

      {/* Sessão Chrome permanente + Modo Sempre Ativo */}
      <Card className="mt-5 p-0 overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-[#0B1A30] px-4 py-3 text-white">
          <div className="flex items-center gap-2 font-head font-semibold"><Monitor size={17} className="text-[#D4AF37]" /> Sessão Chrome Permanente</div>
          <div className="flex flex-wrap items-center gap-2">
            {!keepAlive ? (
              <button data-testid="keepalive-on" onClick={startKeepAlive} className="flex items-center gap-1.5 rounded-lg gold-gradient px-3 py-1.5 text-xs font-bold text-[#0B1A30]"><Zap size={13} /> Ativar modo sempre ativo</button>
            ) : (
              <button data-testid="keepalive-off" onClick={stopKeepAlive} className="flex items-center gap-1.5 rounded-lg bg-emerald-500 px-3 py-1.5 text-xs font-bold text-white"><ZapOff size={13} /> Sempre ativo: LIGADO</button>
            )}
            <button data-testid="frame-reload" onClick={renewNow} className="flex items-center gap-1.5 rounded-lg bg-white/10 px-3 py-1.5 text-xs font-semibold hover:bg-white/20"><RotateCw size={13} /> Renovar agora</button>
            <button data-testid="frame-fullscreen" onClick={() => fullscreen(frameRef.current)} className="flex items-center gap-1.5 rounded-lg bg-white/10 px-3 py-1.5 text-xs font-semibold hover:bg-white/20"><Maximize2 size={13} /> Ecrã inteiro</button>
            <a data-testid="frame-newtab" href={BROWSERLING} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 rounded-lg bg-white/10 px-3 py-1.5 text-xs font-semibold hover:bg-white/20"><ExternalLink size={13} /> Nova janela</a>
          </div>
        </div>

        {keepAlive && (
          <div className="flex flex-wrap items-center gap-4 border-b border-slate-200 bg-emerald-50 px-4 py-2.5 text-xs text-emerald-800">
            <span className="flex items-center gap-1.5 font-semibold"><span className="h-2 w-2 rounded-full bg-emerald-500 pulse-dot" /> Modo sempre ativo LIGADO</span>
            <span>Renova a sessão em <b data-testid="renew-countdown">{mmss(countdown)}</b></span>
            <label className="flex items-center gap-1.5">Renovar a cada
              <select data-testid="renew-interval" value={renewSecs} onChange={(e) => setRenewSecs(+e.target.value)} className="rounded border border-emerald-300 bg-white px-1.5 py-0.5">
                <option value={90}>90s</option><option value={120}>2 min</option><option value={150}>2,5 min</option><option value={180}>3 min</option>
              </select>
            </label>
            <span>Áudio silencioso + Wake Lock + Web Worker ativos</span>
          </div>
        )}

        <div ref={frameRef} className="bg-black">
          <iframe key={frameKey} title="Sessão Chrome Permanente" src={BROWSERLING} data-testid="chrome-iframe"
            className="h-[640px] w-full border-0" allow="fullscreen; clipboard-read; clipboard-write; autoplay" referrerPolicy="no-referrer" />
        </div>

        <div className="border-t border-slate-200 bg-amber-50 px-4 py-3 text-xs text-amber-800">
          <b>Modo sempre ativo — o que faz:</b> mantém o separador acordado com <b>áudio silencioso</b> (o Chrome não suspende separadores que reproduzem som), <b>Wake Lock</b> (ecrã não adormece), um <b>Web Worker</b> (temporizador que não abranda em segundo plano) e um <b>ping</b> ao backend a cada 10s. Como a sessão gratuita do browserling é um <b>demo com tempo limitado</b>, o modo <b>renova a janela automaticamente</b> antes de expirar (intervalo configurável acima).
          <br />⚠️ Por segurança do navegador, <b>não é possível injetar cliques dentro do ecrã do browserling</b> (é outro domínio) — nenhuma página consegue clicar dentro de um iframe externo. Para sessões verdadeiramente ilimitadas, use uma conta browserling paga ou outro serviço de browser na nuvem. Para funcionar sem o seu PC, aloje o painel num dispositivo sempre-ligado (mini-PC/VPS). O <b>backend INVEST já corre 24/7 no servidor</b>, independente desta janela.
        </div>
      </Card>

      <Card className="mt-5">
        <div className="flex items-center gap-2 text-slate-500"><AlertTriangle size={16} /> <span className="text-sm font-semibold">Alertas e erros recentes</span></div>
        <div className="mt-2 text-sm text-slate-400">Sem erros recentes. O backend permanece ativo no servidor independentemente desta janela.</div>
      </Card>
    </div>
  );
}
