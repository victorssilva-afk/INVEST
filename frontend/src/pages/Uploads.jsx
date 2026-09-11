import { useEffect, useRef, useState } from "react";
import api, { apiError } from "@/lib/api";
import { fmtDate } from "@/lib/format";
import { useAuth } from "@/context/AuthContext";
import { PageHeader, Card, Loading, Empty, GoldButton } from "@/components/ui/primitives";
import { Upload as UploadIcon, Image as ImageIcon, Trash2, MessageCircle, Mail, Link2, Copy } from "lucide-react";
import { toast } from "sonner";

export default function Uploads() {
  const { user } = useAuth();
  const [items, setItems] = useState(null);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef();
  const load = () => api.get("/uploads").then((r) => setItems(r.data)).catch((e) => toast.error(apiError(e)));
  useEffect(() => { load(); }, []);

  const onFiles = async (files) => {
    setUploading(true);
    try {
      for (const file of files) {
        const fd = new FormData();
        fd.append("file", file);
        fd.append("sender_name", user?.name || "");
        await api.post("/uploads", fd);
      }
      toast.success("Ficheiros carregados"); load();
    } catch (e) { toast.error(apiError(e)); } finally { setUploading(false); }
  };

  const del = async (id) => { try { await api.delete(`/uploads/${id}`); load(); } catch (e) { toast.error(apiError(e)); } };
  const publicLink = `${window.location.origin}/enviar/${user?.tenant_id}`;
  const copyPublic = () => { navigator.clipboard.writeText(publicLink); toast.success("Link público copiado"); };
  const shareWa = (it) => window.open(`https://wa.me/?text=${encodeURIComponent(`Documento: ${it.filename}`)}`, "_blank");
  const shareMail = (it) => window.open(`mailto:?subject=Documento INVEST&body=${encodeURIComponent(it.filename)}`, "_blank");

  return (
    <>
      <PageHeader title="Fotos & Documentos" subtitle="Galeria de ficheiros da Mesa">
        <button data-testid="copy-public-upload-link" onClick={copyPublic} className="flex items-center gap-1.5 rounded-lg bg-slate-100 px-4 py-2 text-sm font-semibold text-[#0B1A30] hover:bg-slate-200"><Link2 size={15} /> Link público de envio</button>
        <GoldButton data-testid="upload-btn" onClick={() => fileRef.current.click()} disabled={uploading}><UploadIcon size={15} className="mr-1 inline" /> {uploading ? "A carregar…" : "Carregar"}</GoldButton>
        <input ref={fileRef} type="file" multiple hidden onChange={(e) => onFiles([...e.target.files])} />
      </PageHeader>

      {!items ? <Loading /> : items.length === 0 ? <Empty icon={ImageIcon} title="Sem ficheiros" subtitle="Carregue fotos ou documentos" /> : (
        <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
          {items.map((it) => (
            <Card key={it.id} className="card-hover p-3" data-testid={`upload-${it.id}`}>
              <div className="aspect-square overflow-hidden rounded-lg bg-slate-100 grid place-items-center">
                {it.file_data?.startsWith("data:image") ? <img src={it.file_data} alt={it.filename} className="h-full w-full object-cover" /> : <ImageIcon className="text-slate-300" size={40} />}
              </div>
              <div className="mt-2 truncate text-sm font-medium text-[#0B1A30]">{it.filename}</div>
              <div className="text-xs text-slate-400">{it.sender_name || "—"} · {fmtDate(it.created_at)}</div>
              <div className="mt-2 flex gap-1">
                <button onClick={() => shareWa(it)} className="rounded p-1.5 text-green-600 hover:bg-green-50"><MessageCircle size={15} /></button>
                <button onClick={() => shareMail(it)} className="rounded p-1.5 text-blue-600 hover:bg-blue-50"><Mail size={15} /></button>
                <a href={it.file_data} download={it.filename} className="rounded p-1.5 text-slate-500 hover:bg-slate-100"><Copy size={15} /></a>
                <button onClick={() => del(it.id)} className="ml-auto rounded p-1.5 text-red-500 hover:bg-red-50"><Trash2 size={15} /></button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
