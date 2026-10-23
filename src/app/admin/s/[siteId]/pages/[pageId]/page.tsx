import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireSite } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { parseBlocks } from "@/lib/blocks";
import { resolveTheme } from "@/lib/themes";
import { publicSiteUrl } from "@/lib/site";
import { parseSettings } from "@/lib/settings";
import { buildRenderCtx } from "@/lib/public";
import { PageEditor } from "@/components/admin/editor/PageEditor";
import { CustomPageEditor } from "@/components/admin/editor/CustomPageEditor";
import { previewBase } from "@/lib/site";

export const metadata = { title: "Editor" };

export default async function EditPage({ params }: { params: Promise<{ siteId: string; pageId: string }> }) {
  const { siteId, pageId } = await params;
  const { role } = await requireSite(siteId, "pages.edit");
  const [site, page] = await Promise.all([
    db.site.findUniqueOrThrow({ where: { id: siteId } }),
    db.page.findFirst({ where: { id: pageId, siteId } }),
  ]);
  if (!page) notFound();

  if (site.kind === "custom") {
    const [pages, revisions] = await Promise.all([
      db.page.findMany({ where: { siteId }, select: { id: true, title: true, slug: true }, orderBy: { title: "asc" } }),
      db.revision.findMany({ where: { entityType: "page", entityId: page.id }, orderBy: { createdAt: "desc" }, take: 15, include: { author: { select: { name: true } } } }),
    ]);
    const base = previewBase(site);
    const isHome = site.homePageId === page.id;
    const path = isHome ? "" : `/${page.slug}`;
    return (
      <CustomPageEditor
        siteId={siteId}
        meta={{
          id: page.id, title: page.title, slug: page.slug, status: page.status, publishedAt: page.publishedAt?.toISOString() ?? null,
          seoTitle: page.seoTitle ?? "", seoDescription: page.seoDescription ?? "", ogImage: page.ogImage ?? "", noindex: page.noindex,
        }}
        template={page.template ?? "—"}
        editSrc={`${base}${path}?__edit=1&t=${page.updatedAt.getTime()}`}
        base={base}
        publicUrl={publicSiteUrl(site)}
        previewUrl={`${base}${path}?preview=1`}
        isHome={isHome}
        canManage={can(role, "pages.manage")}
        links={pages.map((p) => ({ label: p.title, url: p.id === site.homePageId ? "/" : `/${p.slug}` }))}
        revisions={revisions.map((r) => ({ id: r.id, createdAt: r.createdAt.toISOString(), author: r.author?.name ?? null }))}
      />
    );
  }

  const blocks = parseBlocks(page.blocks);
  const settings = parseSettings(site.settings);
  const [forms, pages, revisions, allForms] = await Promise.all([
    db.form.findMany({ where: { siteId }, select: { id: true, name: true } }),
    db.page.findMany({ where: { siteId }, select: { id: true, title: true, slug: true }, orderBy: { title: "asc" } }),
    db.revision.findMany({ where: { entityType: "page", entityId: page.id }, orderBy: { createdAt: "desc" }, take: 15, include: { author: { select: { name: true } } } }),
    db.form.findMany({ where: { siteId }, select: { id: true } }),
  ]);
  // El lienzo necesita todos los formularios y las últimas entradas para previsualizar cualquier bloque
  const ctx = await buildRenderCtx(site, [...blocks, { id: "_", type: "latestPosts", data: {} }, ...allForms.map((f) => ({ id: f.id, type: "form", data: { formId: f.id } }))], "", true);
  const links = [
    ...pages.map((p) => ({ label: p.title, url: p.id === site.homePageId ? "/" : `/${p.slug}` })),
    ...(settings.blogEnabled ? [{ label: settings.blogTitle, url: `/${settings.blogSlug}` }] : []),
  ];

  return (
    <PageEditor
      siteId={siteId}
      page={{
        id: page.id, title: page.title, slug: page.slug, blocks, status: page.status, publishedAt: page.publishedAt?.toISOString() ?? null,
        seoTitle: page.seoTitle ?? "", seoDescription: page.seoDescription ?? "", ogImage: page.ogImage ?? "", noindex: page.noindex,
      }}
      isHome={site.homePageId === page.id}
      previewUrl={`/s/${site.slug}${site.homePageId === page.id ? "" : `/${page.slug}`}?preview=1`}
      publicUrl={publicSiteUrl(site)}
      theme={{ id: site.theme, settings: resolveTheme(site.theme, site.themeSettings) }}
      renderCtx={ctx}
      fieldsCtx={{ forms, links }}
      revisions={revisions.map((r) => ({ id: r.id, createdAt: r.createdAt.toISOString(), author: r.author?.name ?? null }))}
      canManage={can(role, "pages.manage")}
      canHtml={can(role, "html")}
    />
  );
}
