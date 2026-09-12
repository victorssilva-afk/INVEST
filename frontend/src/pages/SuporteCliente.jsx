import { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import axios from "axios";
import { LOGO } from "@/lib/logo";
import { MonitorUp, ShieldCheck, Loader2, Smartphone, DownloadCloud } from "lucide-react";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const WSB = process.env.REACT_APP_BACKEND_URL.replace(/^http/, "ws") + "/api/ws";

export default function SuporteCliente() {
  const { code } = useParams();
  const pcRef = useRef(null);
  const wsRef = useRef(null);
  const streamRef = useRef(null);
  const [status, setStatus] = useState("");
  const [sharing, setSharing] = useState(false);
  const [circle, setCircle] = useState(null);
  const [deferred, setDeferred] = useState(null);
  const isAndroid = typeof navigator !== "undefined" && /android/i.test(navigator.userAgent);
  const standalone = typeof window !== "undefined" && window.matchMedia && window.matchMedia("(display-mode: standalone)").matches;
  useEffect(() => { const h = (e) => { e.preventDefault(); setDeferred(e); }; window.addEventListener("beforeinstallprompt", h); return () => window.removeEventListener("beforeinstallprompt", h); }, []);
  const install = async () => { if (deferred) { deferred.prompt(); await deferred.userChoice; setDeferred(null); } };

  useEffect(() => () => { stop(); }, []); // cleanup on unmount

  const send = (m) => { try { wsRef.current?.readyState === 1 && wsRef.current.send(JSON.stringify(m)); } catch (e) { /* */ } };

  const start = async () => {
    let stream;
    try { stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false }); }
    catch (e) { setStatus("Partilha cancelada."); return; }
    streamRef.current = stream;
    let ice = [{ urls: "stun:stun.l.google.com:19302" }];
    try { ice = (await axios.get(`${API}/support/ice`)).data.iceServers; } catch (e) { /* */ }
    const pc = new RTCPeerConnection({ iceServers: ice });
    pcRef.current = pc;
    stream.getTracks().forEach((t) => pc.addTrack(t, stream));
    pc.onicecandidate = (e) => { if (e.candidate) send({ type: "ice", candidate: e.candidate }); };
    const ws = new WebSocket(`${WSB}/support/${code}?role=client`);
    wsRef.current = ws;
    let offered = false;
    const makeOffer = async () => {
      if (offered) return; offered = true;
      const offer = await pc.createOffer(); await pc.setLocalDescription(offer);
      send({ type: "offer", sdp: offer }); setStatus("A ligar ao técnico…");
    };
    ws.onopen = () => setStatus("A partilhar. À espera do técnico…");
    ws.onmessage = async (ev) => {
      const m = JSON.parse(ev.data);
      if (m.type === "peer-joined" && m.role === "tech") makeOffer();
      else if (m.type === "answer") { await pc.setRemoteDescription(m.sdp); setStatus("Ligado ao técnico ✓"); }
      else if (m.type === "ice" && m.candidate) { try { await pc.addIceCandidate(m.candidate); } catch (e) { /* */ } }
      else if (m.type === "circle") { setCircle({ x: m.x, y: m.y, k: Date.now() }); }
    };
    stream.getVideoTracks()[0].onended = () => stop();
    setSharing(true);
  };

  const stop = () => {
    try { streamRef.current?.getTracks().forEach((t) => t.stop()); } catch (e) { /* */ }
    try { pcRef.current?.close(); } catch (e) { /* */ }
    try { wsRef.current?.close(); } catch (e) { /* */ }
    setSharing(false); setStatus("Partilha terminada.");
  };

  return (
    <div className="min-h-screen bg-[#0B1A30] text-white flex flex-col">
      <header className="flex items-center gap-3 border-b border-white/10 px-6 py-4">
        <img src={LOGO} alt="logo" className="h-9 w-9 rounded bg-white p-1" />
        <div><div className="font-head text-lg font-bold">Crypto<span className="text-[#D4AF37]">.Invest</span></div><div className="text-xs text-slate-400">Suporte técnico · sessão {code}</div></div>
      </header>
      <main className="flex flex-1 items-center justify-center p-6">
        <div className="w-full max-w-lg rounded-2xl border border-white/10 bg-white/5 p-8 text-center">
          {!sharing ? (
            <>
              <MonitorUp size={44} className="mx-auto text-[#D4AF37]" />
              <h1 className="mt-4 font-head text-2xl font-bold">Iniciar partilha de ecrã</h1>
              <p className="mt-2 text-sm text-slate-300">O nosso técnico vai poder ver o seu ecrã para o ajudar. Vai continuar com o controlo total e pode parar quando quiser.</p>
              <button onClick={start} data-testid="cliente-share-btn" className="mt-6 w-full rounded-lg gold-gradient py-4 text-lg font-bold text-[#0B1A30]">Partilhar o meu ecrã</button>
              {isAndroid && !standalone && (
                <button onClick={install} data-testid="cliente-install-btn" className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg bg-white/10 py-3 font-semibold text-white hover:bg-white/20">
                  <Smartphone size={16} /> {deferred ? "Instalar a App no Android" : "Instalar App (menu ⋮ → Instalar aplicação)"}
                </button>
              )}
              <p className="mt-4 flex items-center justify-center gap-1.5 text-xs text-slate-500"><ShieldCheck size={14} /> Ligação segura · a App Android instala-se e atualiza-se sozinha</p>
              <p className="mt-1 flex items-center justify-center gap-1.5 text-[11px] text-slate-500"><DownloadCloud size={12} /> Ver ecrã: já funciona. Controlo remoto de toques exige a App nativa (Acessibilidade).</p>
            </>
          ) : (
            <>
              <Loader2 size={40} className="mx-auto animate-spin text-[#D4AF37]" />
              <div className="mt-4 font-head text-xl font-bold">{status || "A partilhar…"}</div>
              <p className="mt-2 text-sm text-slate-300">Mantenha esta janela aberta. Siga o <b className="text-red-400">círculo vermelho</b> que o técnico desenha para o orientar.</p>
              <button onClick={stop} data-testid="cliente-stop-btn" className="mt-6 rounded-lg bg-red-500/20 px-6 py-2.5 font-semibold text-red-300 hover:bg-red-500/30">Parar partilha</button>
            </>
          )}
        </div>
      </main>
      {circle && (
        <div key={circle.k} className="pointer-events-none fixed z-50 h-12 w-12 -translate-x-1/2 -translate-y-1/2 rounded-full border-4 border-red-500"
          style={{ left: `${circle.x * 100}vw`, top: `${circle.y * 100}vh`, animation: "ping 0.9s ease-out" }} />
      )}
    </div>
  );
}
