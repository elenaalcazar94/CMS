import { db } from "@/lib/db";
import { requireSite } from "@/lib/auth";
import { parseSettings } from "@/lib/settings";
import { PageHeader } from "@/components/admin/ui";
import { MenuEditor, type MenuItem } from "@/components/admin/MenuEditor";

export const metadata = { title: "Menús" };

export default async function MenusPage({ params }: { params: Promise<{ siteId: string }> }) {
  const { siteId } = await params;
  await requireSite(siteId, "menus");
  const [site, menus, pages] = await Promise.all([
    db.site.findUniqueOrThrow({ where: { id: siteId } }),
    db.menu.findMany({ where: { siteId } }),
    db.page.findMany({ where: { siteId }, select: { id: true, title: true, slug: true, status: true }, orderBy: { title: "asc" } }),
  ]);
  const s = parseSettings(site.settings);
  const get = (loc: string) => (menus.find((m) => m.location === loc)?.items as MenuItem[] | undefined) ?? [];
  const links = [
    ...pages.map((p) => ({ label: p.title, url: p.id === site.homePageId ? "/" : `/${p.slug}`, draft: p.status !== "PUBLISHED" })),
    ...(s.blogEnabled ? [{ label: s.blogTitle, url: `/${s.blogSlug}`, draft: false }] : []),
  ];
  return (
    <>
      <PageHeader title="Menús" description="Organiza la navegación de la web. Arrastra los elementos para cambiar el orden." />
      <MenuEditor siteId={siteId} header={get("header")} footer={get("footer")} links={links} />
    </>
  );
}
