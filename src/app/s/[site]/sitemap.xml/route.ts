import { db } from "@/lib/db";
import { resolveSite, publicSiteUrl } from "@/lib/site";
import { livePagesWhere, livePostsWhere } from "@/lib/public";
import { parseSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";

export async function GET(_: Request, { params }: { params: Promise<{ site: string }> }) {
  const site = await resolveSite((await params).site);
  if (!site) return new Response("Not found", { status: 404 });
  const s = parseSettings(site.settings);
  const base = publicSiteUrl(site);
  const [pages, posts] = await Promise.all([
    db.page.findMany({ where: { ...livePagesWhere(site.id), noindex: false }, select: { id: true, slug: true, updatedAt: true } }),
    s.blogEnabled ? db.post.findMany({ where: { ...livePostsWhere(site.id), noindex: false }, select: { slug: true, updatedAt: true } }) : [],
  ]);
  const urls = [
    ...pages.map((p) => ({ loc: p.id === site.homePageId ? `${base}/` : `${base}/${p.slug}`, lastmod: p.updatedAt })),
    ...(s.blogEnabled ? [{ loc: `${base}/${s.blogSlug}`, lastmod: new Date() }] : []),
    ...posts.map((p) => ({ loc: `${base}/${s.blogSlug}/${p.slug}`, lastmod: p.updatedAt })),
  ];
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((u) => `  <url><loc>${u.loc}</loc><lastmod>${u.lastmod.toISOString()}</lastmod></url>`).join("\n")}
</urlset>`;
  return new Response(xml, { headers: { "Content-Type": "application/xml; charset=utf-8" } });
}
