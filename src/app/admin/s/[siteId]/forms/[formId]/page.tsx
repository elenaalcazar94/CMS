import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireSite } from "@/lib/auth";
import { parseFields } from "@/lib/forms";
import { resolveTheme } from "@/lib/themes";
import { mailEnabled } from "@/lib/mail";
import { PageHeader } from "@/components/admin/ui";
import { ConfirmButton } from "@/components/admin/client";
import { deleteForm } from "@/app/actions/content";
import { FormBuilder } from "@/components/admin/FormBuilder";

export const metadata = { title: "Editar formulario" };

export default async function FormEdit({ params }: { params: Promise<{ siteId: string; formId: string }> }) {
  const { siteId, formId } = await params;
  await requireSite(siteId, "forms");
  const [form, site] = await Promise.all([
    db.form.findFirst({ where: { id: formId, siteId }, include: { _count: { select: { submissions: true } } } }),
    db.site.findUniqueOrThrow({ where: { id: siteId } }),
  ]);
  if (!form) notFound();
  return (
    <>
      <PageHeader
        title={form.name}
        description={`${form._count.submissions} mensajes recibidos`}
        back={{ href: `/admin/s/${siteId}/forms`, label: "Formularios" }}
        actions={
          <>
            <a href={`/admin/s/${siteId}/messages?form=${form.id}`} className="btn-secondary">Ver mensajes</a>
            <ConfirmButton action={deleteForm.bind(null, siteId, form.id)} title="¿Eliminar formulario?" description="Se eliminarán también todos sus mensajes. Las páginas que lo usen mostrarán un hueco vacío." className="btn-danger-ghost">Eliminar</ConfirmButton>
          </>
        }
      />
      <FormBuilder
        siteId={siteId}
        form={{ id: form.id, slug: form.slug, name: form.name, fields: parseFields(form.fields), submitLabel: form.submitLabel, successMessage: form.successMessage, notifyEmails: form.notifyEmails }}
        theme={{ id: site.theme, settings: resolveTheme(site.theme, site.themeSettings) }}
        mailEnabled={mailEnabled()}
      />
    </>
  );
}
