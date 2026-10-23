"use server";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { assertSite, AuthError } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { parseBlocks, type Block } from "@/lib/blocks";
import { cleanBlockData, cleanRichText } from "@/lib/sanitize";
import { getTemplate } from "@/lib/templates";
import { slugify, stripHtml } from "@/lib/utils";
import { DEFAULT_CONTACT_FIELDS, parseFields, type FormField } from "@/lib/forms";
import { deleteUpload } from "@/lib/storage";

type Result = { ok?: boolean; error?: string; message?: string; redirect?: string; id?: string };

async function guard(fn: () => Promise<Result>): Promise<Result> {
  try {
    return await fn();
  } catch (e) {
    if (e instanceof AuthError) return { error: e.message };
    if (e && typeof e === "object" && "code" in e && e.code === "P2002") return { error: "Ese slug (URL) ya está en uso. Elige otro." };
    console.error(e);
    return { error: "Ha ocurrido un error inesperado." };
  }
}

const json = (v: unknown) => v as Prisma.InputJsonValue;
const MAX_REVISIONS = 30;

async function uniqueSlug(kind: "page" | "post" | "form", siteId: string, wanted: string, excludeId?: string) {
  const base = slugify(wanted) || kind;
  let slug = base;
  for (let i = 2; ; i++) {
    const where = { siteId, slug, ...(excludeId ? { NOT: { id: excludeId } } : {}) };
    const exists =
      kind === "page" ? await db.page.count({ where }) : kind === "post" ? await db.post.count({ where }) : await db.form.count({ where });
    if (!exists) return slug;
    slug = `${base}-${i}`;
  }
}

async function saveRevision(entityType: "page" | "post", entityId: string, data: unknown, authorId: string) {
  await db.revision.create({ data: { entityType, entityId, data: json(data), authorId } });
  const old = await db.revision.findMany({ where: { entityType, entityId }, orderBy: { createdAt: "desc" }, skip: MAX_REVISIONS, select: { id: true } });
  if (old.length) await db.revision.deleteMany({ where: { id: { in: old.map((r) => r.id) } } });
}

function parseDate(v: unknown) {
  if (!v) return null;
  const d = new Date(String(v));
  return isNaN(d.getTime()) ? null : d;
}

/* --------------------------------------------------------------- Páginas */

export async function createPage(siteId: string, fd: FormData) {
  return guard(async () => {
    const { user } = await assertSite(siteId, "pages.manage");
    const title = String(fd.get("title") ?? "").trim() || "Página sin título";
    const forms = await db.form.findFirst({ where: { siteId }, select: { id: true } });
    const blocks = getTemplate(String(fd.get("template") ?? "blank")).build({ formId: forms?.id });
    const page = await db.page.create({
      data: { siteId, title, slug: await uniqueSlug("page", siteId, String(fd.get("slug") || title)), blocks: json(blocks), authorId: user.id },
    });
    return { ok: true, message: "Página creada", redirect: `/admin/s/${siteId}/pages/${page.id}` };
  });
}

export type PageInput = {
  title: string;
  slug: string;
  blocks: Block[];
  status: "DRAFT" | "PUBLISHED";
  publishedAt?: string | null;
  seoTitle?: string;
  seoDescription?: string;
  ogImage?: string;
  noindex?: boolean;
};

export async function savePage(siteId: string, pageId: string, input: PageInput) {
  return guard(async () => {
    const access = await assertSite(siteId, "pages.edit");
    const page = await db.page.findFirst({ where: { id: pageId, siteId } });
    if (!page) return { error: "La página no existe" };

    let blocks = parseBlocks(input.blocks);
    if (!can(access.role, "html")) {
      // Sin permiso de HTML: se conservan los bloques HTML existentes tal cual y no se permiten nuevos
      const prev = new Map(parseBlocks(page.blocks).filter((b) => b.type === "html").map((b) => [b.id, b]));
      blocks = blocks.flatMap((b) => (b.type !== "html" ? [b] : prev.has(b.id) ? [prev.get(b.id)!] : []));
    }
    blocks = blocks.map((b) => (b.type === "html" ? b : { ...b, data: cleanBlockData(b.data) }));

    const canManage = can(access.role, "pages.manage");
    const slug = canManage && input.slug !== page.slug ? await uniqueSlug("page", siteId, input.slug || input.title, page.id) : page.slug;
    const publishedAt = input.status === "PUBLISHED" ? parseDate(input.publishedAt) ?? page.publishedAt ?? new Date() : parseDate(input.publishedAt);

    await saveRevision("page", page.id, { title: page.title, blocks: page.blocks, seoTitle: page.seoTitle, seoDescription: page.seoDescription }, access.user.id);
    await db.page.update({
      where: { id: page.id },
      data: {
        title: input.title.trim() || "Página sin título",
        slug,
        blocks: json(blocks),
        status: input.status,
        publishedAt,
        seoTitle: input.seoTitle?.trim() || null,
        seoDescription: input.seoDescription?.trim() || null,
        ogImage: input.ogImage || null,
        noindex: !!input.noindex,
      },
    });
    return { ok: true, message: input.status === "PUBLISHED" ? "Página publicada" : "Borrador guardado" };
  });
}

