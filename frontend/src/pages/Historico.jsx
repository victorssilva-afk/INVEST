import { useEffect, useState } from "react";
import api, { apiError } from "@/lib/api";
import { fmtDate } from "@/lib/format";
import { PageHeader, Card, Loading, Empty } from "@/components/ui/primitives";
import { History as HistoryIcon } from "lucide-react";
import { toast } from "sonner";

export default function Historico() {
  const [items, setItems] = useState(null);
  useEffect(() => { api.get("/history").then((r) => setItems(r.data)).catch((e) => toast.error(apiError(e))); }, []);
  return (
    <>
      <PageHeader title="Histórico" subtitle="Registo de todas as ações relevantes da Mesa" />
      {!items ? <Loading /> : items.length === 0 ? <Empty icon={HistoryIcon} title="Sem registos" /> : (
        <Card className="p-0 overflow-hidden">
          <div className="divide-y divide-slate-100">
            {items.map((h) => (
              <div key={h.id} className="flex items-center gap-4 px-5 py-3 text-sm" data-testid={`history-${h.id}`}>
                <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#0B1A30] text-[#D4AF37]"><HistoryIcon size={16} /></div>
                <div className="flex-1"><span className="font-semibold text-[#0B1A30]">{h.user}</span> <span className="text-slate-600">{h.action}</span> <span className="text-slate-400">{h.entity}</span> <span className="font-mono text-xs text-slate-500">{h.entity_id}</span></div>
                <div className="text-xs text-slate-400">{fmtDate(h.at, true)}</div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </>
  );
}
