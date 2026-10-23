import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { hashToken } from "@/lib/auth";
import { livePagesWhere, livePostsWhere } from "@/lib/public";
import { parseBlocks } from "@/lib/blocks";
import { parseFields } from "@/lib/forms";
import { parseSettings } from "@/lib/settings";
import { resolveTheme } from "@/lib/themes";
import { handleSubmission } from "@/lib/submit";

/*
 * API headless de solo lectura (más el envío de formularios).
 * Autenticación: cabecera "Authorization: Bearer <clave>" o ?key=<clave>
 */

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Authorization, Content-Type",
};

function json(data: unknown, status = 200) {
  return Response.json(data, { status, headers: { ...CORS, "Cache-Control": "no-store" } });
}

async function authenticate(req: Request) {
  const header = req.headers.get("authorization");
  const key = header?.startsWith("Bearer ") ? header.slice(7) : new URL(req.url).searchParams.get("key");
  if (!key) return null;
  const apiKey = await db.apiKey.findUnique({ where: { keyHash: hashToken(key) }, include: { site: true } });
  if (!apiKey) return null;
  if (!apiKey.lastUsedAt || Date.now() - apiKey.lastUsedAt.getTime() > 60_000) {
    await db.apiKey.update({ where: { id: apiKey.id }, data: { lastUsedAt: new Date() } });
  }
  return apiKey.site;
}

const postList = {
  id: true, title: true, slug: true, excerpt: true, coverUrl: true, publishedAt: true, updatedAt: true,
  categories: { select: { name: true, slug: true } },
  tags: { select: { name: true, slug: true } },
  author: { select: { name: true } },
} satisfies Prisma.PostSelect;

export function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS });
}

export async function GET(req: Request, { params }: { params: Promise<{ path?: string[] }> }) {
  const site = await authenticate(req);
  if (!site) return json({ error: "Clave API no válida" }, 401);
  const [resource, ...rest] = (await params).path ?? [];
  const sp = new URL(req.url).searchParams;

  switch (resource) {
    case undefined:
    case "site": {
      const s = parseSettings(site.settings);
      return json({
        name: site.name, tagline: site.tagline, language: site.language, domain: site.domain,
        logoUrl: site.logoUrl, faviconUrl: site.faviconUrl, theme: { id: site.theme, ...resolveTheme(site.theme, site.themeSettings) },
        contact: { email: s.contactEmail, phone: s.phone, address: s.address }, social: s.social, footerText: s.footerText,
        seo: { titleTemplate: s.seoTitleTemplate, description: s.seoDescription, ogImage: s.ogImage },
        homePageId: site.homePageId,
      });
    }
    case "pages": {
      if (rest.length) {
        const slug = rest.join("/");
        const page = await db.page.findFirst({ where: { ...livePagesWhere(site.id), slug } });
        if (!page) return json({ error: "Página no encontrada" }, 404);
        return json({ ...page, blocks: parseBlocks(page.blocks), isHome: page.id === site.homePageId });
      }
      const pages = await db.page.findMany({
        where: livePagesWhere(site.id),
        select: { id: true, title: true, slug: true, seoTitle: true, seoDescription: true, updatedAt: true },
        orderBy: { title: "asc" },
      });
      return json({ data: pages.map((p) => ({ ...p, isHome: p.id === site.homePageId })) });
    }
    case "posts": {
      if (rest[0]) {
        const post = await db.post.findFirst({ where: { ...livePostsWhere(site.id), slug: rest[0] }, select: { ...postList, content: true, seoTitle: true, seoDescription: true } });
        return post ? json(post) : json({ error: "Entrada no encontrada" }, 404);
      }
      const limit = Math.min(50, Math.max(1, Number(sp.get("limit")) || 10));
      const page = Math.max(1, Number(sp.get("page")) || 1);
      const where: Prisma.PostWhereInput = {
        ...livePostsWhere(site.id),
        ...(sp.get("category") ? { categories: { some: { slug: sp.get("category")! } } } : {}),
        ...(sp.get("tag") ? { tags: { some: { slug: sp.get("tag")! } } } : {}),
      };
      const [data, total] = await Promise.all([
        db.post.findMany({ where, select: postList, orderBy: { publishedAt: "desc" }, skip: (page - 1) * limit, take: limit }),
        db.post.count({ where }),
      ]);
      return json({ data, meta: { page, limit, total, pages: Math.ceil(total / limit) } });
    }
    case "categories":
      return json({ data: await db.category.findMany({ where: { siteId: site.id }, select: { name: true, slug: true, description: true }, orderBy: { name: "asc" } }) });
    case "tags":
      return json({ data: await db.tag.findMany({ where: { siteId: site.id }, select: { name: true, slug: true }, orderBy: { name: "asc" } }) });
    case "menus": {
      const menus = await db.menu.findMany({ where: { siteId: site.id } });
      return json(Object.fromEntries(menus.map((m) => [m.location, m.items])));
    }
    case "forms": {
      if (!rest[0]) return json({ data: await db.form.findMany({ where: { siteId: site.id }, select: { name: true, slug: true } }) });
      const form = await db.form.findFirst({ where: { siteId: site.id, slug: rest[0] } });
      if (!form) return json({ error: "Formulario no encontrado" }, 404);
      return json({ name: form.name, slug: form.slug, fields: parseFields(form.fields), submitLabel: form.submitLabel, successMessage: form.successMessage });
    }
    case "media": {
      const media = await db.media.findMany({ where: { siteId: site.id }, select: { url: true, originalName: true, mimeType: true, width: true, height: true, alt: true, size: true }, orderBy: { createdAt: "desc" }, take: 200 });
      return json({ data: media });
    }
  }
  return json({ error: "Recurso no encontrado" }, 404);
}

export async function POST(req: Request, { params }: { params: Promise<{ path?: string[] }> }) {
  const site = await authenticate(req);
  if (!site) return json({ error: "Clave API no válida" }, 401);
  const [resource, slug] = (await params).path ?? [];
  if (resource !== "forms" || !slug) return json({ error: "Recurso no encontrado" }, 404);
  let input: Record<string, unknown>;
  try {
    input = await req.json();
  } catch {
    return json({ error: "JSON no válido" }, 400);
  }
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() || "api";
  const res = await handleSubmission({ siteId: site.id, slug }, input, { ip, userAgent: req.headers.get("user-agent") });
  return json(res.body, res.status);
}
