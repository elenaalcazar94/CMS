/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { Newspaper, PenLine, Search, ImageIcon } from "lucide-react";
import { db } from "@/lib/db";
import { requireSite } from "@/lib/auth";
import { PageHeader, EmptyState, StatusBadge, Card } from "@/components/admin/ui";
import { ConfirmButton } from "@/components/admin/client";
import { cn, formatDate, publishState } from "@/lib/utils";
import { createPost, deletePost } from "@/app/actions/content";
import { NewPostButton } from "./new-button";

export const metadata = { title: "Blog" };

const TABS = [
  { id: "", label: "Todas" },
  { id: "published", label: "Publicadas" },
  { id: "scheduled", label: "Programadas" },
  { id: "draft", label: "Borradores" },
];

export default async function PostsList({ params, searchParams }: { params: Promise<{ siteId: string }>; searchParams: Promise<{ q?: string; status?: string; p?: string }> }) {
  const { siteId } = await params;
  const { q, status = "", p } = await searchParams;
  await requireSite(siteId, "posts");
  const now = new Date();
  const statusWhere: Prisma.PostWhereInput =
    status === "published" ? { status: "PUBLISHED", publishedAt: { lte: now } }
    : status === "scheduled" ? { status: "PUBLISHED", publishedAt: { gt: now } }
    : status === "draft" ? { status: "DRAFT" } : {};
  const where: Prisma.PostWhereInput = { siteId, ...statusWhere, ...(q ? { title: { contains: q, mode: "insensitive" } } : {}) };
  const page = Math.max(1, Number(p) || 1);
  const per = 20;
  const [posts, total, counts] = await Promise.all([
    db.post.findMany({ where, orderBy: [{ updatedAt: "desc" }], skip: (page - 1) * per, take: per, include: { categories: { select: { name: true } }, author: { select: { name: true } } } }),
    db.post.count({ where }),
    Promise.all([
      db.post.count({ where: { siteId } }),
      db.post.count({ where: { siteId, status: "PUBLISHED", publishedAt: { lte: now } } }),
      db.post.count({ where: { siteId, status: "PUBLISHED", publishedAt: { gt: now } } }),
      db.post.count({ where: { siteId, status: "DRAFT" } }),
    ]),
  ]);
  const pages = Math.ceil(total / per);
  const newPost = createPost.bind(null, siteId);

  return (
    <>
      <PageHeader
        title="Blog"
        description="Noticias, artículos y novedades."
        actions={<NewPostButton action={newPost}><PenLine className="h-4 w-4" /> Nueva entrada</NewPostButton>}
      />
      <Card>
        <div className="flex flex-col gap-3 border-b border-zinc-100 p-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex gap-1 overflow-x-auto">
            {TABS.map((t, i) => (
              <Link key={t.id} href={`?status=${t.id}${q ? `&q=${q}` : ""}`} className={cn("whitespace-nowrap rounded-lg px-3 py-1.5 text-[13px] font-medium transition", status === t.id ? "bg-zinc-900 text-white" : "text-zinc-600 hover:bg-zinc-100")}>
                {t.label} <span className={cn("ml-1 text-xs", status === t.id ? "text-zinc-400" : "text-zinc-400")}>{counts[i]}</span>
              </Link>
            ))}
          </div>
          <form className="relative sm:w-64">
            <input type="hidden" name="status" value={status} />
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
            <input name="q" defaultValue={q} className="input pl-9" placeholder="Buscar entradas…" />
          </form>
        </div>
        {posts.length === 0 ? (
          <EmptyState icon={<Newspaper className="h-6 w-6" />} title={q || status ? "No hay entradas aquí" : "Escribe tu primera entrada"} description="Las entradas aparecen en el blog de la web, ordenadas por fecha." action={!q && !status && <NewPostButton action={newPost}><PenLine className="h-4 w-4" /> Nueva entrada</NewPostButton>} />
        ) : (
          <div className="overflow-x-auto">
            <table className="table-base">
              <thead><tr><th>Entrada</th><th className="hidden md:table-cell">Categorías</th><th>Estado</th><th className="hidden sm:table-cell">Fecha</th><th /></tr></thead>
              <tbody>
                {posts.map((post) => (
                  <tr key={post.id}>
                    <td>
                      <Link href={`/admin/s/${siteId}/posts/${post.id}`} className="flex items-center gap-3">
                        <span className="grid h-10 w-14 shrink-0 place-items-center overflow-hidden rounded-md bg-zinc-100 text-zinc-400">
                          {post.coverUrl ? <img src={post.coverUrl} alt="" className="h-full w-full object-cover" /> : <ImageIcon className="h-4 w-4" />}
                        </span>
                        <span className="min-w-0">
                          <span className="block truncate font-medium text-zinc-900 hover:text-brand-700">{post.title || "Sin título"}</span>
                          <span className="text-xs text-zinc-500">{post.author?.name}</span>
                        </span>
                      </Link>
                    </td>
                    <td className="hidden text-xs text-zinc-600 md:table-cell">{post.categories.map((c) => c.name).join(", ") || "—"}</td>
                    <td><StatusBadge state={publishState(post.status, post.publishedAt)} /></td>
                    <td className="hidden text-xs text-zinc-500 sm:table-cell">{formatDate(post.publishedAt ?? post.updatedAt)}</td>
                    <td>
                      <div className="flex justify-end gap-1">
                        <Link href={`/admin/s/${siteId}/posts/${post.id}`} className="btn-secondary btn-sm">Editar</Link>
                        <ConfirmButton action={deletePost.bind(null, siteId, post.id)} title="¿Eliminar esta entrada?" description="Se eliminará definitivamente." className="btn-ghost btn-sm text-zinc-400 hover:text-red-600">Eliminar</ConfirmButton>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {pages > 1 && (
          <div className="flex items-center justify-between border-t border-zinc-100 px-4 py-3 text-sm">
            <span className="text-zinc-500">Página {page} de {pages}</span>
            <div className="flex gap-2">
              {page > 1 && <Link className="btn-secondary btn-sm" href={`?status=${status}&p=${page - 1}${q ? `&q=${q}` : ""}`}>Anterior</Link>}
              {page < pages && <Link className="btn-secondary btn-sm" href={`?status=${status}&p=${page + 1}${q ? `&q=${q}` : ""}`}>Siguiente</Link>}
            </div>
          </div>
        )}
      </Card>
    </>
  );
}
