import Link from "next/link";
import { FileText, Home, Eye, Search } from "lucide-react";
import { db } from "@/lib/db";
import { requireSite } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { publicSiteUrl } from "@/lib/site";
import { PageHeader, EmptyState, StatusBadge, Card } from "@/components/admin/ui";
import { ConfirmButton } from "@/components/admin/client";
import { publishState, timeAgo } from "@/lib/utils";
import { deletePage, duplicatePage, setHomePage, createPage } from "@/app/actions/content";
import { PAGE_TEMPLATES } from "@/lib/templates";
import { NewPageDialog } from "./new-dialog";
import { RowAction } from "./row-action";

export const metadata = { title: "Páginas" };

export default async function PagesList({ params, searchParams }: { params: Promise<{ siteId: string }>; searchParams: Promise<{ q?: string; new?: string }> }) {
  const { siteId } = await params;
  const { q, new: openNew } = await searchParams;
  const { role } = await requireSite(siteId, "pages.edit");
  const manage = can(role, "pages.manage");
  const site = await db.site.findUniqueOrThrow({ where: { id: siteId } });
  const pages = await db.page.findMany({
    where: { siteId, ...(q ? { title: { contains: q, mode: "insensitive" } } : {}) },
    orderBy: [{ updatedAt: "desc" }],
    include: { author: { select: { name: true } } },
  });
  const url = publicSiteUrl(site);
  const preview = `/s/${site.slug}`;
  const templates = PAGE_TEMPLATES.map(({ id, name, description }) => ({ id, name, description }));

  return (
    <>
      <PageHeader
        title="Páginas"
        description="Las páginas fijas de la web: inicio, servicios, contacto…"
        actions={manage && <NewPageDialog action={createPage.bind(null, siteId)} templates={templates} defaultOpen={openNew === "1"} />}
      />
      <Card>
        <div className="border-b border-zinc-100 p-3">
          <form className="relative max-w-xs">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
            <input name="q" defaultValue={q} className="input pl-9" placeholder="Buscar páginas…" />
          </form>
        </div>
        {pages.length === 0 ? (
          <EmptyState icon={<FileText className="h-6 w-6" />} title={q ? "Sin resultados" : "Aún no hay páginas"} description={q ? "Prueba con otra búsqueda." : "Crea tu primera página a partir de una plantilla."} />
        ) : (
          <div className="overflow-x-auto">
            <table className="table-base">
              <thead>
                <tr><th>Título</th><th className="hidden md:table-cell">URL</th><th>Estado</th><th className="hidden sm:table-cell">Actualizada</th><th /></tr>
              </thead>
              <tbody>
                {pages.map((p) => {
                  const isHome = site.homePageId === p.id;
                  return (
                    <tr key={p.id}>
                      <td>
                        <Link href={`/admin/s/${siteId}/pages/${p.id}`} className="flex items-center gap-2.5 font-medium text-zinc-900 hover:text-brand-700">
                          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-zinc-100 text-zinc-500">{isHome ? <Home className="h-4 w-4 text-brand-600" /> : <FileText className="h-4 w-4" />}</span>
                          <span className="min-w-0">
                            <span className="block truncate">{p.title}</span>
                            {isHome && <span className="text-[11px] font-medium text-brand-600">Portada</span>}
                          </span>
                        </Link>
                      </td>
                      <td className="hidden font-mono text-xs text-zinc-500 md:table-cell">/{isHome ? "" : p.slug}</td>
                      <td><StatusBadge state={publishState(p.status, p.publishedAt)} /></td>
                      <td className="hidden text-xs text-zinc-500 sm:table-cell">{timeAgo(p.updatedAt)}{p.author && <span className="block">{p.author.name}</span>}</td>
                      <td>
                        <div className="flex items-center justify-end gap-1">
                          <a href={`${p.status === "PUBLISHED" ? url : preview}${isHome ? "" : `/${p.slug}`}${p.status === "PUBLISHED" ? "" : "?preview=1"}`} target="_blank" rel="noreferrer" className="btn-icon btn-ghost" title="Ver"><Eye className="h-4 w-4" /></a>
                          <Link href={`/admin/s/${siteId}/pages/${p.id}`} className="btn-secondary btn-sm">Editar</Link>
                          {manage && (
                            <RowAction
                              items={[
                                { label: "Duplicar", action: duplicatePage.bind(null, siteId, p.id) },
                                ...(!isHome && p.status === "PUBLISHED" ? [{ label: "Usar como portada", action: setHomePage.bind(null, siteId, p.id) }] : []),
                              ]}
                              danger={
                                <ConfirmButton action={deletePage.bind(null, siteId, p.id)} title="¿Eliminar esta página?" description={`«${p.title}» se eliminará definitivamente junto con su historial.`} className="w-full rounded-md px-2.5 py-1.5 text-left text-[13px] text-red-600 hover:bg-red-50">
                                  Eliminar
                                </ConfirmButton>
                              }
                            />
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  );
}
