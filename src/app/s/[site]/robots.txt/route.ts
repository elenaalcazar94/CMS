import { resolveSite, publicSiteUrl } from "@/lib/site";

export const dynamic = "force-dynamic";

export async function GET(_: Request, { params }: { params: Promise<{ site: string }> }) {
  const site = await resolveSite((await params).site);
  if (!site) return new Response("Not found", { status: 404 });
  const body = site.maintenance
    ? "User-agent: *\nDisallow: /\n"
    : `User-agent: *\nAllow: /\n\nSitemap: ${publicSiteUrl(site)}/sitemap.xml\n`;
  return new Response(body, { headers: { "Content-Type": "text/plain; charset=utf-8" } });
}
