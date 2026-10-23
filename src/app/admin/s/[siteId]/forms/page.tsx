import Link from "next/link";
import { ClipboardList, Inbox, ArrowRight } from "lucide-react";
import { db } from "@/lib/db";
import { requireSite } from "@/lib/auth";
import { PageHeader, EmptyState } from "@/components/admin/ui";
import { parseFields } from "@/lib/forms";
import { createForm } from "@/app/actions/content";
import { NewFormButton } from "./new";

export const metadata = { title: "Formularios" };

export default async function FormsPage({ params }: { params: Promise<{ siteId: string }> }) {
  const { siteId } = await params;
  await requireSite(siteId, "forms");
  const forms = await db.form.findMany({
    where: { siteId },
    orderBy: { createdAt: "asc" },
    include: { _count: { select: { submissions: true } } },
  });
  const unread = await db.formSubmission.groupBy({ by: ["formId"], where: { read: false, form: { siteId } }, _count: true });
  const create = createForm.bind(null, siteId);
  return (
    <>
      <PageHeader title="Formularios" description="Crea formularios de contacto, presupuesto o reservas e insértalos en cualquier página con el bloque «Formulario»." actions={<NewFormButton action={create} />} />
      {forms.length === 0 ? (
        <div className="card"><EmptyState icon={<ClipboardList className="h-6 w-6" />} title="Aún no hay formularios" description="Empieza con un formulario de contacto: ya viene con los campos más habituales." action={<NewFormButton action={create} />} /></div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {forms.map((f) => {
            const n = unread.find((u) => u.formId === f.id)?._count ?? 0;
            return (
              <Link key={f.id} href={`/admin/s/${siteId}/forms/${f.id}`} className="card group p-5 transition hover:-translate-y-0.5 hover:shadow-pop">
                <div className="flex items-start justify-between">
                  <span className="grid h-10 w-10 place-items-center rounded-xl bg-brand-50 text-brand-600"><ClipboardList className="h-5 w-5" /></span>
                  <ArrowRight className="h-4 w-4 text-zinc-300 transition group-hover:translate-x-0.5 group-hover:text-brand-600" />
                </div>
                <h3 className="mt-4 font-semibold">{f.name}</h3>
                <p className="mt-0.5 text-xs text-zinc-500">{parseFields(f.fields).length} campos{f.notifyEmails ? ` · avisos a ${f.notifyEmails}` : " · sin avisos por email"}</p>
                <div className="mt-4 flex items-center gap-1.5 border-t border-zinc-100 pt-3 text-xs text-zinc-600">
                  <Inbox className="h-3.5 w-3.5" /> {f._count.submissions} mensajes
                  {n > 0 && <span className="badge-brand ml-auto">{n} sin leer</span>}
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </>
  );
}
