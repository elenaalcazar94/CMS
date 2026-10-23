import { Tags, Hash } from "lucide-react";
import { db } from "@/lib/db";
import { requireSite } from "@/lib/auth";
import { Card, PageHeader, EmptyState } from "@/components/admin/ui";
import { ActionForm, ConfirmButton, Submit } from "@/components/admin/client";
import { deleteCategory, deleteTag, saveCategory } from "@/app/actions/content";
import { EditCategory } from "./edit";

export const metadata = { title: "Categorías y etiquetas" };

export default async function Taxonomies({ params }: { params: Promise<{ siteId: string }> }) {
  const { siteId } = await params;
  await requireSite(siteId, "posts");
  const [categories, tags] = await Promise.all([
    db.category.findMany({ where: { siteId }, orderBy: { name: "asc" }, include: { _count: { select: { posts: true } } } }),
    db.tag.findMany({ where: { siteId }, orderBy: { name: "asc" }, include: { _count: { select: { posts: true } } } }),
  ]);
  const save = saveCategory.bind(null, siteId);
  return (
    <>
      <PageHeader title="Categorías y etiquetas" description="Organiza las entradas del blog para que sean fáciles de encontrar." />
      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <div className="space-y-6">
          <Card title="Categorías" description="Agrupaciones principales del blog. Cada una tiene su propia página.">
            {categories.length ? (
              <table className="table-base">
                <thead><tr><th>Nombre</th><th>Slug</th><th>Entradas</th><th /></tr></thead>
                <tbody>
                  {categories.map((c) => (
                    <tr key={c.id}>
                      <td className="font-medium">{c.name}{c.description && <span className="block text-xs font-normal text-zinc-500">{c.description}</span>}</td>
                      <td className="font-mono text-xs text-zinc-500">{c.slug}</td>
                      <td className="text-zinc-600">{c._count.posts}</td>
                      <td>
                        <div className="flex justify-end gap-1">
                          <EditCategory action={save} category={{ id: c.id, name: c.name, slug: c.slug, description: c.description }} />
                          <ConfirmButton action={deleteCategory.bind(null, siteId, c.id)} title="¿Eliminar categoría?" description="Las entradas no se borran, solo dejarán de estar en esta categoría." className="btn-ghost btn-sm text-zinc-400 hover:text-red-600">Eliminar</ConfirmButton>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : <EmptyState icon={<Tags className="h-6 w-6" />} title="Sin categorías" description="Crea la primera con el formulario." />}
          </Card>
          <Card title="Etiquetas" description="Se crean automáticamente al escribirlas en una entrada.">
            {tags.length ? (
              <div className="flex flex-wrap gap-2 p-5">
                {tags.map((t) => (
                  <span key={t.id} className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-white py-1 pl-2.5 pr-1 text-sm">
                    <Hash className="h-3 w-3 text-zinc-400" />{t.name}<span className="text-xs text-zinc-400">{t._count.posts}</span>
                    <ConfirmButton action={deleteTag.bind(null, siteId, t.id)} title={`¿Eliminar «${t.name}»?`} className="rounded px-1 text-zinc-400 hover:bg-red-50 hover:text-red-600">×</ConfirmButton>
                  </span>
                ))}
              </div>
            ) : <p className="p-6 text-center text-sm text-zinc-500">Aún no hay etiquetas.</p>}
          </Card>
        </div>
        <Card title="Nueva categoría" className="h-fit">
          <ActionForm action={save} success="Categoría creada" resetOnSuccess className="space-y-4 p-5">
            <div><label className="label">Nombre</label><input name="name" required className="input" placeholder="Consejos" /></div>
            <div><label className="label">Slug <span className="font-normal text-zinc-400">(opcional)</span></label><input name="slug" className="input" placeholder="consejos" /></div>
            <div><label className="label">Descripción</label><textarea name="description" className="input" /></div>
            <Submit>Añadir categoría</Submit>
          </ActionForm>
        </Card>
      </div>
    </>
  );
}
