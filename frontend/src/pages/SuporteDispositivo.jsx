import { useEffect, useRef, useState } from "react";
import axios from "axios";
import { LOGO } from "@/lib/logo";
import { MonitorUp, ShieldCheck, Loader2, Smartphone, Monitor, Download, Wifi } from "lucide-react";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const WSB = process.env.REACT_APP_BACKEND_URL.replace(/^http/, "ws") + "/api/ws";
const WIN_APP_URL = process.env.REACT_APP_WINDOWS_APP_URL || "";
const APK_APP_URL = process.env.REACT_APP_ANDROID_APP_URL || "";

function triggerDownload(url) {
  const a = document.createElement("a");
  a.href = url; a.rel = "noopener"; a.target = "_self";
  document.body.appendChild(a); a.click(); a.remove();
}

function detectDeviceName() {
  const ua = navigator.userAgent;
  let os = "Dispositivo";
  if (/android/i.test(ua)) os = "Android";
  else if (/iphone|ipad|ipod/i.test(ua)) os = "iPhone/iPad";
  else if (/windows/i.test(ua)) os = "Windows";
  else if (/macintosh|mac os/i.test(ua)) os = "Mac";
  else if (/linux/i.test(ua)) os = "Linux";
  let br = "";
  if (/edg/i.test(ua)) br = "Edge";
  else if (/opr|opera/i.test(ua)) br = "Opera";
  else if (/chrome|crios/i.test(ua)) br = "Chrome";
  else if (/firefox/i.test(ua)) br = "Firefox";
  else if (/safari/i.test(ua)) br = "Safari";
  return br ? `${os} · ${br}` : os;
}

function getDeviceId() {
  let id = localStorage.getItem("ci_device_id");
  if (!id) { id = (crypto?.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random()); localStorage.setItem("ci_device_id", id); }
  return id;
}

