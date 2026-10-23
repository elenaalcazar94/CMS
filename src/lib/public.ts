import "server-only";
import { cache } from "react";
import type { Prisma, Site } from "@prisma/client";
import { db } from "./db";
import { parseBlocks, type Block } from "./blocks";
import { parseFields, type PublicForm } from "./forms";
import { parseSettings } from "./settings";
import { getSiteAccess } from "./auth";
import type { PostCard, RenderCtx } from "@/components/site/Blocks";

export function livePostsWhere(siteId: string): Prisma.PostWhereInput {
  return { siteId, status: "PUBLISHED", publishedAt: { lte: new Date() } };
}

export function livePagesWhere(siteId: string): Prisma.PageWhereInput {
  return { siteId, status: "PUBLISHED", OR: [{ publishedAt: null }, { publishedAt: { lte: new Date() } }] };
}

/** ¿Puede ver borradores? Solo usuarios con acceso al sitio y ?preview=1 */
export async function canPreview(siteId: string, preview: boolean) {
  if (!preview) return false;
  return !!(await getSiteAccess(siteId));
}

export const getPage = cache(async (site: Site, slug: string | null, preview: boolean) => {
  const allowDraft = await canPreview(site.id, preview);
  const where: Prisma.PageWhereInput = slug === null
    ? site.homePageId ? { id: site.homePageId } : { siteId: site.id, slug: "inicio" }
    : { siteId: site.id, slug };
  const page = await db.page.findFirst({ where: allowDraft ? where : { AND: [where, livePagesWhere(site.id)] } });
  if (!page && slug === null && !site.homePageId) {
    // Sin portada configurada: la primera página publicada
    return db.page.findFirst({ where: livePagesWhere(site.id), orderBy: { createdAt: "asc" } });
  }
  return page;
});

export function toPostCard(p: { id: string; title: string; slug: string; excerpt: string; coverUrl: string | null; publishedAt: Date | null }): PostCard {
  return { id: p.id, title: p.title, slug: p.slug, excerpt: p.excerpt, coverUrl: p.coverUrl, publishedAt: p.publishedAt?.toISOString() ?? null };
}

const cardSelect = { id: true, title: true, slug: true, excerpt: true, coverUrl: true, publishedAt: true } as const;

export async function buildRenderCtx(site: Site, blocks: Block[], base: string, editing = false): Promise<RenderCtx> {
  const settings = parseSettings(site.settings);
  const formIds = blocks.filter((b) => b.type === "form" && b.data.formId).map((b) => b.data.formId as string);
  const needPosts = blocks.some((b) => b.type === "latestPosts");
  const [forms, posts] = await Promise.all([
    formIds.length ? db.form.findMany({ where: { siteId: site.id, id: { in: formIds } } }) : [],
    needPosts ? db.post.findMany({ where: livePostsWhere(site.id), orderBy: { publishedAt: "desc" }, take: 12, select: cardSelect }) : [],
  ]);
  const formMap: Record<string, PublicForm> = {};
  for (const f of forms) {
    formMap[f.id] = { id: f.id, fields: parseFields(f.fields), submitLabel: f.submitLabel, successMessage: f.successMessage };
  }
  return { base, blogPath: `/${settings.blogSlug}`, forms: formMap, posts: posts.map(toPostCard), editing };
}

export { parseBlocks, cardSelect };
