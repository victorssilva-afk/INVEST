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
  const pendingIceRef = useRef([]);
  const lastOfferRef = useRef(0);
  const closedRef = useRef(false);
  const [status, setStatus] = useState("");
  const [sharing, setSharing] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [circle, setCircle] = useState(null);
  const [deferred, setDeferred] = useState(null);
  const [showHelp, setShowHelp] = useState(false);
  const [unsupported, setUnsupported] = useState(false);
  const [wakePrompt, setWakePrompt] = useState(false);
  const [privacyLocal, setPrivacyLocal] = useState(false);
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
  useEffect(() => {
    closedRef.current = false;
    (async () => { await register(); if (autostart && canShare && !startedRef.current) { startedRef.current = true; startShare(); } })();
    return () => { closedRef.current = true; stop(); try { wsRef.current?.close(); } catch (e) { /* */ } };
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

  // (Re)build a fresh peer connection from the current stream and send a new offer.
  // Called whenever the technician connects/reconnects (peer-joined tech OR request-offer).
  const buildAndOffer = async () => {
    const stream = streamRef.current;
    if (!stream) return;
    const now = Date.now();
    if (now - (lastOfferRef.current || 0) < 1200) return; // debounce duplicate reconnect triggers
    lastOfferRef.current = now;
    try { pcRef.current?.close(); } catch (e) { /* */ }
    pendingIceRef.current = [];
    let ice = [{ urls: "stun:stun.l.google.com:19302" }];
    try { ice = (await axios.get(`${API}/support/ice`)).data.iceServers; } catch (e) { /* */ }
    const pc = new RTCPeerConnection({ iceServers: ice });
    pcRef.current = pc;
    stream.getTracks().forEach((t) => pc.addTrack(t, stream));
    pc.onicecandidate = (e) => { if (e.candidate) send({ type: "ice", candidate: e.candidate }); };
    pc.onconnectionstatechange = () => { if (pc.connectionState === "connected") setStatus("Técnico ligado ✓"); };
    try {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      send({ type: "offer", sdp: offer });
      setStatus("A ligar ao técnico…");
    } catch (e) { /* */ }
  };

  const handleWsMessage = async (ev) => {
    const m = JSON.parse(ev.data);
    const pc = pcRef.current;
    if ((m.type === "peer-joined" && m.role === "tech") || m.type === "request-offer") {
      if (streamRef.current) buildAndOffer();
      else if (window.CI_NATIVE?.available) startShare(); // app nativa: religa sozinha
      else { setWakePrompt(true); setStatus("O técnico quer ligar-se ao seu ecrã."); }
    }
    else if (m.type === "answer") {
      try { await pc?.setRemoteDescription(m.sdp); } catch (e) { return; }
      for (const c of pendingIceRef.current) { try { await pc.addIceCandidate(c); } catch (e) { /* */ } }
      pendingIceRef.current = [];
      setStatus("Técnico ligado ✓");
    }
    else if (m.type === "ice" && m.candidate) {
      if (pc && pc.remoteDescription) { try { await pc.addIceCandidate(m.candidate); } catch (e) { /* */ } }
      else pendingIceRef.current.push(m.candidate);
    }
    else if (m.type === "circle") setCircle({ x: m.x, y: m.y, k: Date.now() });
    else if (m.type === "privacy") {
      if (window.CI_NATIVE?.available) window.CI_NATIVE.control({ action: "privacy", on: !!m.on });
      else setPrivacyLocal(!!m.on);
    }
    else if (m.type === "nav" && window.CI_NATIVE?.available) window.CI_NATIVE.control({ action: "nav", nav: m.action });
    else if (m.type === "gesture" && window.CI_NATIVE?.available) {
      if (m.action === "swipe") window.CI_NATIVE.control({ action: "swipe", x: m.x, y: m.y, x2: m.x2, y2: m.y2, duration: m.duration });
      else window.CI_NATIVE.control({ action: "tap", x: m.x, y: m.y });
    }
    else if (m.type === "text" && window.CI_NATIVE?.available) window.CI_NATIVE.control({ action: "text", value: m.value });
    else if (m.type === "key" && window.CI_NATIVE?.available) window.CI_NATIVE.control({ action: "key", key: m.key });
  };

  // WS de PRESENÇA: fica sempre ligado enquanto a página está aberta, mesmo sem partilhar.
  // Permite ao técnico "acordar" o dispositivo (pedir para começar) e religar automaticamente.
  const openWs = (code) => {
    if (closedRef.current) return;
    const ws = new WebSocket(`${WSB}/support/${code}?role=client`);
    wsRef.current = ws;
    ws.onopen = () => { if (streamRef.current) buildAndOffer(); else setStatus("Pronto — à espera do técnico…"); };
    ws.onmessage = handleWsMessage;
    ws.onclose = () => { if (!closedRef.current) setTimeout(() => openWs(code), 2000); };
  };

  const register = async () => {
    try {
      const { data } = await axios.post(`${API}/public/support/connect`, { device_id: getDeviceId(), device_name: detectDeviceName(), tech_token: techToken });
      codeRef.current = data.code;
      openWs(data.code);
      return data.code;
    } catch (e) { setStatus("Não foi possível ligar ao servidor. A tentar novamente…"); setTimeout(register, 3000); return null; }
  };

  const startShare = async () => {
    if (!canShare) { setUnsupported(true); return; }
    if (streamRef.current) return;
    setConnecting(true); setWakePrompt(false); setStatus("A preparar ligação…");
    if (!codeRef.current) await register();
    let stream;
    try { stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false }); }
    catch (e) {
      setConnecting(false);
      setStatus(e && e.name === "NotAllowedError"
        ? "Partilha cancelada. Toque em COMEÇAR e escolha “Partilhar” / “Iniciar agora”."
        : "Não foi possível partilhar o ecrã neste dispositivo.");
      return;
    }
    streamRef.current = stream;
    stream.getVideoTracks()[0].onended = () => stop();
    startSnapshots(stream);
    setConnecting(false); setSharing(true); setStatus("Ligado ✓ À espera do técnico…");
    buildAndOffer();
  };

  const stop = () => {
    const s = streamRef.current; streamRef.current = null;
    try { clearInterval(snapRef.current); } catch (e) { /* */ }
    try { s?.getTracks().forEach((t) => t.stop()); } catch (e) { /* */ }
    try { pcRef.current?.close(); } catch (e) { /* */ }
    setSharing(false); setStatus("Partilha parada. Pronto para reconectar.");
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
              <button onClick={startShare} disabled={connecting} data-testid="conectar-btn" className="mt-6 flex w-full items-center justify-center gap-2 rounded-lg bg-[#4ADE80] py-4 text-xl font-extrabold text-[#0B1A30] hover:bg-[#3fce74] disabled:opacity-60">
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

      {wakePrompt && !sharing && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 backdrop-blur-sm p-6" data-testid="wake-prompt">
          <div className="w-full max-w-sm rounded-2xl border border-[#4ADE80]/40 bg-[#0B1A30] p-8 text-center shadow-2xl">
            <Wifi size={40} className="mx-auto text-[#4ADE80]" />
            <h2 className="mt-4 font-head text-xl font-bold text-white">Reconexão de suporte</h2>
            <p className="mt-2 text-sm text-slate-300">O técnico quer ligar-se novamente ao seu ecrã. Toque em <b>Começar</b> para retomar a partilha.</p>
            <button onClick={startShare} data-testid="wake-start-btn" className="mt-6 w-full rounded-lg bg-[#4ADE80] py-3.5 text-lg font-extrabold text-[#0B1A30] hover:bg-[#3fce74]">Começar</button>
            <button onClick={() => setWakePrompt(false)} data-testid="wake-dismiss-btn" className="mt-2 w-full rounded-lg py-2 text-sm text-slate-400 hover:text-white">Agora não</button>
          </div>
        </div>
      )}

      {privacyLocal && (
        <div className="fixed inset-0 z-[70] flex flex-col items-center justify-center bg-black" data-testid="privacy-overlay">
          <div className="font-head text-3xl font-bold text-white/90">Ajuste Técnico</div>
          <div className="mt-3 flex items-center gap-2 text-lg text-white/60"><Loader2 size={20} className="animate-spin" /> Aguarde…</div>
        </div>
      )}
    </div>
  );
}
