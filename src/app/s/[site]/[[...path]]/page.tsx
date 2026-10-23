/* eslint-disable @next/next/no-img-element */
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import type { Prisma, Site } from "@prisma/client";
import { db } from "@/lib/db";
import { resolveSite, siteBase, publicSiteUrl } from "@/lib/site";
import { parseSettings, type SiteSettings } from "@/lib/settings";
import { buildRenderCtx, canPreview, cardSelect, getPage, livePostsWhere, parseBlocks, toPostCard } from "@/lib/public";
import { RenderBlocks, PostCardView } from "@/components/site/Blocks";
import { stripHtml } from "@/lib/utils";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ site: string; path?: string[] }>;
  searchParams: Promise<Record<string, string | undefined>>;
};

type Route =
  | { kind: "page"; slug: string | null }
  | { kind: "blog"; category?: string; tag?: string }
  | { kind: "post"; slug: string };

function route(path: string[] | undefined, s: SiteSettings): Route {
  const parts = (path ?? []).map(decodeURIComponent);
  if (!parts.length) return { kind: "page", slug: null };
  if (s.blogEnabled && parts[0] === s.blogSlug) {
    if (parts.length === 1) return { kind: "blog" };
    if (parts[1] === "categoria" && parts[2]) return { kind: "blog", category: parts[2] };
    if (parts[1] === "etiqueta" && parts[2]) return { kind: "blog", tag: parts[2] };
    if (parts.length === 2) return { kind: "post", slug: parts[1] };
  }
  return { kind: "page", slug: parts.join("/") };
}

async function getPost(site: Site, slug: string, preview: boolean) {
  const allowDraft = await canPreview(site.id, preview);
  return db.post.findFirst({
    where: allowDraft ? { siteId: site.id, slug } : { ...livePostsWhere(site.id), slug },
    include: { categories: true, tags: true, author: { select: { name: true } } },
  });
}

function title(s: SiteSettings, siteName: string, t: string) {
  return (s.seoTitleTemplate || "%s | {site}").replace("%s", t).replace("{site}", siteName);
}

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const { site: param, path } = await params;
  const preview = (await searchParams).preview === "1";
  const site = await resolveSite(param);
  if (!site) return {};
  const s = parseSettings(site.settings);
  const r = route(path, s);
  const canonicalBase = publicSiteUrl(site);

  if (r.kind === "page") {
    const page = await getPage(site, r.slug, preview);
    if (!page) return {};
    const isHome = r.slug === null || page.id === site.homePageId;
    return {
      title: { absolute: page.seoTitle || (isHome ? site.name : title(s, site.name, page.title)) },
      description: page.seoDescription || s.seoDescription || site.tagline || undefined,
      robots: page.noindex ? { index: false } : undefined,
      alternates: { canonical: `${canonicalBase}${isHome ? "/" : `/${page.slug}`}` },
      openGraph: { title: page.seoTitle || page.title, images: page.ogImage || s.ogImage ? [page.ogImage || s.ogImage] : undefined },
    };
  }
  if (r.kind === "post") {
    const post = await getPost(site, r.slug, preview);
    if (!post) return {};
    return {
      title: { absolute: post.seoTitle || title(s, site.name, post.title) },
      description: post.seoDescription || post.excerpt || stripHtml(post.content).slice(0, 160),
      robots: post.noindex ? { index: false } : undefined,
      alternates: { canonical: `${canonicalBase}/${s.blogSlug}/${post.slug}` },
      openGraph: { type: "article", title: post.title, images: post.coverUrl ? [post.coverUrl] : undefined, publishedTime: post.publishedAt?.toISOString() },
    };
  }
  return { title: { absolute: title(s, site.name, s.blogTitle) } };
}

