import type { Site } from "@prisma/client";
import { db } from "@/lib/db";
import { resolveSite, siteBase, publicSiteUrl } from "@/lib/site";
import { getSiteAccess } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { parseSettings } from "@/lib/settings";
import { readUpload, SITE_FILE_MIME } from "@/lib/storage";
import { livePagesWhere } from "@/lib/public";
import { renderCustomPage, rebaseCss, type CollectionItem } from "@/lib/custom/render";
import { COLLECTION_ATTR, htmlPathToSlug, isHtmlPath, type FieldMap, type ImageValue } from "@/lib/custom/shared";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ site: string; path?: string[] }> };

function html(body: string, status = 200, extra: Record<string, string> = {}) {
  return new Response(body, { status, headers: { "Content-Type": "text/html; charset=utf-8", ...extra } });
}

function simplePage(title: string, text: string, status: number) {
  return html(`<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title>
<style>body{margin:0;min-height:100vh;display:grid;place-items:center;font-family:system-ui,sans-serif;color:#222;background:#fafafa;text-align:center;padding:24px}h1{font-size:56px;margin:0}p{color:#666}</style></head>
<body><div><h1>${title}</h1><p>${text}</p></div></body></html>`, status);
}

function firstImage(fields: FieldMap): string {
  for (const v of Object.values(fields)) {
    if (v && typeof v === "object" && !Array.isArray(v) && "src" in v) return (v as ImageValue).src;
  }
  return "";
}

async function collectionsFor(site: Site, templateHtml: string, base: string) {
  const names = Array.from(templateHtml.matchAll(new RegExp(`${COLLECTION_ATTR}="([^"]+)"`, "g")), (m) => m[1]);
  const out: Record<string, CollectionItem[]> = {};
  for (const name of new Set(names)) {
    const tpl = /\.html?$/i.test(name) ? name : `${name}.html`;
    const pages = await db.page.findMany({
      where: { ...livePagesWhere(site.id), template: tpl, NOT: { slug: htmlPathToSlug(tpl) || "inicio" } },
      orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
      take: 100,
    });
    out[name] = pages.map((p) => {
      const fields = (p.fields ?? {}) as FieldMap;
      return {
        title: p.title,
        url: `${base}/${p.slug}`,
        description: p.seoDescription ?? "",
        image: p.ogImage || firstImage(fields),
        date: p.publishedAt?.toISOString() ?? null,
        fields,
      };
    });
  }
  return out;
}

async function sitemap(site: Site) {
  const base = publicSiteUrl(site);
  const pages = await db.page.findMany({ where: { ...livePagesWhere(site.id), noindex: false }, select: { id: true, slug: true, updatedAt: true } });
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${pages.map((p) => `  <url><loc>${p.id === site.homePageId ? `${base}/` : `${base}/${p.slug}`}</loc><lastmod>${p.updatedAt.toISOString()}</lastmod></url>`).join("\n")}
</urlset>`;
  return new Response(xml, { headers: { "Content-Type": "application/xml; charset=utf-8" } });
}

export async function GET(req: Request, { params }: Ctx) {
  const { site: param, path = [] } = await params;
  const site = await resolveSite(param);
  if (!site || site.kind !== "custom") return simplePage("404", "Esta web no existe.", 404);
  const url = new URL(req.url);
  const base = await siteBase(param, "c");
  const rel = path.map(decodeURIComponent).join("/");

  if (rel === "sitemap.xml") return sitemap(site);
  if (rel === "robots.txt") {
    return new Response(site.maintenance ? "User-agent: *\nDisallow: /\n" : `User-agent: *\nAllow: /\n\nSitemap: ${publicSiteUrl(site)}/sitemap.xml\n`, { headers: { "Content-Type": "text/plain; charset=utf-8" } });
  }

  // Archivos estáticos de la web (css, js, imágenes, fuentes…)
  if (rel && !isHtmlPath(rel) && /\.[a-z0-9]+$/i.test(rel)) {
    const file = await db.templateFile.findUnique({ where: { siteId_path: { siteId: site.id, path: rel } } });
    if (!file?.storageKey) return new Response("Not found", { status: 404 });
    const data = await readUpload(file.storageKey);
    if (!data) return new Response("Not found", { status: 404 });
    const ext = rel.split(".").pop()!.toLowerCase();
    const type = SITE_FILE_MIME[ext] ?? file.mimeType;
    const body = ext === "css" && base ? rebaseCss(new TextDecoder().decode(data), base) : data;
    return new Response(body as BodyInit, {
      headers: { "Content-Type": type, "Cache-Control": "public, max-age=300, stale-while-revalidate=86400", "X-Content-Type-Options": "nosniff" },
    });
  }

  // Enlaces antiguos a .html → URL limpia
  if (isHtmlPath(rel)) {
    const slug = htmlPathToSlug(rel);
    return Response.redirect(new URL(`${base}/${slug}${url.search}`, url), 301);
  }

  const editing = url.searchParams.has("__edit");
  const access = editing || url.searchParams.get("preview") === "1" || site.maintenance ? await getSiteAccess(site.id) : null;
  if (editing && (!access || !can(access.role, "pages.edit"))) return simplePage("403", "No tienes permiso para editar esta web.", 403);
  if (site.maintenance && !access) return simplePage(site.name, "Estamos preparando algo nuevo. Vuelve muy pronto.", 503);

  const allowDraft = !!access;
  const where = rel === "" ? (site.homePageId ? { id: site.homePageId } : { siteId: site.id, slug: "inicio" }) : { siteId: site.id, slug: rel };
  const page = await db.page.findFirst({ where: allowDraft ? where : { AND: [where, livePagesWhere(site.id)] } });

  const settings = parseSettings(site.settings);
  if (!page?.template) {
    const notFound = await db.templateFile.findUnique({ where: { siteId_path: { siteId: site.id, path: "404.html" } } });
    if (notFound?.html) {
      return html(renderCustomPage({
        html: notFound.html, fields: {}, globals: (site.globalFields ?? {}) as FieldMap, base, mode: "public",
        page: { title: "Página no encontrada" }, forms: {}, collections: {}, headCode: settings.headCode,
      }), 404);
    }
    return simplePage("404", "La página que buscas no existe.", 404);
  }

  const tpl = await db.templateFile.findUnique({ where: { siteId_path: { siteId: site.id, path: page.template } } });
  if (!tpl?.html) return simplePage("Falta la plantilla", `No se encuentra el archivo «${page.template}». Vuelve a subir la web.`, 500);

  const [forms, collections] = await Promise.all([
    db.form.findMany({ where: { siteId: site.id }, select: { id: true, slug: true } }),
    collectionsFor(site, tpl.html, base),
  ]);
  const isHome = page.id === site.homePageId;
  const out = renderCustomPage({
    html: tpl.html,
    fields: (page.fields ?? {}) as FieldMap,
    globals: (site.globalFields ?? {}) as FieldMap,
    base,
    mode: editing ? "edit" : "public",
    runScripts: url.searchParams.get("js") === "1",
    page: {
      title: page.title,
      seoTitle: page.seoTitle,
      seoDescription: page.seoDescription || settings.seoDescription,
      ogImage: page.ogImage || settings.ogImage,
      noindex: page.noindex,
      canonical: `${publicSiteUrl(site)}${isHome ? "/" : `/${page.slug}`}`,
    },
    headCode: settings.headCode,
    forms: Object.fromEntries(forms.map((f) => [f.slug, f.id])),
    collections,
  });
  return html(out, 200, { "Cache-Control": editing || allowDraft ? "no-store" : "public, max-age=0, must-revalidate" });
}
