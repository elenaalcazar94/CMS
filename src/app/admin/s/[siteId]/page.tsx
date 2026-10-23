import Link from "next/link";
import { FileText, Newspaper, Inbox, ImageIcon, Plus, ExternalLink, CheckCircle2, Circle, ArrowRight, PenLine, Upload } from "lucide-react";
import { db } from "@/lib/db";
import { requireSite } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { publicSiteUrl } from "@/lib/site";
import { parseSettings } from "@/lib/settings";
import { Card, PageHeader, StatusBadge } from "@/components/admin/ui";
import { publishState, timeAgo } from "@/lib/utils";
import { createPost } from "@/app/actions/content";
import { submissionEntries } from "@/lib/forms";
import { NewPostButton } from "./posts/new-button";

export default async function SiteDashboard({ params }: { params: Promise<{ siteId: string }> }) {
  const { siteId } = await params;
  const { role, user } = await requireSite(siteId);
  const site = await db.site.findUniqueOrThrow({ where: { id: siteId } });
  const settings = parseSettings(site.settings);

  const [pages, posts, media, unread, messages, recentPages, recentPosts, menus, forms] = await Promise.all([
    db.page.count({ where: { siteId, status: "PUBLISHED" } }),
    db.post.count({ where: { siteId, status: "PUBLISHED" } }),
    db.media.count({ where: { siteId } }),
    db.formSubmission.count({ where: { read: false, form: { siteId } } }),
    db.formSubmission.findMany({ where: { form: { siteId } }, orderBy: { createdAt: "desc" }, take: 5, include: { form: { select: { name: true } } } }),
    db.page.findMany({ where: { siteId }, orderBy: { updatedAt: "desc" }, take: 4, select: { id: true, title: true, status: true, publishedAt: true, updatedAt: true } }),
    db.post.findMany({ where: { siteId }, orderBy: { updatedAt: "desc" }, take: 4, select: { id: true, title: true, status: true, publishedAt: true, updatedAt: true } }),
    db.menu.count({ where: { siteId, location: "header" } }),
    db.form.count({ where: { siteId } }),
  ]);
  const recent = [
    ...recentPages.map((p) => ({ ...p, kind: "page" as const })),
    ...recentPosts.map((p) => ({ ...p, kind: "post" as const })),
  ].sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime()).slice(0, 6);

  const url = publicSiteUrl(site);
  const isAdmin = can(role, "settings");
  const checklist = [
    { done: !!site.logoUrl, label: "Sube el logotipo", href: "appearance", cap: can(role, "appearance") },
    { done: !!site.homePageId, label: "Elige la página de portada", href: "settings", cap: isAdmin },
    { done: menus > 0, label: "Configura el menú principal", href: "menus", cap: can(role, "menus") },
    { done: forms > 0, label: "Crea un formulario de contacto", href: "forms", cap: can(role, "forms") },
    { done: !!settings.seoDescription, label: "Añade la descripción SEO del sitio", href: "settings?tab=seo", cap: isAdmin },
    { done: !!site.domain, label: "Conecta el dominio propio", href: "settings", cap: isAdmin },
  ].filter((c) => c.cap);
  const doneCount = checklist.filter((c) => c.done).length;

  const stats = [
    { label: "Páginas publicadas", value: pages, icon: FileText, href: "pages", cap: can(role, "pages.edit") },
    { label: "Entradas publicadas", value: posts, icon: Newspaper, href: "posts", cap: can(role, "posts") },
    { label: "Mensajes sin leer", value: unread, icon: Inbox, href: "messages", cap: can(role, "messages"), highlight: unread > 0 },
    { label: "Archivos", value: media, icon: ImageIcon, href: "media", cap: can(role, "media") },
  ].filter((s) => s.cap);

  return (
    <>
      <PageHeader
        title={site.name}
        description={<a href={url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 hover:text-brand-600">{url.replace(/^https?:\/\//, "")} <ExternalLink className="h-3 w-3" /></a>}
        actions={
          <>
            {can(role, "posts") && <NewPostButton action={createPost.bind(null, siteId)} className="btn-secondary"><PenLine className="h-4 w-4" /> Escribir entrada</NewPostButton>}
            {can(role, "pages.manage") && <Link href={`/admin/s/${siteId}/pages?new=1`} className="btn-primary"><Plus className="h-4 w-4" /> Nueva página</Link>}
          </>
        }
      />

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {stats.map((s) => (
          <Link key={s.label} href={`/admin/s/${siteId}/${s.href}`} className="card group p-4 transition hover:border-zinc-300 hover:shadow-pop">
            <div className="flex items-center justify-between">
              <span className={`grid h-9 w-9 place-items-center rounded-lg ${s.highlight ? "bg-brand-600 text-white" : "bg-zinc-100 text-zinc-600"}`}><s.icon className="h-[18px] w-[18px]" /></span>
              <ArrowRight className="h-4 w-4 text-zinc-300 transition group-hover:translate-x-0.5 group-hover:text-zinc-500" />
            </div>
            <p className="mt-3 text-2xl font-semibold tracking-tight">{s.value}</p>
            <p className="text-xs text-zinc-500">{s.label}</p>
          </Link>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <div className="space-y-6">
          <Card title="Editado recientemente" actions={can(role, "pages.edit") && <Link href={`/admin/s/${siteId}/pages`} className="text-xs font-medium text-brand-600 hover:text-brand-700">Ver todo</Link>}>
            {recent.length ? (
              <ul className="divide-y divide-zinc-100">
                {recent.map((r) => (
                  <li key={r.id}>
                    <Link href={`/admin/s/${siteId}/${r.kind === "page" ? "pages" : "posts"}/${r.id}`} className="flex items-center gap-3 px-5 py-3 transition hover:bg-zinc-50 sm:px-6">
                      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-zinc-100 text-zinc-500">{r.kind === "page" ? <FileText className="h-4 w-4" /> : <Newspaper className="h-4 w-4" />}</span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">{r.title || "Sin título"}</span>
                        <span className="text-xs text-zinc-500">{r.kind === "page" ? "Página" : "Entrada"} · {timeAgo(r.updatedAt)}</span>
                      </span>
                      <StatusBadge state={publishState(r.status, r.publishedAt)} />
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="px-6 py-10 text-center text-sm text-zinc-500">Todavía no hay contenido.</p>
            )}
          </Card>

          {can(role, "messages") && (
            <Card title="Últimos mensajes" actions={<Link href={`/admin/s/${siteId}/messages`} className="text-xs font-medium text-brand-600 hover:text-brand-700">Bandeja de entrada</Link>}>
              {messages.length ? (
                <ul className="divide-y divide-zinc-100">
                  {messages.map((m) => {
                    const vals = submissionEntries(m.data).map((e) => e[1]);
                    return (
                      <li key={m.id}>
                        <Link href={`/admin/s/${siteId}/messages?id=${m.id}`} className="flex items-start gap-3 px-5 py-3 transition hover:bg-zinc-50 sm:px-6">
                          <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${m.read ? "bg-transparent" : "bg-brand-600"}`} />
                          <span className="min-w-0 flex-1">
                            <span className="flex justify-between gap-2"><span className={`truncate text-sm ${m.read ? "" : "font-semibold"}`}>{vals[0] || "Sin nombre"}</span><span className="shrink-0 text-xs text-zinc-400">{timeAgo(m.createdAt)}</span></span>
                            <span className="block truncate text-xs text-zinc-500">{m.form.name} · {vals.slice(1).filter(Boolean).join(" · ")}</span>
                          </span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="px-6 py-10 text-center text-sm text-zinc-500">Aquí aparecerán los mensajes de tus formularios.</p>
              )}
            </Card>
          )}
        </div>

        <div className="space-y-6">
          {checklist.length > 0 && doneCount < checklist.length && (
            <Card title="Pon tu web a punto" description={`${doneCount} de ${checklist.length} pasos completados`}>
              <div className="px-5 pt-4 sm:px-6"><div className="h-1.5 overflow-hidden rounded-full bg-zinc-100"><div className="h-full rounded-full bg-brand-600 transition-all" style={{ width: `${(doneCount / checklist.length) * 100}%` }} /></div></div>
              <ul className="p-3">
                {checklist.map((c) => (
                  <li key={c.label}>
                    <Link href={`/admin/s/${siteId}/${c.href}`} className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition hover:bg-zinc-50">
                      {c.done ? <CheckCircle2 className="h-[18px] w-[18px] text-emerald-500" /> : <Circle className="h-[18px] w-[18px] text-zinc-300" />}
                      <span className={c.done ? "text-zinc-400 line-through" : "text-zinc-800"}>{c.label}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </Card>
          )}
          <Card title="Accesos rápidos">
            <div className="grid grid-cols-2 gap-2 p-3">
              {[
                { label: "Ver la web", href: url, icon: ExternalLink, ext: true, cap: true },
                { label: "Subir archivos", href: `/admin/s/${siteId}/media`, icon: Upload, cap: can(role, "media") },
                { label: "Editar menú", href: `/admin/s/${siteId}/menus`, icon: FileText, cap: can(role, "menus") },
                { label: "Cambiar diseño", href: `/admin/s/${siteId}/appearance`, icon: ImageIcon, cap: can(role, "appearance") },
              ].filter((q) => q.cap).map((q) => (
                <a key={q.label} href={q.href} target={q.ext ? "_blank" : undefined} rel="noreferrer" className="flex items-center gap-2 rounded-lg border border-zinc-200 px-3 py-2.5 text-[13px] font-medium text-zinc-700 transition hover:border-brand-300 hover:bg-brand-50/50 hover:text-brand-700">
                  <q.icon className="h-4 w-4" /> {q.label}
                </a>
              ))}
            </div>
          </Card>
          <p className="px-1 text-xs text-zinc-400">Has entrado como {user.name}.</p>
        </div>
      </div>
    </>
  );
}