export default async function PublicPage({ params, searchParams }: Props) {
  const { site: param, path } = await params;
  const sp = await searchParams;
  const preview = sp.preview === "1";
  const site = await resolveSite(param);
  if (!site) notFound();
  const s = parseSettings(site.settings);
  const base = await siteBase(param);
  const r = route(path, s);

  if (r.kind === "page") {
    const page = await getPage(site, r.slug, preview);
    if (!page) notFound();
    // La portada no se sirve duplicada en /slug
    const blocks = parseBlocks(page.blocks);
    const ctx = await buildRenderCtx(site, blocks, base);
    return (
      <>
        {page.status !== "PUBLISHED" && <PreviewBar />}
        {blocks.length ? <RenderBlocks blocks={blocks} ctx={ctx} /> : (
          <section className="nx-section nx-sp-lg"><div className="nx-container nx-narrow"><h1>{page.title}</h1></div></section>
        )}
      </>
    );
  }

  if (r.kind === "post") {
    const post = await getPost(site, r.slug, preview);
    if (!post) notFound();
    const blogBase = `${base}/${s.blogSlug}`;
    const related = await db.post.findMany({
      where: { ...livePostsWhere(site.id), id: { not: post.id }, categories: post.categories.length ? { some: { id: { in: post.categories.map((c) => c.id) } } } : undefined },
      orderBy: { publishedAt: "desc" },
      take: 3,
      select: cardSelect,
    });
    return (
      <article>
        {(post.status !== "PUBLISHED" || !post.publishedAt || post.publishedAt > new Date()) && <PreviewBar />}
        <section className="nx-section nx-sp-md">
          <div className="nx-container">
            <header className="nx-article-head nx-reveal">
              <div className="nx-post-meta" style={{ justifyContent: "center" }}>
                {post.categories.map((c) => (
                  <a key={c.id} className="nx-chip" href={`${blogBase}/categoria/${c.slug}`}>{c.name}</a>
                ))}
              </div>
              <h1>{post.title}</h1>
              <p className="nx-muted" style={{ margin: 0 }}>
                {post.publishedAt && new Intl.DateTimeFormat("es-ES", { dateStyle: "long" }).format(post.publishedAt)}
                {post.author?.name && ` · ${post.author.name}`}
              </p>
            </header>
            {post.coverUrl && <div className="nx-article-cover"><img src={post.coverUrl} alt="" /></div>}
            <div className="nx-prose nx-narrow" dangerouslySetInnerHTML={{ __html: post.content }} />
            {post.tags.length > 0 && (
              <div className="nx-narrow" style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 40 }}>
                {post.tags.map((t) => (
                  <a key={t.id} className="nx-chip" href={`${blogBase}/etiqueta/${t.slug}`}>#{t.name}</a>
                ))}
              </div>
            )}
          </div>
        </section>
        {related.length > 0 && (
          <section className="nx-section nx-sp-md nx-bg-surface">
            <div className="nx-container">
              <h2>También te puede interesar</h2>
              <div className="nx-grid nx-cols-3" style={{ gap: 32, marginTop: 32 }}>
                {related.map((p) => <PostCardView key={p.id} post={toPostCard(p)} base={base} blogPath={`/${s.blogSlug}`} />)}
              </div>
            </div>
          </section>
        )}
      </article>
    );
  }

  // Listado del blog
  const pageNum = Math.max(1, Number(sp.p) || 1);
  const perPage = s.postsPerPage || 9;
  const where: Prisma.PostWhereInput = {
    ...livePostsWhere(site.id),
    ...(r.category ? { categories: { some: { slug: r.category } } } : {}),
    ...(r.tag ? { tags: { some: { slug: r.tag } } } : {}),
  };
  const [posts, total, categories] = await Promise.all([
    db.post.findMany({ where, orderBy: { publishedAt: "desc" }, skip: (pageNum - 1) * perPage, take: perPage, select: cardSelect }),
    db.post.count({ where }),
    db.category.findMany({ where: { siteId: site.id, posts: { some: livePostsWhere(site.id) } }, orderBy: { name: "asc" } }),
  ]);
  const pages = Math.ceil(total / perPage);
  const blogBase = `${base}/${s.blogSlug}`;
  const current = r.category ? categories.find((c) => c.slug === r.category) : null;
  const listUrl = r.category ? `${blogBase}/categoria/${r.category}` : r.tag ? `${blogBase}/etiqueta/${r.tag}` : blogBase;

  return (
    <section className="nx-section nx-sp-md">
      <div className="nx-container">
        <div className="nx-section-head nx-center">
          <h1>{current ? current.name : r.tag ? `#${r.tag}` : s.blogTitle}</h1>
          {current?.description && <p className="nx-sub">{current.description}</p>}
          {categories.length > 0 && (
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "center", marginTop: 24 }}>
              <a href={blogBase} className={`nx-chip ${!r.category && !r.tag ? "active" : ""}`}>Todas</a>
              {categories.map((c) => (
                <a key={c.id} href={`${blogBase}/categoria/${c.slug}`} className={`nx-chip ${r.category === c.slug ? "active" : ""}`}>{c.name}</a>
              ))}
            </div>
          )}
        </div>
        {posts.length ? (
          <div className="nx-grid nx-cols-3" style={{ gap: "48px 32px" }}>
            {posts.map((p) => <PostCardView key={p.id} post={toPostCard(p)} base={base} blogPath={`/${s.blogSlug}`} />)}
          </div>
        ) : (
          <p className="nx-empty">Todavía no hay entradas publicadas.</p>
        )}
        {pages > 1 && (
          <nav className="nx-pagination" aria-label="Paginación">
            {Array.from({ length: pages }, (_, i) => i + 1).map((n) =>
              n === pageNum ? <span key={n}>{n}</span> : <a key={n} href={n === 1 ? listUrl : `${listUrl}?p=${n}`}>{n}</a>,
            )}
          </nav>
        )}
      </div>
    </section>
  );
}

function PreviewBar() {
  return (
    <div style={{ background: "#fef3c7", color: "#78350f", textAlign: "center", padding: "8px 16px", fontSize: 14, fontWeight: 500 }}>
      Vista previa: este contenido aún no está publicado.
    </div>
  );
}
