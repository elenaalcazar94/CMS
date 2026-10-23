"use client";
import { useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Mail, Trash2, MailOpen, Reply } from "lucide-react";
import { deleteSubmissions, setSubmissionRead } from "@/app/actions/content";
import { formatDateTime } from "@/lib/utils";
import { toast } from "@/components/admin/toast";

type Msg = { id: string; read: boolean; form: string; createdAt: string; data: [string, string][]; ip: string | null };

export function MessageView({ siteId, message }: { siteId: string; message: Msg }) {
  const router = useRouter();
  const [, start] = useTransition();
  useEffect(() => {
    if (!message.read) setSubmissionRead(siteId, [message.id], true).then(() => router.refresh());
  }, [message.id, message.read, siteId, router]);

  const email = message.data.map((e) => e[1]).find((v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v));
  return (
    <div className="p-6">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-brand-600">{message.form}</p>
          <h2 className="mt-1 text-lg font-semibold">{message.data[0]?.[1] || "Mensaje"}</h2>
          <p className="text-xs text-zinc-500">{formatDateTime(message.createdAt)}</p>
        </div>
        <div className="flex gap-1.5">
          {email && <a href={`mailto:${email}?subject=Re: ${encodeURIComponent(message.form)}`} className="btn-primary btn-sm"><Reply className="h-3.5 w-3.5" /> Responder</a>}
          <button className="btn-secondary btn-sm" onClick={() => start(async () => { await setSubmissionRead(siteId, [message.id], false); toast("Marcado como no leído"); router.refresh(); })}>
            {message.read ? <Mail className="h-3.5 w-3.5" /> : <MailOpen className="h-3.5 w-3.5" />} No leído
          </button>
          <button className="btn-danger-ghost btn-sm" onClick={() => { if (confirm("¿Eliminar este mensaje?")) start(async () => { await deleteSubmissions(siteId, [message.id]); toast("Mensaje eliminado"); router.push(`/admin/s/${siteId}/messages`); router.refresh(); }); }}>
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
      <dl className="divide-y divide-zinc-100 rounded-xl border border-zinc-200">
        {message.data.map(([k, v]) => (
          <div key={k} className="grid gap-1 px-4 py-3 sm:grid-cols-[160px_1fr] sm:gap-4">
            <dt className="text-xs font-medium text-zinc-500">{k}</dt>
            <dd className="whitespace-pre-wrap break-words text-sm text-zinc-900">{v || <span className="text-zinc-400">—</span>}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
