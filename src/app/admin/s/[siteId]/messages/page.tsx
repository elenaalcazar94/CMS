import Link from "next/link";
import { Inbox, Download } from "lucide-react";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { requireSite } from "@/lib/auth";
import { PageHeader, EmptyState } from "@/components/admin/ui";
import { cn, formatDateTime, timeAgo } from "@/lib/utils";
import { MessageView } from "./view";
import { submissionEntries } from "@/lib/forms";

export const metadata = { title: "Mensajes" };

export default async function Messages({ params, searchParams }: { params: Promise<{ siteId: string }>; searchParams: Promise<{ id?: string; form?: string; filter?: string }> }) {
  const { siteId } = await params;
  const { id, form: formFilter, filter } = await searchParams;
  await requireSite(siteId, "messages");
  const forms = await db.form.findMany({ where: { siteId }, select: { id: true, name: true, _count: { select: { submissions: { where: { read: false } } } } } });
  const where: Prisma.FormSubmissionWhereInput = { form: { siteId }, ...(formFilter ? { formId: formFilter } : {}), ...(filter === "unread" ? { read: false } : {}) };
  const list = await db.formSubmission.findMany({ where, orderBy: { createdAt: "desc" }, take: 100, include: { form: { select: { name: true } } } });
  const current = id ? await db.formSubmission.findFirst({ where: { id, form: { siteId } }, include: { form: { select: { name: true } } } }) : list[0] ?? null;
  const q = (p: Record<string, string | undefined>) => {
    const s = new URLSearchParams(Object.entries({ form: formFilter, filter, ...p }).filter(([, v]) => v) as [string, string][]);
    return `?${s}`;
  };

  return (
    <>
      <PageHeader
        title="Mensajes"
        description="Todo lo que te envían desde los formularios de la web."
        actions={formFilter && <a className="btn-secondary" href={`/api/admin/forms/${formFilter}/export`}><Download className="h-4 w-4" /> Exportar CSV</a>}
      />
      <div className="mb-4 flex flex-wrap gap-1.5">
        <Link href={q({ form: undefined, id: undefined })} className={cn("rounded-lg px-3 py-1.5 text-[13px] font-medium", !formFilter ? "bg-zinc-900 text-white" : "bg-white text-zinc-600 ring-1 ring-zinc-200 hover:bg-zinc-50")}>Todos los formularios</Link>
        {forms.map((f) => (
          <Link key={f.id} href={q({ form: f.id, id: undefined })} className={cn("rounded-lg px-3 py-1.5 text-[13px] font-medium", formFilter === f.id ? "bg-zinc-900 text-white" : "bg-white text-zinc-600 ring-1 ring-zinc-200 hover:bg-zinc-50")}>
            {f.name}{f._count.submissions > 0 && <span className="ml-1.5 rounded-full bg-brand-600 px-1.5 text-[10px] font-bold text-white">{f._count.submissions}</span>}
          </Link>
        ))}
        <Link href={q({ filter: filter === "unread" ? undefined : "unread", id: undefined })} className={cn("ml-auto rounded-lg px-3 py-1.5 text-[13px] font-medium", filter === "unread" ? "bg-brand-600 text-white" : "bg-white text-zinc-600 ring-1 ring-zinc-200 hover:bg-zinc-50")}>Solo no leídos</Link>
      </div>
      {list.length === 0 && !current ? (
        <div className="card"><EmptyState icon={<Inbox className="h-6 w-6" />} title="No hay mensajes" description="Cuando alguien rellene un formulario de la web, lo verás aquí y te avisaremos por email." /></div>
      ) : (
        <div className="card grid overflow-hidden md:grid-cols-[340px_1fr]">
          <ul className="scrollbar-thin max-h-[70vh] divide-y divide-zinc-100 overflow-y-auto border-b border-zinc-100 md:border-b-0 md:border-r">
            {list.map((m) => {
              const vals = submissionEntries(m.data).map((e) => e[1]);
              return (
                <li key={m.id}>
                  <Link href={q({ id: m.id })} scroll={false} className={cn("block px-4 py-3 transition", current?.id === m.id ? "bg-brand-50/70" : "hover:bg-zinc-50")}>
                    <div className="flex items-center justify-between gap-2">
                      <span className={cn("flex items-center gap-2 truncate text-sm", !m.read && "font-semibold")}>
                        {!m.read && <span className="h-2 w-2 shrink-0 rounded-full bg-brand-600" />}{vals[0] || "Sin nombre"}
                      </span>
                      <span className="shrink-0 text-[11px] text-zinc-400" title={formatDateTime(m.createdAt)}>{timeAgo(m.createdAt)}</span>
                    </div>
                    <p className="mt-0.5 truncate text-xs text-zinc-500">{m.form.name} · {vals.slice(1).filter((v) => v && v !== "Sí").join(" · ")}</p>
                  </Link>
                </li>
              );
            })}
          </ul>
          <div className="min-h-[300px]">
            {current ? (
              <MessageView siteId={siteId} message={{ id: current.id, read: current.read, form: current.form.name, createdAt: current.createdAt.toISOString(), data: submissionEntries(current.data), ip: current.ip }} />
            ) : <p className="p-10 text-center text-sm text-zinc-500">Selecciona un mensaje.</p>}
          </div>
        </div>
      )}
    </>
  );
}