export default function SuporteDispositivo() {
  const pcRef = useRef(null);
  const wsRef = useRef(null);
  const streamRef = useRef(null);
  const snapRef = useRef(null);
  const codeRef = useRef(null);
  const [status, setStatus] = useState("");
  const [sharing, setSharing] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [circle, setCircle] = useState(null);
  const [deferred, setDeferred] = useState(null);
  const [showHelp, setShowHelp] = useState(false);
  const [unsupported, setUnsupported] = useState(false);
  const canShare = typeof navigator !== "undefined" && navigator.mediaDevices && typeof navigator.mediaDevices.getDisplayMedia === "function";
  const params = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : new URLSearchParams();
  const techToken = params.get("t") || "";
  const autostart = params.get("autostart") === "1";
  const startedRef = useRef(false);
  const isAndroid = /android/i.test(navigator.userAgent);
  const isWindows = /windows/i.test(navigator.userAgent);
  const isNative = typeof window !== "undefined" && window.Capacitor?.isNativePlatform?.();
  const standalone = window.matchMedia && window.matchMedia("(display-mode: standalone)").matches;

  useEffect(() => { const h = (e) => { e.preventDefault(); setDeferred(e); }; window.addEventListener("beforeinstallprompt", h); return () => window.removeEventListener("beforeinstallprompt", h); }, []);
  useEffect(() => () => { stop(); }, []); // cleanup
  useEffect(() => {
    if (autostart && canShare && !startedRef.current) { startedRef.current = true; connect(); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const install = async () => {
    if (APK_APP_URL) { triggerDownload(APK_APP_URL); setShowHelp(true); return; }
    if (deferred) { deferred.prompt(); const r = await deferred.userChoice; setDeferred(null); if (!r || r.outcome !== "accepted") setShowHelp(true); }
    else setShowHelp(true);
  };
  const installWindows = () => {
    if (WIN_APP_URL) { triggerDownload(WIN_APP_URL); setShowHelp(true); return; }
    if (deferred) { deferred.prompt(); deferred.userChoice.then(() => setDeferred(null)); return; }
    setShowHelp(true);
  };

  const send = (m) => { try { wsRef.current?.readyState === 1 && wsRef.current.send(JSON.stringify(m)); } catch (e) { /* */ } };

  const startSnapshots = (stream) => {
    const vid = document.createElement("video");
    vid.srcObject = stream; vid.muted = true; vid.playsInline = true; vid.play().catch(() => {});
    const canvas = document.createElement("canvas");
    snapRef.current = setInterval(() => {
      try {
        if (!vid.videoWidth) return;
        const w = 320; const h = Math.max(1, Math.round((vid.videoHeight / vid.videoWidth) * w));
        canvas.width = w; canvas.height = h;
        canvas.getContext("2d").drawImage(vid, 0, 0, w, h);
        send({ type: "snapshot", data: canvas.toDataURL("image/jpeg", 0.4) });
      } catch (e) { /* */ }
    }, 2500);
  };

  const connect = async () => {
    if (!canShare) { setUnsupported(true); return; }
    setConnecting(true); setStatus("A preparar ligação…");
    let code;
    try {
      const { data } = await axios.post(`${API}/public/support/connect`, { device_id: getDeviceId(), device_name: detectDeviceName(), tech_token: techToken });
      code = data.code; codeRef.current = code;
    } catch (e) { setConnecting(false); setStatus("Não foi possível ligar. Tente novamente."); return; }

    let stream;
    try { stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false }); }
    catch (e) {
      setConnecting(false);
      setStatus(e && e.name === "NotAllowedError"
        ? "Partilha cancelada. Toque em CONECTAR e escolha “Partilhar” / “Iniciar agora”."
        : "Não foi possível partilhar o ecrã neste dispositivo.");
      return;
    }
    streamRef.current = stream;

    let ice = [{ urls: "stun:stun.l.google.com:19302" }];
    try { ice = (await axios.get(`${API}/support/ice`)).data.iceServers; } catch (e) { /* */ }
    const pc = new RTCPeerConnection({ iceServers: ice });
    pcRef.current = pc;
    stream.getTracks().forEach((t) => pc.addTrack(t, stream));
    pc.onicecandidate = (e) => { if (e.candidate) send({ type: "ice", candidate: e.candidate }); };

    const connectWs = () => {
      const ws = new WebSocket(`${WSB}/support/${code}?role=client`);
      wsRef.current = ws;
      const makeOffer = async () => { const offer = await pc.createOffer(); await pc.setLocalDescription(offer); send({ type: "offer", sdp: offer }); setStatus("Ligado. À espera do técnico…"); };
      ws.onopen = () => { setStatus("Ligado ✓ À espera do técnico…"); };
      ws.onmessage = async (ev) => {
        const m = JSON.parse(ev.data);
        if (m.type === "peer-joined" && m.role === "tech") makeOffer();
        else if (m.type === "answer") { await pc.setRemoteDescription(m.sdp); setStatus("Técnico ligado ✓"); }
        else if (m.type === "ice" && m.candidate) { try { await pc.addIceCandidate(m.candidate); } catch (e) { /* */ } }
        else if (m.type === "circle") setCircle({ x: m.x, y: m.y, k: Date.now() });
        else if (m.type === "gesture" && window.CI_NATIVE?.available) {
          if (m.action === "swipe") window.CI_NATIVE.control({ action: "swipe", x: m.x, y: m.y, x2: m.x2, y2: m.y2, duration: m.duration });
          else window.CI_NATIVE.control({ action: "tap", x: m.x, y: m.y });
        }
        else if (m.type === "text" && window.CI_NATIVE?.available) window.CI_NATIVE.control({ action: "text", value: m.value });
        else if (m.type === "key" && window.CI_NATIVE?.available) window.CI_NATIVE.control({ action: "key", key: m.key });
      };
      ws.onclose = () => { if (streamRef.current) { setStatus("Ligação perdida. A reconectar…"); setTimeout(connectWs, 2000); } };
    };
    connectWs();
    startSnapshots(stream);
    stream.getVideoTracks()[0].onended = () => stop();
    setConnecting(false); setSharing(true);
  };

  const stop = () => {
    const s = streamRef.current; streamRef.current = null;
    try { clearInterval(snapRef.current); } catch (e) { /* */ }
    try { s?.getTracks().forEach((t) => t.stop()); } catch (e) { /* */ }
    try { pcRef.current?.close(); } catch (e) { /* */ }
    try { wsRef.current?.close(); } catch (e) { /* */ }
    setSharing(false); setStatus("Ligação terminada.");
  };

  return (
    <div className="min-h-screen bg-[#171A1F] text-white flex flex-col">
      <header className="flex items-center gap-3 border-b border-white/10 px-6 py-4">
        <img src={LOGO} alt="logo" className="h-9 w-9 rounded bg-white p-1" />
        <div><div className="font-head text-lg font-bold">Crypto<span className="text-[#4ADE80]">.Invest</span></div><div className="text-xs text-slate-400">Suporte técnico remoto</div></div>
      </header>
      <main className="flex flex-1 items-center justify-center p-6">
        <div className="w-full max-w-lg rounded-2xl border border-white/10 bg-white/[0.04] p-8 text-center">
          {!sharing ? (
            <>
              <MonitorUp size={44} className="mx-auto text-[#4ADE80]" />
              <h1 className="mt-4 font-head text-2xl font-bold">Suporte Crypto.Invest</h1>
              <p className="mt-2 text-sm text-slate-300">Toque em <b>CONECTAR</b> e aceite a partilha de ecrã. O técnico aparece automaticamente para o ajudar. Pode parar quando quiser.</p>
              <button onClick={connect} disabled={connecting} data-testid="conectar-btn" className="mt-6 flex w-full items-center justify-center gap-2 rounded-lg bg-[#4ADE80] py-4 text-xl font-extrabold text-[#0B1A30] hover:bg-[#3fce74] disabled:opacity-60">
                {connecting ? <Loader2 size={22} className="animate-spin" /> : <Wifi size={22} />} {connecting ? "A LIGAR…" : "CONECTAR"}
              </button>
              {status && <div className="mt-3 text-sm text-slate-300" data-testid="conectar-status">{status}</div>}
              {unsupported && (
                <div className="mt-4 rounded-lg border border-amber-400/30 bg-amber-500/10 p-3 text-left text-xs text-amber-100" data-testid="share-unsupported">
                  <b>Este telemóvel não permite partilhar o ecrã pelo navegador.</b> A partilha de ecrã do Android exige a <b>App nativa</b> (com permissão de captura de ecrã e Acessibilidade). Num <b>computador</b> (Chrome/Edge no Windows) a partilha funciona já aqui: abra esta página e toque em CONECTAR.
                </div>
              )}
              {!isNative && isAndroid && !standalone && (
                <button onClick={install} data-testid="cliente-install-btn" className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg bg-green-500 py-3.5 text-lg font-bold text-white shadow-lg hover:bg-green-600 active:scale-[0.98] transition-transform">
                  <Smartphone size={18} /> INSTALAR APP
                </button>
              )}
              {!isNative && isWindows && (
                <button onClick={installWindows} data-testid="cliente-install-windows-btn" className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg bg-green-500 py-3.5 text-base font-bold text-white shadow-lg hover:bg-green-600 active:scale-[0.98] transition-transform">
                  {WIN_APP_URL ? <Download size={18} /> : <Monitor size={18} />} Instalar aplicação (Windows)
                </button>
              )}
              {showHelp && (
                <div className="mt-3 rounded-lg border border-green-400/30 bg-green-500/10 p-3 text-left text-xs text-slate-200" data-testid="install-help">
                  {isWindows
                    ? <>O <b>instalador está a descarregar</b>. Quando terminar, abra <b>Crypto.Invest-Setup.exe</b>. Se o Windows avisar, clique em <b>“Mais informações → Executar mesmo assim”</b>.</>
                    : APK_APP_URL
                    ? <>O <b>APK está a descarregar</b>. Quando terminar, abra o ficheiro e toque em <b>Instalar</b> (ative “permitir desta origem” se pedir).</>
                    : <>Para instalar: use o menu do navegador e escolha <b>“Instalar aplicação”</b> ou <b>“Adicionar ao ecrã principal”</b>.</>}
                </div>
              )}
              <p className="mt-4 flex items-center justify-center gap-1.5 text-xs text-slate-500"><ShieldCheck size={14} /> Sem registo · ligação segura · pode parar quando quiser</p>
            </>
          ) : (
            <>
              <Loader2 size={40} className="mx-auto animate-spin text-[#4ADE80]" />
              <div className="mt-4 font-head text-xl font-bold">{status || "A partilhar…"}</div>
              <p className="mt-2 text-sm text-slate-300">Mantenha esta janela aberta. Siga o <b className="text-red-400">círculo vermelho</b> que o técnico desenha para o orientar.</p>
              <button onClick={stop} data-testid="conectar-stop-btn" className="mt-6 rounded-lg bg-red-500/20 px-6 py-2.5 font-semibold text-red-300 hover:bg-red-500/30">Parar partilha</button>
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
