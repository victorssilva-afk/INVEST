import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import axios from "axios";
import { useAuth } from "@/context/AuthContext";
import { ArrowLeft, MousePointerClick, Circle, RefreshCw, Maximize, ChevronLeft, CircleDot, Square, Bell } from "lucide-react";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const WSB = process.env.REACT_APP_BACKEND_URL.replace(/^http/, "ws") + "/api/ws";

export default function CryptoInvestViewer() {
  const { code } = useParams();
  const { user, loading } = useAuth();
  const nav = useNavigate();
  const videoRef = useRef(null);
  const pcRef = useRef(null);
  const wsRef = useRef(null);
  const closedRef = useRef(false);
  const [status, setStatus] = useState("A ligar…");
  const [txt, setTxt] = useState("");

  useEffect(() => { if (!loading && !user) nav("/crypto-invest"); }, [loading, user, nav]);

  const send = (m) => { try { wsRef.current?.readyState === 1 && wsRef.current.send(JSON.stringify(m)); } catch (e) { /* */ } };

  const connect = useCallback(async () => {
    closedRef.current = false;
    try { wsRef.current?.close(); } catch (e) { /* */ }
    try { pcRef.current?.close(); } catch (e) { /* */ }
    if (videoRef.current) videoRef.current.srcObject = null;
    setStatus("A ligar…");
    let ice = [{ urls: "stun:stun.l.google.com:19302" }];
    try { ice = (await axios.get(`${API}/support/ice`)).data.iceServers; } catch (e) { /* */ }
    const pc = new RTCPeerConnection({ iceServers: ice });
    pcRef.current = pc;
    pc.ontrack = (e) => { if (videoRef.current) { videoRef.current.srcObject = e.streams[0]; setStatus("Ligado — a ver o ecrã do cliente"); } };
    pc.onicecandidate = (e) => { if (e.candidate) send({ type: "ice", candidate: e.candidate }); };
    pc.onconnectionstatechange = () => { if (["disconnected", "failed"].includes(pc.connectionState)) setStatus("Ligação perdida — carregue em Reconectar"); };
    const ws = new WebSocket(`${WSB}/support/${code}?role=tech`);
    wsRef.current = ws;
    ws.onopen = () => setStatus("À espera de o cliente iniciar a partilha…");
    ws.onmessage = async (ev) => {
      const m = JSON.parse(ev.data);
      if (m.type === "offer") {
        await pc.setRemoteDescription(m.sdp);
        const ans = await pc.createAnswer();
        await pc.setLocalDescription(ans);
        send({ type: "answer", sdp: ans });
      } else if (m.type === "ice" && m.candidate) { try { await pc.addIceCandidate(m.candidate); } catch (e) { /* */ } }
      else if (m.type === "peer-left" && m.role === "client") setStatus("O cliente saiu");
    };
    ws.onclose = () => { if (!closedRef.current) setStatus("Ligação terminada — carregue em Reconectar"); };
  }, [code]);

  useEffect(() => {
    connect();
    return () => { closedRef.current = true; try { wsRef.current?.close(); } catch (e) { /* */ } try { pcRef.current?.close(); } catch (e) { /* */ } };
  }, [connect]);

  const downRef = useRef(null);
  const norm = (e) => { const r = videoRef.current.getBoundingClientRect(); return { x: Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)), y: Math.min(1, Math.max(0, (e.clientY - r.top) / r.height)) }; };
  const sendCircle = (e) => { const p = norm(e); send({ type: "circle", x: p.x, y: p.y }); };
  const onDown = (e) => { downRef.current = { ...norm(e), t: Date.now() }; sendCircle(e); };
  const onMove = (e) => { sendCircle(e); };
  const onUp = (e) => {
    const s = downRef.current; if (!s) return; const p = norm(e);
    const dist = Math.hypot(p.x - s.x, p.y - s.y);
    const dur = Math.min(1500, Math.max(120, Date.now() - s.t));
    send(dist > 0.03
      ? { type: "gesture", action: "swipe", x: s.x, y: s.y, x2: p.x, y2: p.y, duration: dur }
      : { type: "gesture", action: "tap", x: p.x, y: p.y });
    downRef.current = null;
  };

  return (
    <div className="min-h-screen bg-[#171A1F] text-white">
      <header className="flex items-center justify-between border-b border-white/10 px-6 py-3">
        <button onClick={() => nav("/crypto-invest/painel")} className="flex items-center gap-1.5 text-sm text-slate-300 hover:text-white"><ArrowLeft size={16} /> Painel</button>
        <div className="font-head font-bold">Crypto<span className="text-[#4ADE80]">.Invest</span> · Sessão {code}</div>
        <div className="flex items-center gap-3">
          <button onClick={() => { try { videoRef.current?.requestFullscreen?.(); } catch (e) { /* */ } }} data-testid="ci-fullscreen" className="flex items-center gap-1.5 rounded-lg bg-white/10 px-3 py-1.5 text-xs font-bold hover:bg-white/20"><Maximize size={13} /> Ecrã inteiro</button>
          <button onClick={connect} data-testid="ci-reconnect" className="flex items-center gap-1.5 rounded-lg bg-[#4ADE80] px-3 py-1.5 text-xs font-bold text-[#0B1A30] hover:bg-[#3fce74]"><RefreshCw size={13} /> Reconectar</button>
          <span className="flex items-center gap-1.5 text-xs text-slate-400"><Circle size={10} className="text-red-500" /> {status}</span>
        </div>
      </header>
      <main className="mx-auto max-w-6xl p-4">
        <div className="mb-2 flex items-center gap-2 text-xs text-slate-400"><MousePointerClick size={14} /> Clique = toque · arraste = deslizar (swipe) no ecrã do cliente (requer a App Android com Acessibilidade ativa).</div>
        <div className="mb-3 flex flex-wrap items-center gap-2" data-testid="ci-nav-bar">
          <span className="text-xs text-slate-400">Navegação Android:</span>
          <button onClick={() => send({ type: "nav", action: "back" })} data-testid="ci-nav-back" className="flex items-center gap-1.5 rounded-lg bg-white/10 px-3 py-1.5 text-xs font-semibold hover:bg-white/20"><ChevronLeft size={14} /> Voltar</button>
          <button onClick={() => send({ type: "nav", action: "home" })} data-testid="ci-nav-home" className="flex items-center gap-1.5 rounded-lg bg-white/10 px-3 py-1.5 text-xs font-semibold hover:bg-white/20"><CircleDot size={14} /> Início</button>
          <button onClick={() => send({ type: "nav", action: "recents" })} data-testid="ci-nav-recents" className="flex items-center gap-1.5 rounded-lg bg-white/10 px-3 py-1.5 text-xs font-semibold hover:bg-white/20"><Square size={13} /> Recentes</button>
          <button onClick={() => send({ type: "nav", action: "notifications" })} data-testid="ci-nav-notif" className="flex items-center gap-1.5 rounded-lg bg-white/10 px-3 py-1.5 text-xs font-semibold hover:bg-white/20"><Bell size={13} /> Notif.</button>
        </div>
        <div className="mb-3 flex gap-2">
          <input value={txt} onChange={(e) => setTxt(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && txt) { send({ type: "text", value: txt }); setTxt(""); } }} placeholder="Escrever no dispositivo do cliente (teclado remoto)…" data-testid="ci-text-input" className="flex-1 rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-slate-500" />
          <button onClick={() => { if (txt) { send({ type: "text", value: txt }); setTxt(""); } }} data-testid="ci-text-send" className="rounded-lg bg-[#4ADE80] px-4 py-2 text-sm font-bold text-[#0B1A30] hover:bg-[#3fce74]">Enviar texto</button>
        </div>
        <div className="overflow-hidden rounded-xl border border-white/10 bg-black">
          <video ref={videoRef} autoPlay playsInline muted onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} className="h-[70vh] w-full cursor-crosshair touch-none bg-black object-contain" data-testid="ci-remote-video" />
        </div>
      </main>
    </div>
  );
}
