"use server";
import type { Prisma } from "@prisma/client";
import sanitizeHtml from "sanitize-html";
import { db } from "@/lib/db";
import { assertSite, AuthError } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { deleteUpload } from "@/lib/storage";
import { slugify } from "@/lib/utils";
import { htmlPathToSlug, type FieldMap } from "@/lib/custom/shared";

type Result = { ok?: boolean; error?: string; message?: string; redirect?: string };

async function guard(fn: () => Promise<Result>): Promise<Result> {
  try {
    return await fn();
  } catch (e) {
    if (e instanceof AuthError) return { error: e.message };
    if (e && typeof e === "object" && "code" in e && e.code === "P2002") return { error: "Esa URL ya está en uso. Elige otra." };
    console.error(e);
    return { error: "Ha ocurrido un error inesperado." };
  }
}

const json = (v: unknown) => v as Prisma.InputJsonValue;

/** Crea las páginas que falten a partir de los HTML subidos. */
export async function finalizeImport(siteId: string) {
  return guard(async () => {
    const { user } = await assertSite(siteId, "appearance");
    const site = await db.site.findUniqueOrThrow({ where: { id: siteId } });
    const files = await db.templateFile.findMany({ where: { siteId, html: { not: null } }, orderBy: { path: "asc" } });
    let created = 0;
    let homeId = site.homePageId;
    for (const f of files) {
      if (f.path === "404.html" || f.path.split("/").some((p) => p.startsWith("_"))) continue;
      const slug = htmlPathToSlug(f.path) || "inicio";
      let page = await db.page.findUnique({ where: { siteId_slug: { siteId, slug } } });
      if (!page) {
        page = await db.page.create({ data: { siteId, title: f.title || slug, slug, template: f.path, status: "PUBLISHED", publishedAt: new Date(), authorId: user.id } });
        created++;
      } else if (!page.template) {
        page = await db.page.update({ where: { id: page.id }, data: { template: f.path } });
      }
      if (slug === "inicio" && !homeId) homeId = page.id;
    }
    await db.site.update({ where: { id: siteId }, data: { homePageId: homeId, kind: "custom" } });
    return { ok: true, message: created ? `Web importada: ${created} página${created > 1 ? "s" : ""} nueva${created > 1 ? "s" : ""}` : "Archivos actualizados" };
  });
}

export async function deleteTemplateFiles(siteId: string, ids: string[] | "all") {
  return guard(async () => {
    await assertSite(siteId, "appearance");
    const files = await db.templateFile.findMany({ where: { siteId, ...(ids === "all" ? {} : { id: { in: ids } }) } });
    await Promise.all(files.filter((f) => f.storageKey).map((f) => deleteUpload(f.storageKey!).catch(() => {})));
    await db.templateFile.deleteMany({ where: { id: { in: files.map((f) => f.id) } } });
    return { ok: true, message: files.length === 1 ? "Archivo eliminado" : `${files.length} archivos eliminados` };
  });
}

export async function createCustomPage(siteId: string, fd: FormData) {
  return guard(async () => {
    const { user } = await assertSite(siteId, "pages.manage");
    const template = String(fd.get("template") ?? "");
    const tpl = await db.templateFile.findUnique({ where: { siteId_path: { siteId, path: template } } });
    if (!tpl?.html) return { error: "Elige una plantilla" };
    const title = String(fd.get("title") ?? "").trim() || "Página nueva";
    const wanted = slugify(String(fd.get("slug") || title));
    if (!wanted) return { error: "La URL no es válida" };
    if (await db.page.findUnique({ where: { siteId_slug: { siteId, slug: wanted } } })) return { error: `Ya existe una página en /${wanted}` };
    const page = await db.page.create({ data: { siteId, title, slug: wanted, template, authorId: user.id } });
    return { ok: true, message: "Página creada", redirect: `/admin/s/${siteId}/pages/${page.id}` };
  });
}

/* ------------------------------------------------- Limpieza de contenidos */

const RICH = {
  allowedTags: ["b", "strong", "i", "em", "u", "s", "a", "br", "span", "small", "sup", "sub", "mark", "code", "p", "ul", "ol", "li", "h2", "h3", "h4", "blockquote"],
  allowedAttributes: { a: ["href", "target", "rel"], "*": ["class"] },
  allowedSchemes: ["http", "https", "mailto", "tel"],
};

