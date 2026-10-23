import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireSite } from "@/lib/auth";
import { publicSiteUrl } from "@/lib/site";
import { parseSettings } from "@/lib/settings";
import { PostEditor } from "@/components/admin/editor/PostEditor";

export const metadata = { title: "Editar entrada" };

export default async function EditPost({ params }: { params: Promise<{ siteId: string; postId: string }> }) {
  const { siteId, postId } = await params;
  await requireSite(siteId, "posts");
  const [site, post, categories, revisions] = await Promise.all([
    db.site.findUniqueOrThrow({ where: { id: siteId } }),
    db.post.findFirst({ where: { id: postId, siteId }, include: { categories: { select: { id: true } }, tags: { select: { name: true } } } }),
    db.category.findMany({ where: { siteId }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    db.revision.findMany({ where: { entityType: "post", entityId: postId }, orderBy: { createdAt: "desc" }, take: 15, include: { author: { select: { name: true } } } }),
  ]);
  if (!post) notFound();
  const s = parseSettings(site.settings);
  return (
    <PostEditor
      siteId={siteId}
      post={{
        id: post.id, title: post.title, slug: post.slug.startsWith("borrador-") ? "" : post.slug, excerpt: post.excerpt, content: post.content,
        coverUrl: post.coverUrl, status: post.status, publishedAt: post.publishedAt?.toISOString() ?? null,
        categoryIds: post.categories.map((c) => c.id), tags: post.tags.map((t) => t.name),
        seoTitle: post.seoTitle ?? "", seoDescription: post.seoDescription ?? "", noindex: post.noindex,
      }}
      categories={categories}
      blogUrl={`${publicSiteUrl(site)}/${s.blogSlug}`}
      previewUrl={`/s/${site.slug}/${s.blogSlug}/${post.slug}?preview=1`}
      revisions={revisions.map((r) => ({ id: r.id, createdAt: r.createdAt.toISOString(), author: r.author?.name ?? null }))}
    />
  );
}