export async function duplicatePage(siteId: string, pageId: string) {
  return guard(async () => {
    const { user } = await assertSite(siteId, "pages.manage");
    const p = await db.page.findFirstOrThrow({ where: { id: pageId, siteId } });
    const copy = await db.page.create({
      data: {
        siteId, title: `${p.title} (copia)`, slug: await uniqueSlug("page", siteId, `${p.slug}-copia`), blocks: json(p.blocks),
        seoTitle: p.seoTitle, seoDescription: p.seoDescription, ogImage: p.ogImage, authorId: user.id,
      },
    });
    return { ok: true, message: "Página duplicada", redirect: `/admin/s/${siteId}/pages/${copy.id}` };
  });
}

export async function deletePage(siteId: string, pageId: string) {
  return guard(async () => {
    await assertSite(siteId, "pages.manage");
    await db.page.deleteMany({ where: { id: pageId, siteId } });
    await db.revision.deleteMany({ where: { entityType: "page", entityId: pageId } });
    return { ok: true, message: "Página eliminada", redirect: `/admin/s/${siteId}/pages` };
  });
}

export async function setHomePage(siteId: string, pageId: string) {
  return guard(async () => {
    await assertSite(siteId, "pages.manage");
    await db.site.update({ where: { id: siteId }, data: { homePageId: pageId } });
    return { ok: true, message: "Portada actualizada" };
  });
}

export async function restoreRevision(siteId: string, revisionId: string) {
  return guard(async () => {
    const access = await assertSite(siteId, "pages.edit");
    const rev = await db.revision.findUniqueOrThrow({ where: { id: revisionId } });
    const data = rev.data as Record<string, unknown>;
    if (rev.entityType === "page") {
      const page = await db.page.findFirstOrThrow({ where: { id: rev.entityId, siteId } });
      await saveRevision("page", page.id, { title: page.title, blocks: page.blocks, seoTitle: page.seoTitle, seoDescription: page.seoDescription }, access.user.id);
      await db.page.update({ where: { id: page.id }, data: { title: String(data.title), blocks: json(data.blocks), seoTitle: (data.seoTitle as string) ?? null, seoDescription: (data.seoDescription as string) ?? null } });
    } else {
      await assertSite(siteId, "posts");
      const post = await db.post.findFirstOrThrow({ where: { id: rev.entityId, siteId } });
      await saveRevision("post", post.id, { title: post.title, content: post.content, excerpt: post.excerpt }, access.user.id);
      await db.post.update({ where: { id: post.id }, data: { title: String(data.title), content: String(data.content), excerpt: String(data.excerpt ?? "") } });
    }
    return { ok: true, message: "Versión restaurada" };
  });
}

/* -------------------------------------------------------------- Entradas */

export async function createPost(siteId: string) {
  return guard(async () => {
    const { user } = await assertSite(siteId, "posts");
    const post = await db.post.create({ data: { siteId, title: "", slug: await uniqueSlug("post", siteId, `borrador-${Date.now().toString(36)}`), authorId: user.id } });
    return { ok: true, message: "", redirect: `/admin/s/${siteId}/posts/${post.id}` };
  });
}

export type PostInput = {
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  coverUrl: string | null;
  status: "DRAFT" | "PUBLISHED";
  publishedAt: string | null;
  categoryIds: string[];
  tags: string[];
  seoTitle: string;
  seoDescription: string;
  noindex: boolean;
};