function safeUrl(v: unknown) {
  const s = String(v ?? "").trim().slice(0, 1000);
  return /^(\/|#|https?:|mailto:|tel:)/i.test(s) || /^[\w./-]+$/.test(s) ? s : "";
}

function cleanValue(key: string, v: unknown, depth = 0): unknown {
  if (depth > 3) return null;
  if (typeof v === "string") return key.startsWith("bg:") ? safeUrl(v) : sanitizeHtml(v.slice(0, 20000), RICH);
  if (Array.isArray(v)) return v.slice(0, 200).map((item) => (item && typeof item === "object" ? cleanMap(item as Record<string, unknown>, depth + 1) : {}));
  if (v && typeof v === "object") {
    const o = v as Record<string, unknown>;
    if ("src" in o) return { src: safeUrl(o.src), alt: String(o.alt ?? "").replace(/[<>]/g, "").slice(0, 300) };
    if ("href" in o || "text" in o) return { text: sanitizeHtml(String(o.text ?? ""), RICH), href: safeUrl(o.href), target: o.target === "_blank" ? "_blank" : "" };
  }
  return null;
}

function cleanMap(m: Record<string, unknown>, depth = 0): FieldMap {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(m).slice(0, 1000)) {
    if (k === "_o") {
      if (Number.isInteger(v) && (v as number) >= 0 && (v as number) < 1000) out._o = v;
      continue;
    }
    const val = cleanValue(k.slice(0, 120), v, depth);
    if (val !== null) out[k.slice(0, 120)] = val;
  }
  return out as FieldMap;
}

export type CustomPageInput = {
  title: string;
  slug: string;
  status: "DRAFT" | "PUBLISHED";
  publishedAt: string | null;
  seoTitle: string;
  seoDescription: string;
  ogImage: string;
  noindex: boolean;
  fields: Record<string, unknown>;
  globals: Record<string, unknown>;
};

export async function saveCustomPage(siteId: string, pageId: string, input: CustomPageInput) {
  return guard(async () => {
    const access = await assertSite(siteId, "pages.edit");
    const [site, page] = await Promise.all([
      db.site.findUniqueOrThrow({ where: { id: siteId } }),
      db.page.findFirst({ where: { id: pageId, siteId } }),
    ]);
    if (!page) return { error: "La página no existe" };

    let slug = page.slug;
    const isHome = site.homePageId === page.id;
    if (!isHome && can(access.role, "pages.manage") && input.slug && input.slug !== page.slug) {
      slug = slugify(input.slug);
      if (!slug) return { error: "La URL no es válida" };
      if (await db.page.findFirst({ where: { siteId, slug, NOT: { id: page.id } } })) return { error: `Ya existe una página en /${slug}` };
    }
    const d = input.publishedAt ? new Date(input.publishedAt) : null;
    const publishedAt = input.status === "PUBLISHED" ? (d && !isNaN(d.getTime()) ? d : page.publishedAt ?? new Date()) : d;

    await db.revision.create({ data: { entityType: "page", entityId: page.id, authorId: access.user.id, data: json({ title: page.title, fields: page.fields, custom: true }) } });
    const old = await db.revision.findMany({ where: { entityType: "page", entityId: page.id }, orderBy: { createdAt: "desc" }, skip: 30, select: { id: true } });
    if (old.length) await db.revision.deleteMany({ where: { id: { in: old.map((r) => r.id) } } });

    await db.page.update({
      where: { id: page.id },
      data: {
        title: input.title.trim() || page.title,
        slug,
        fields: json(cleanMap(input.fields)),
        status: input.status,
        publishedAt,
        seoTitle: input.seoTitle.trim() || null,
        seoDescription: input.seoDescription.trim() || null,
        ogImage: safeUrl(input.ogImage) || null,
        noindex: input.noindex,
      },
    });
    const globals = cleanMap(input.globals);
    if (Object.keys(globals).length) {
      await db.site.update({ where: { id: siteId }, data: { globalFields: json({ ...((site.globalFields ?? {}) as object), ...globals }) } });
    }
    const scheduled = input.status === "PUBLISHED" && publishedAt && publishedAt > new Date();
    return { ok: true, message: scheduled ? "Página programada" : input.status === "PUBLISHED" ? "Cambios publicados" : "Borrador guardado" };
  });
}

