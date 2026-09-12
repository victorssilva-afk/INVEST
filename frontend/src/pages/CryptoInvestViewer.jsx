import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import axios from "axios";
import { useAuth } from "@/context/AuthContext";
import { ArrowLeft, MousePointerClick, Circle } from "lucide-react";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const WSB = process.env.REACT_APP_BACKEND_URL.replace(/^http/, "ws") + "/api/ws";

export default function CryptoInvestViewer() {
  const { code } = useParams();
  const { user, loading } = useAuth();
  const nav = useNavigate();
  const videoRef = useRef(null);
  const pcRef = useRef(null);
  const wsRef = useRef(null);
  const [status, setStatus] = useState("A ligar…");

  useEffect(() => { if (!loading && !user) nav("/crypto-invest"); }, [loading, user, nav]);

  useEffect(() => {
    let closed = false;
    const send = (m) => { try { wsRef.current?.readyState === 1 && wsRef.current.send(JSON.stringify(m)); } catch (e) { /* */ } };
    (async () => {
      let ice = [{ urls: "stun:stun.l.google.com:19302" }];
      try { ice = (await axios.get(`${API}/support/ice`)).data.iceServers; } catch (e) { /* */ }
      const pc = new RTCPeerConnection({ iceServers: ice });
      pcRef.current = pc;
      pc.ontrack = (e) => { if (videoRef.current) { videoRef.current.srcObject = e.streams[0]; setStatus("Ligado — a ver o ecrã do cliente"); } };
      pc.onicecandidate = (e) => { if (e.candidate) send({ type: "ice", candidate: e.candidate }); };
      pc.onconnectionstatechange = () => { if (["disconnected", "failed"].includes(pc.connectionState)) setStatus("Ligação perdida"); };
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
        else if (m.type === "peer-left") setStatus("O cliente saiu");
      };
      ws.onclose = () => { if (!closed) setStatus("Ligação terminada"); };
    })();
    return () => { closed = true; try { wsRef.current?.close(); } catch (e) { /* */ } try { pcRef.current?.close(); } catch (e) { /* */ } };
  }, [code]);

  const sendCircle = (e) => {
    const r = videoRef.current.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
    try { wsRef.current?.readyState === 1 && wsRef.current.send(JSON.stringify({ type: "circle", x, y })); } catch (er) { /* */ }
  };

  return (
    <div className="min-h-screen bg-[#0B1A30] text-white">
      <header className="flex items-center justify-between border-b border-white/10 px-6 py-3">
        <button onClick={() => nav("/crypto-invest/painel")} className="flex items-center gap-1.5 text-sm text-slate-300 hover:text-white"><ArrowLeft size={16} /> Painel</button>
        <div className="font-head font-bold">Crypto<span className="text-[#D4AF37]">.Invest</span> · Sessão {code}</div>
        <span className="flex items-center gap-1.5 text-xs text-slate-400"><Circle size={10} className="text-red-500" /> {status}</span>
      </header>
      <main className="mx-auto max-w-6xl p-4">
        <div className="mb-2 flex items-center gap-2 text-xs text-slate-400"><MousePointerClick size={14} /> Mova o rato sobre o ecrã para desenhar o círculo vermelho no ecrã do cliente.</div>
        <div className="overflow-hidden rounded-xl border border-white/10 bg-black">
          <video ref={videoRef} autoPlay playsInline muted onMouseMove={sendCircle} onClick={sendCircle} className="h-[70vh] w-full cursor-crosshair bg-black object-contain" data-testid="ci-remote-video" />
        </div>
      </main>
    </div>
  );
}
