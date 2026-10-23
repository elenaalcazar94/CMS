import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { publicSiteUrl } from "@/lib/site";
import { Sidebar, type SidebarSite } from "@/components/admin/Sidebar";
import { Toaster } from "@/components/admin/toast";

export const metadata = { title: { default: "Panel · Nido CMS", template: "%s · Nido CMS" }, icons: { icon: "/nido-icon.svg" } };

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const isSuper = user.role === "SUPERADMIN";
  const sites = await db.site.findMany({
    where: isSuper ? {} : { members: { some: { userId: user.id } } },
    include: { members: { where: { userId: user.id } } },
    orderBy: { name: "asc" },
  });
  const unread = await db.formSubmission.groupBy({
    by: ["formId"],
    where: { read: false, form: { siteId: { in: sites.map((s) => s.id) } } },
    _count: true,
  });
  const formSite = new Map((await db.form.findMany({ where: { id: { in: unread.map((u) => u.formId) } }, select: { id: true, siteId: true } })).map((f) => [f.id, f.siteId]));
  const unreadBySite: Record<string, number> = {};
  for (const u of unread) {
    const sid = formSite.get(u.formId)!;
    unreadBySite[sid] = (unreadBySite[sid] ?? 0) + u._count;
  }

  const sidebarSites: SidebarSite[] = sites.map((s) => ({
    id: s.id,
    name: s.name,
    slug: s.slug,
    role: isSuper ? "SUPERADMIN" : s.members[0].role,
    url: publicSiteUrl(s),
    unread: unreadBySite[s.id] ?? 0,
    kind: s.kind,
  }));

  return (
    <div className="min-h-screen">
      <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" precedence="default" />
      <Sidebar user={{ name: user.name, email: user.email, role: user.role }} sites={sidebarSites} />
      <div className="lg:pl-[248px]">
        <main className="mx-auto max-w-6xl px-4 py-6 sm:px-8 sm:py-9">{children}</main>
      </div>
      <Toaster />
    </div>
  );
}
