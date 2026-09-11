import { useEffect, useRef, useState, useCallback } from "react";
import { WS_URL } from "@/lib/api";
import { PageHeader, Card } from "@/components/ui/primitives";
import { Activity, Server, Database, Wifi, Users, Clock, Maximize2, RefreshCw, AlertTriangle } from "lucide-react";

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
  const wsRef = useRef(null);
  const retryRef = useRef(0);
  const heartbeatRef = useRef(null);
  const reconnectRef = useRef(null);
  const mounted = useRef(true);
  const rootRef = useRef(null);

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
    const delay = Math.min(1000 * 2 ** retryRef.current, 15000); // backoff, capped
    retryRef.current += 1;
    clearTimeout(reconnectRef.current);
    reconnectRef.current = setTimeout(connect, delay);
  }, [connect]);

  useEffect(() => {
    mounted.current = true;
    connect();
    const clockT = setInterval(() => setClock(new Date()), 1000);
    return () => {
      mounted.current = false;
      clearInterval(clockT);
      clearInterval(heartbeatRef.current);
      clearTimeout(reconnectRef.current);
      if (wsRef.current) { wsRef.current.onclose = null; try { wsRef.current.close(); } catch {} }
    };
  }, [connect]);

  const fullscreen = () => { const el = rootRef.current; if (!document.fullscreenElement) el?.requestFullscreen?.(); else document.exitFullscreen?.(); };

  const s = STATE[conn];
  const items = [
    { label: "Sistema", value: conn === "online" ? "Online" : s.label, icon: Activity, ok: conn === "online" },
    { label: "Backend", value: stats?.backend === "online" ? "Online" : "—", icon: Server, ok: stats?.backend === "online" },
    { label: "Base de dados", value: stats?.database === "ok" ? "Online" : "—", icon: Database, ok: stats?.database === "ok" },
    { label: "API", value: stats?.api === "operacional" ? "Operacional" : "—", icon: Wifi, ok: !!stats?.api },
  ];

  return (
    <div ref={rootRef} className="min-h-full">
      <PageHeader title="Monitorização" subtitle="Painel permanente · ligação em tempo real com reconexão automática">
        <button data-testid="fullscreen-btn" onClick={fullscreen} className="flex items-center gap-1.5 rounded-lg bg-slate-100 px-4 py-2 text-sm font-semibold text-[#0B1A30] hover:bg-slate-200"><Maximize2 size={15} /> Ecrã inteiro</button>
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

      <div className="mt-5 grid gap-4 md:grid-cols-3">
        <Card><div className="flex items-center gap-2 text-slate-400"><Clock size={16} /> <span className="text-xs uppercase">Uptime</span></div><div className="mt-2 font-head text-xl font-bold text-[#0B1A30]" data-testid="uptime">{stats?.uptime || "—"}</div></Card>
        <Card><div className="flex items-center gap-2 text-slate-400"><Users size={16} /> <span className="text-xs uppercase">Utilizadores online</span></div><div className="mt-2 font-head text-xl font-bold text-[#0B1A30]">{stats?.online_users ?? "—"}</div></Card>
        <Card><div className="flex items-center gap-2 text-slate-400"><RefreshCw size={16} /> <span className="text-xs uppercase">Última sincronização</span></div><div className="mt-2 font-head text-xl font-bold text-[#0B1A30]">{stats?.last_sync ? new Date(stats.last_sync).toLocaleTimeString("pt-PT") : "—"}</div></Card>
      </div>

      <Card className="mt-5">
        <div className="flex items-center gap-2 text-slate-500"><AlertTriangle size={16} /> <span className="text-sm font-semibold">Alertas e erros recentes</span></div>
        <div className="mt-2 text-sm text-slate-400">Sem erros recentes. O backend permanece ativo no servidor independentemente desta janela.</div>
      </Card>
    </div>
  );
}