export async function savePost(siteId: string, postId: string, input: PostInput) {
  return guard(async () => {
    const access = await assertSite(siteId, "posts");
    const post = await db.post.findFirst({ where: { id: postId, siteId } });
    if (!post) return { error: "La entrada no existe" };
    const title = input.title.trim() || "Entrada sin título";
    const wantedSlug = input.slug?.trim() || (post.slug.startsWith("borrador-") ? title : post.slug);
    const slug = wantedSlug !== post.slug ? await uniqueSlug("post", siteId, wantedSlug, post.id) : post.slug;
    const content = cleanRichText(input.content);
    const publishedAt = input.status === "PUBLISHED" ? parseDate(input.publishedAt) ?? post.publishedAt ?? new Date() : parseDate(input.publishedAt);

    const tagNames = Array.from(new Set(input.tags.map((t) => t.trim()).filter(Boolean))).slice(0, 30);
    const tags = await Promise.all(
      tagNames.map((name) =>
        db.tag.upsert({ where: { siteId_slug: { siteId, slug: slugify(name).replace(/\//g, "-") } }, create: { siteId, name, slug: slugify(name).replace(/\//g, "-") }, update: {} }),
      ),
    );
    const categoryIds = (await db.category.findMany({ where: { siteId, id: { in: input.categoryIds } }, select: { id: true } })).map((c) => c.id);

    if (post.content || post.title) await saveRevision("post", post.id, { title: post.title, content: post.content, excerpt: post.excerpt }, access.user.id);
    await db.post.update({
      where: { id: post.id },
      data: {
        title, slug, content,
        excerpt: input.excerpt.trim() || stripHtml(content).slice(0, 180),
        coverUrl: input.coverUrl || null,
        status: input.status,
        publishedAt,
        seoTitle: input.seoTitle.trim() || null,
        seoDescription: input.seoDescription.trim() || null,
        noindex: input.noindex,
        categories: { set: categoryIds.map((id) => ({ id })) },
        tags: { set: tags.map((t) => ({ id: t.id })) },
      },
    });
    const scheduled = input.status === "PUBLISHED" && publishedAt && publishedAt > new Date();
    return { ok: true, message: scheduled ? "Entrada programada" : input.status === "PUBLISHED" ? "Entrada publicada" : "Borrador guardado" };
  });
}

export async function deletePost(siteId: string, postId: string) {
  return guard(async () => {
    await assertSite(siteId, "posts");
    await db.post.deleteMany({ where: { id: postId, siteId } });
    await db.revision.deleteMany({ where: { entityType: "post", entityId: postId } });
    return { ok: true, message: "Entrada eliminada", redirect: `/admin/s/${siteId}/posts` };
  });
}

/* --------------------------------------------------- Categorías y etiquetas */

export async function saveCategory(siteId: string, fd: FormData) {
  return guard(async () => {
    await assertSite(siteId, "posts");
    const name = String(fd.get("name") ?? "").trim();
    if (!name) return { error: "Escribe un nombre" };
    const slug = slugify(String(fd.get("slug") || name)).replace(/\//g, "-");
    const description = String(fd.get("description") ?? "").trim();
    const id = fd.get("id") ? String(fd.get("id")) : null;
    if (id) await db.category.update({ where: { id, siteId }, data: { name, slug, description } });
    else await db.category.create({ data: { siteId, name, slug, description } });
    return { ok: true, message: id ? "Categoría actualizada" : "Categoría creada" };
  });
}

export async function deleteCategory(siteId: string, id: string) {
  return guard(async () => {
    await assertSite(siteId, "posts");
    await db.category.deleteMany({ where: { id, siteId } });
    return { ok: true };
  });
}

export async function deleteTag(siteId: string, id: string) {
  return guard(async () => {
    await assertSite(siteId, "posts");
    await db.tag.deleteMany({ where: { id, siteId } });
    return { ok: true };
  });
}

/* ------------------------------------------------------------------ Medios */

export async function updateMedia(siteId: string, id: string, alt: string) {
  return guard(async () => {
    await assertSite(siteId, "media");
    await db.media.updateMany({ where: { id, siteId }, data: { alt: alt.slice(0, 300) } });
    return { ok: true, message: "Guardado" };
  });
}

export async function deleteMedia(siteId: string, ids: string[]) {
  return guard(async () => {
    await assertSite(siteId, "media");
    const items = await db.media.findMany({ where: { id: { in: ids }, siteId } });
    await db.media.deleteMany({ where: { id: { in: items.map((i) => i.id) } } });
    await Promise.all(items.map((i) => deleteUpload(i.path)));
    return { ok: true, message: items.length === 1 ? "Archivo eliminado" : `${items.length} archivos eliminados` };
  });
}

/* ------------------------------------------------------------------- Menús */

type MenuItem = { id: string; label: string; url: string; button?: boolean; newTab?: boolean; children?: MenuItem[] };

function cleanMenu(items: MenuItem[], depth = 0): MenuItem[] {
  return (Array.isArray(items) ? items : []).slice(0, 40).map((i) => ({
    id: String(i.id),
    label: String(i.label ?? "").slice(0, 80),
    url: String(i.url ?? "").slice(0, 500).replace(/^javascript:/i, ""),
    button: !!i.button,
    newTab: !!i.newTab,
    children: depth === 0 ? cleanMenu(i.children ?? [], 1) : [],
  }));
}

export async function saveMenu(siteId: string, location: string, items: MenuItem[]) {
  return guard(async () => {
    await assertSite(siteId, "menus");
    if (!["header", "footer"].includes(location)) return { error: "Ubicación no válida" };
    const clean = json(cleanMenu(items));
    await db.menu.upsert({ where: { siteId_location: { siteId, location } }, create: { siteId, location, items: clean }, update: { items: clean } });
    return { ok: true, message: "Menú guardado" };
  });
}

/* ----------------------------------------------------------- Formularios */

export async function createForm(siteId: string, fd: FormData) {
  return guard(async () => {
    await assertSite(siteId, "forms");
    const name = String(fd.get("name") ?? "").trim() || "Nuevo formulario";
    const form = await db.form.create({
      data: { siteId, name, slug: await uniqueSlug("form", siteId, name), fields: json(DEFAULT_CONTACT_FIELDS) },
    });
    return { ok: true, message: "Formulario creado", redirect: `/admin/s/${siteId}/forms/${form.id}` };
  });
}

export type FormInput = { name: string; fields: FormField[]; submitLabel: string; successMessage: string; notifyEmails: string };

export async function saveForm(siteId: string, formId: string, input: FormInput) {
  return guard(async () => {
    await assertSite(siteId, "forms");
    const fields = parseFields(input.fields).map((f) => ({
      id: slugify(f.id).replace(/[/-]/g, "_") || `campo_${Math.random().toString(36).slice(2, 6)}`,
      type: f.type, label: f.label.slice(0, 200), placeholder: f.placeholder?.slice(0, 200) ?? "",
      required: !!f.required, options: f.options?.slice(0, 2000) ?? "", width: f.width === "half" ? "half" : "full",
    }));
    const ids = new Set<string>();
    for (const f of fields) {
      if (ids.has(f.id)) return { error: `El identificador «${f.id}» está repetido` };
      ids.add(f.id);
    }
    const emails = input.notifyEmails.split(/[,;\s]+/).filter(Boolean);
    if (emails.some((e) => !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e))) return { error: "Hay algún email de aviso no válido" };
    await db.form.updateMany({
      where: { id: formId, siteId },
      data: { name: input.name.trim() || "Formulario", fields: json(fields), submitLabel: input.submitLabel || "Enviar", successMessage: input.successMessage, notifyEmails: emails.join(", ") },
    });
    return { ok: true, message: "Formulario guardado" };
  });
}

export async function deleteForm(siteId: string, formId: string) {
  return guard(async () => {
    await assertSite(siteId, "forms");
    await db.form.deleteMany({ where: { id: formId, siteId } });
    return { ok: true, message: "Formulario eliminado", redirect: `/admin/s/${siteId}/forms` };
  });
}

/* ---------------------------------------------------------------- Mensajes */

export async function setSubmissionRead(siteId: string, ids: string[], read: boolean) {
  return guard(async () => {
    await assertSite(siteId, "messages");
    await db.formSubmission.updateMany({ where: { id: { in: ids }, form: { siteId } }, data: { read } });
    return { ok: true };
  });
}

export async function deleteSubmissions(siteId: string, ids: string[]) {
  return guard(async () => {
    await assertSite(siteId, "messages");
    await db.formSubmission.deleteMany({ where: { id: { in: ids }, form: { siteId } } });
    return { ok: true, message: "Mensaje eliminado" };
  });
}

export async function quickCategory(siteId: string, name: string) {
  try {
    await assertSite(siteId, "posts");
    const n = name.trim();
    if (!n) return { error: "Escribe un nombre" };
    const slug = slugify(n).replace(/\//g, "-");
    const cat = await db.category.upsert({ where: { siteId_slug: { siteId, slug } }, create: { siteId, name: n, slug }, update: {} });
    return { ok: true, category: { id: cat.id, name: cat.name } };
  } catch (e) {
    return { error: e instanceof AuthError ? e.message : "No se pudo crear la categoría" };
  }
}
