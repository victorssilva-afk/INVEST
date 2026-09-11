import { useState } from "react";
import { useParams } from "react-router-dom";
import axios from "axios";
import { API } from "@/lib/api";
import { toast } from "sonner";
import { Upload, CheckCircle2, Image } from "lucide-react";

export default function EnviarPublico() {
  const { tenant } = useParams();
  const [uploading, setUploading] = useState(false);
  const [done, setDone] = useState(0);

  const send = async (files) => {
    if (!files?.length) return;
    setUploading(true);
    try {
      for (const file of files) {
        const fd = new FormData();
        fd.append("file", file);
        await axios.post(`${API}/public/upload/${tenant}`, fd);
        setDone((d) => d + 1);
      }
      toast.success("Enviado com sucesso");
    } catch { toast.error("Falha no envio. Tente novamente."); }
    finally { setUploading(false); }
  };

  return (
    <div className="min-h-screen navy-gradient flex flex-col items-center justify-center p-6 text-white">
      <div className="mb-8 text-center">
        <div className="font-head text-4xl font-extrabold">IN<span className="text-[#D4AF37]">VEST</span></div>
        <p className="mt-2 text-slate-400">Envio de fotos e documentos · Mesa {tenant}</p>
      </div>
      <div className="w-full max-w-md rounded-2xl bg-white/5 p-8 backdrop-blur-md border border-white/10">
        <label className="grid cursor-pointer place-items-center gap-3 rounded-xl border-2 border-dashed border-[#D4AF37]/50 py-14 text-center hover:bg-white/5 transition-colors" data-testid="public-upload-area">
          <Upload size={44} className="text-[#D4AF37]" />
          <span className="font-head text-lg font-semibold">Toque para escolher ficheiros</span>
          <span className="text-sm text-slate-400">Fotos ou documentos · envio direto</span>
          <input type="file" multiple hidden onChange={(e) => send([...e.target.files])} data-testid="public-file-input" />
        </label>
        {uploading && <div className="mt-4 text-center text-sm text-[#D4AF37]">A enviar…</div>}
        {done > 0 && !uploading && (
          <div className="mt-4 flex items-center justify-center gap-2 text-green-400" data-testid="public-upload-success">
            <CheckCircle2 size={18} /> {done} ficheiro(s) enviado(s) com sucesso
          </div>
        )}
      </div>
      <div className="mt-6 flex items-center gap-2 text-xs text-slate-500"><Image size={14} /> Os ficheiros são recebidos em segurança pela Mesa {tenant}</div>
    </div>
  );
}
