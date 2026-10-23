import Link from "next/link";
import { redirect } from "next/navigation";
import { Plus, Globe, FileText, Newspaper, Inbox, ExternalLink, ArrowUpRight } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { publicSiteUrl } from "@/lib/site";
import { resolveTheme } from "@/lib/themes";
import { EmptyState, PageHeader } from "@/components/admin/ui";
import { timeAgo } from "@/lib/utils";
import { ROLE_LABELS } from "@/lib/permissions";

export const metadata = { title: "Sitios" };

export default async function SitesPage() {
  const user = await requireUser();
  const isSuper = user.role === "SUPERADMIN";
  const sites = await db.site.findMany({
    where: isSuper ? {} : { members: { some: { userId: user.id } } },
    include: {
      members: { where: { userId: user.id } },
      _count: { select: { pages: true, posts: true } },
    },
    orderBy: { updatedAt: "desc" },
  });
  // Un cliente con un solo sitio va directo a él
  if (!isSuper && sites.length === 1) redirect(`/admin/s/${sites[0].id}`);

  const unread = await db.formSubmission.groupBy({ by: ["formId"], where: { read: false }, _count: true });
  const forms = await db.form.findMany({ where: { id: { in: unread.map((u) => u.formId) } }, select: { id: true, siteId: true } });
  const unreadBySite = new Map<string, number>();
  for (const u of unread) {
    const s = forms.find((f) => f.id === u.formId)?.siteId;
    if (s) unreadBySite.set(s, (unreadBySite.get(s) ?? 0) + u._count);
  }

  const hour = new Date().getHours();
  const greeting = hour < 13 ? "Buenos días" : hour < 21 ? "Buenas tardes" : "Buenas noches";

  return (
    <>
      <PageHeader
        title={`${greeting}, ${user.name.split(" ")[0]}`}
        description={isSuper ? "Estas son todas las webs que gestionas." : "Elige la web que quieres editar."}
        actions={isSuper && <Link href="/admin/sites/new" className="btn-primary"><Plus className="h-4 w-4" /> Nuevo sitio</Link>}
      />
      {sites.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={<Globe className="h-6 w-6" />}
            title={isSuper ? "Crea tu primer sitio" : "Aún no tienes sitios asignados"}
            description={isSuper ? "Cada sitio es la web de un cliente, con sus páginas, blog, formularios y diseño propios." : "Pide a tu administrador que te dé acceso a una web."}
            action={isSuper && <Link href="/admin/sites/new" className="btn-primary"><Plus className="h-4 w-4" /> Nuevo sitio</Link>}
          />
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {sites.map((s) => {
            const t = resolveTheme(s.theme, s.themeSettings);
            const url = publicSiteUrl(s);
            const msgs = unreadBySite.get(s.id) ?? 0;
            return (
              <div key={s.id} className="card group relative overflow-hidden transition hover:-translate-y-0.5 hover:shadow-pop">
                <Link href={`/admin/s/${s.id}`} className="absolute inset-0 z-0" aria-label={`Abrir ${s.name}`} />
                <div className="relative h-28 overflow-hidden" style={{ background: t.surface }}>
                  <div className="absolute inset-x-5 top-5 flex items-center justify-between">
                    <span className="text-sm font-bold" style={{ color: t.text, fontFamily: t.headingFont }}>{s.name}</span>
                    <span className="flex gap-1.5">{[0, 1, 2].map((i) => <span key={i} className="h-1.5 w-6 rounded-full opacity-30" style={{ background: t.text }} />)}</span>
                  </div>
                  <div className="absolute inset-x-5 top-12 space-y-1.5">
                    <div className="h-2.5 w-2/3 rounded-full" style={{ background: t.text, opacity: 0.8 }} />
                    <div className="h-2 w-1/2 rounded-full opacity-30" style={{ background: t.text }} />
                    <div className="mt-2 h-5 w-20" style={{ background: t.primary, borderRadius: Math.min(t.radius, 10) }} />
                  </div>
                  <div className="absolute -bottom-6 -right-6 h-24 w-24 rounded-full opacity-25" style={{ background: t.accent }} />
                  {s.maintenance && <span className="badge-amber absolute right-3 top-3 z-10">Mantenimiento</span>}
                </div>
                <div className="pointer-events-none relative p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="truncate font-semibold text-zinc-900">{s.name}</h3>
                      <a href={url} target="_blank" rel="noreferrer" className="pointer-events-auto mt-0.5 inline-flex max-w-full items-center gap-1 truncate text-xs text-zinc-500 hover:text-brand-600">
                        {s.domain ?? url.replace(/^https?:\/\//, "")} <ExternalLink className="h-3 w-3 shrink-0" />
                      </a>
                    </div>
                    <ArrowUpRight className="h-4 w-4 shrink-0 text-zinc-300 transition group-hover:text-brand-600" />
                  </div>
                  <div className="mt-4 flex items-center gap-4 text-xs text-zinc-500">
                    <span className="flex items-center gap-1"><FileText className="h-3.5 w-3.5" /> {s._count.pages}</span>
                    <span className="flex items-center gap-1"><Newspaper className="h-3.5 w-3.5" /> {s._count.posts}</span>
                    {msgs > 0 && <span className="flex items-center gap-1 font-medium text-brand-700"><Inbox className="h-3.5 w-3.5" /> {msgs} nuevo{msgs > 1 ? "s" : ""}</span>}
                    <span className="ml-auto">{isSuper ? timeAgo(s.updatedAt) : ROLE_LABELS[s.members[0].role]}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
