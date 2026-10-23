/* eslint-disable @next/next/no-img-element */
import { Check, ImageIcon } from "lucide-react";
import type { Block } from "@/lib/blocks";
import { videoEmbedUrl } from "@/lib/blocks";
import type { PublicForm } from "@/lib/forms";
import { Icon } from "../Icon";
import { Gallery } from "./Gallery";
import { FormBlock } from "./FormBlock";

export type PostCard = {
  id: string;
  title: string;
  slug: string;
  excerpt: string;
  coverUrl: string | null;
  publishedAt: string | null;
};

export type RenderCtx = {
  base: string;
  blogPath: string;
  forms: Record<string, PublicForm>;
  posts: PostCard[];
  editing?: boolean;
};

export function href(base: string, url?: string) {
  if (!url) return "#";
  if (url.startsWith("/") && !url.startsWith("//")) return `${base}${url}` || "/";
  return url;
}

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase()).join("");
}

function fmtDate(d: string | null) {
  return d ? new Intl.DateTimeFormat("es-ES", { day: "numeric", month: "long", year: "numeric" }).format(new Date(d)) : "";
}

function Section({ block, children, className = "" }: { block: Block; children: React.ReactNode; className?: string }) {
  const d = block.data;
  return (
    <section id={d._anchor || undefined} className={`nx-section nx-bg-${d._bg || "none"} nx-sp-${d._spacing || "md"} ${className}`}>
      {children}
    </section>
  );
}

function Head({ title, subtitle, center = true }: { title?: string; subtitle?: string; center?: boolean }) {
  if (!title && !subtitle) return null;
  return (
    <div className={`nx-section-head ${center ? "nx-center" : ""}`}>
      {title && <h2>{title}</h2>}
      {subtitle && <p className="nx-sub">{subtitle}</p>}
    </div>
  );
}

function Btn({ text, url, base, secondary }: { text?: string; url?: string; base: string; secondary?: boolean }) {
  if (!text) return null;
  return (
    <a className={`nx-btn ${secondary ? "nx-btn-secondary" : ""}`} href={href(base, url)}>
      {text}
    </a>
  );
}

function Empty({ label, show }: { label: string; show?: boolean }) {
  if (!show) return null;
  return (
    <div className="nx-img-empty">
      <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <ImageIcon size={18} /> {label}
      </span>
    </div>
  );
}

export function RenderBlock({ block, ctx }: { block: Block; ctx: RenderCtx }) {
  const d = block.data;
  const base = ctx.base;

  switch (block.type) {
    case "hero": {
      const layout = d.layout || "split";
      const btns = (d.primaryText || d.secondaryText) && (
        <div className="nx-btns">
          <Btn text={d.primaryText} url={d.primaryUrl} base={base} />
          <Btn text={d.secondaryText} url={d.secondaryUrl} base={base} secondary />
        </div>
      );
      const text = (
        <div className="nx-reveal">
          {d.eyebrow && <span className="nx-eyebrow">{d.eyebrow}</span>}
          <h1 style={{ whiteSpace: "pre-line" }}>{d.title}</h1>
          {d.subtitle && <p className="nx-sub" style={{ marginBottom: "1.8em", whiteSpace: "pre-line" }}>{d.subtitle}</p>}
          {btns}
        </div>
      );
      if (layout === "background") {
        return (
          <Section block={block} className="nx-hero-bg">
            <div className="nx-hero-bg-img" style={{ position: "absolute", inset: 0, backgroundImage: `linear-gradient(180deg, rgba(0,0,0,.35), rgba(0,0,0,.62))${d.image ? `, url("${encodeURI(d.image)}")` : ""}`, backgroundColor: "#2a2a2a", backgroundSize: "cover", backgroundPosition: "center" }} />
            <div className="nx-container" style={{ position: "relative" }}>
              <div style={{ maxWidth: 760 }}>{text}</div>
            </div>
          </Section>
        );
      }
      const img = (
        <div className="nx-hero-img">
          {d.image ? <img src={d.image} alt="" /> : <div className="nx-hero-placeholder"><ImageIcon size={36} /></div>}
        </div>
      );
      if (layout === "center") {
        return (
          <Section block={block}>
            <div className="nx-container">
              <div className="nx-hero-center">{text}</div>
              {d.image && <div style={{ maxWidth: 1080, margin: "0 auto" }} className="nx-hero-center">{img}</div>}
            </div>
          </Section>
        );
      }
      return (
        <Section block={block}>
          <div className="nx-container nx-hero-split">
            {text}
            {img}
          </div>
        </Section>
      );
    }

    case "heading": {
      const Tag = (["h1", "h2", "h3"].includes(d.level) ? d.level : "h2") as "h1" | "h2" | "h3";
      return (
        <Section block={block}>
          <div className={`nx-container ${d.align === "center" ? "nx-center" : ""}`}>
            <Tag style={{ marginBottom: d.subtitle ? undefined : 0 }}>{d.text}</Tag>
            {d.subtitle && <p className="nx-sub" style={{ marginBottom: 0 }}>{d.subtitle}</p>}
          </div>
        </Section>
      );
    }

    case "text":
      return (
        <Section block={block}>
          <div className="nx-container">
            <div className={`nx-prose ${d.width === "wide" ? "" : "nx-narrow"}`} dangerouslySetInnerHTML={{ __html: d.html || "" }} />
          </div>
        </Section>
      );

    case "buttons":
      return (
        <Section block={block}>
          <div className={`nx-container ${d.align === "center" ? "nx-center" : ""}`}>
            <div className="nx-btns">
              {(d.items ?? []).map((b: { text: string; url: string; style: string }, i: number) => (
                <Btn key={i} text={b.text} url={b.url} base={base} secondary={b.style === "secondary"} />
              ))}
            </div>
          </div>
        </Section>
      );

    case "spacer":
      return (
        <div className="nx-container">
          <div className={`nx-spacer-${d.size || "md"} ${d.line ? "nx-spacer-line" : ""}`} />
        </div>
      );

    case "image": {
      if (!(d.src) && !ctx.editing) return null;
      const img = d.src ? <img src={d.src} alt={d.alt || ""} loading="lazy" /> : <Empty show={ctx.editing} label="Elige una imagen" />;
      const inner = (
        <figure className="nx-figure">
          {d.link ? <a href={href(base, d.link)}>{img}</a> : img}
          {d.caption && <figcaption>{d.caption}</figcaption>}
        </figure>
      );
      if (d.size === "full") return <Section block={block} className="nx-img-full">{inner}</Section>;
      return (
        <Section block={block}>
          <div className={`nx-container ${d.size === "narrow" ? "nx-img-narrow" : ""}`}>{inner}</div>
        </Section>
      );
    }

    case "imageText":
      return (
        <Section block={block}>
          <div className={`nx-container nx-split ${d.imagePosition === "right" ? "reverse" : ""}`}>
            <div className="nx-split-img">
              {d.image ? <img src={d.image} alt="" loading="lazy" /> : <div className="nx-hero-placeholder"><ImageIcon size={32} /></div>}
            </div>
            <div>
              {d.title && <h2>{d.title}</h2>}
              <div className="nx-prose" dangerouslySetInnerHTML={{ __html: d.html || "" }} />
              {d.buttonText && (
                <div className="nx-btns" style={{ marginTop: 28 }}>
                  <Btn text={d.buttonText} url={d.buttonUrl} base={base} />
                </div>
              )}
            </div>
          </div>
        </Section>
      );

    case "gallery":
      if (!(d.images?.length) && !ctx.editing) return null;
      return (
        <Section block={block}>
          <div className="nx-container">
            <Head title={d.title} />
            {d.images?.length ? <Gallery images={d.images} columns={d.columns || "3"} /> : <Empty show={ctx.editing} label="Añade imágenes a la galería" />}
          </div>
        </Section>
      );

    case "logos":
      if (!(d.images?.length) && !ctx.editing) return null;
      return (
        <Section block={block}>
          <div className="nx-container">
            {d.title && <p className="nx-center nx-muted" style={{ marginBottom: 32, fontWeight: 500 }}>{d.title}</p>}
            {d.images?.length ? (
              <div className="nx-logos">
                {d.images.map((img: { src: string; alt?: string }, i: number) => (
                  <img key={i} src={img.src} alt={img.alt ?? ""} loading="lazy" />
                ))}
              </div>
            ) : (
              <Empty show={ctx.editing} label="Añade logotipos" />
            )}
          </div>
        </Section>
      );

    case "video": {
      if (!(d.url) && !ctx.editing) return null;
      const src = videoEmbedUrl(d.url);
      return (
        <Section block={block}>
          <div className="nx-container nx-narrow" style={{ maxWidth: 960 }}>
            {src ? (
              <div className="nx-embed">
                <iframe src={src} title={d.caption || "Vídeo"} allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture" allowFullScreen loading="lazy" />
              </div>
            ) : (
              <Empty show={ctx.editing} label="Pega la URL de un vídeo de YouTube o Vimeo" />
            )}
            {d.caption && <p className="nx-center nx-muted" style={{ marginTop: 12, fontSize: ".9rem" }}>{d.caption}</p>}
          </div>
        </Section>
      );
    }

    case "features":
      return (
        <Section block={block}>
          <div className="nx-container">
            <Head title={d.title} subtitle={d.subtitle} />
            <div className={`nx-grid nx-cols-${d.columns || "3"}`}>
              {(d.items ?? []).map((it: { icon: string; title: string; text: string; url?: string }, i: number) => {
                const body = (
                  <>
                    <div className="nx-icon"><Icon name={it.icon} size={24} /></div>
                    <h3>{it.title}</h3>
                    <p>{it.text}</p>
                  </>
                );
                return it.url ? (
                  <a key={i} className="nx-card" href={href(base, it.url)}>{body}</a>
                ) : (
                  <div key={i} className="nx-card">{body}</div>
                );
              })}
            </div>
          </div>
        </Section>
      );

    case "stats":
      return (
        <Section block={block}>
          <div className="nx-container nx-stats">
            {(d.items ?? []).map((it: { value: string; label: string }, i: number) => (
              <div key={i}>
                <div className="nx-stat-value">{it.value}</div>
                <div className="nx-stat-label">{it.label}</div>
              </div>
            ))}
          </div>
        </Section>
      );

    case "testimonials": {
      const items = d.items ?? [];
      return (
        <Section block={block}>
          <div className="nx-container">
            <Head title={d.title} />
            <div className={`nx-grid nx-cols-${Math.min(Math.max(items.length, 1), 3)}`}>
              {items.map((it: { quote: string; author: string; role: string; avatar: string }, i: number) => (
                <div key={i} className="nx-card">
                  <p className="nx-quote">{it.quote}</p>
                  <div className="nx-person">
                    {it.avatar ? <img className="nx-avatar" src={it.avatar} alt="" /> : <div className="nx-avatar">{initials(it.author || "?")}</div>}
                    <div>
                      <strong>{it.author}</strong>
                      {it.role && <span>{it.role}</span>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Section>
      );
    }

    case "team": {
      const items = d.items ?? [];
      return (
        <Section block={block}>
          <div className="nx-container">
            <Head title={d.title} />
            <div className={`nx-grid nx-cols-${Math.min(Math.max(items.length, 2), 4)}`}>
              {items.map((it: { photo: string; name: string; role: string }, i: number) => (
                <div key={i} className="nx-member">
                  <div className="nx-member-photo">{it.photo ? <img src={it.photo} alt={it.name} loading="lazy" /> : initials(it.name || "?")}</div>
                  <h3>{it.name}</h3>
                  <p className="nx-muted" style={{ margin: 0 }}>{it.role}</p>
                </div>
              ))}
            </div>
          </div>
        </Section>
      );
    }

    case "pricing": {
      const items = d.items ?? [];
      return (
        <Section block={block}>
          <div className="nx-container">
            <Head title={d.title} subtitle={d.subtitle} />
            <div className={`nx-grid nx-cols-${Math.min(Math.max(items.length, 1), 4)}`} style={{ alignItems: "stretch" }}>
              {items.map(
                (
                  it: { name: string; price: string; period: string; features: string; buttonText: string; buttonUrl: string; highlighted: boolean },
                  i: number,
                ) => (
                  <div key={i} className={`nx-card nx-plan ${it.highlighted ? "hl" : ""}`}>
                    {it.highlighted && <span className="nx-plan-badge">Recomendado</span>}
                    <h3>{it.name}</h3>
                    <div className="nx-price">
                      {it.price} <span>{it.period}</span>
                    </div>
                    <ul>
                      {(it.features || "").split("\n").filter(Boolean).map((f, j) => (
                        <li key={j}><Check size={16} /> {f}</li>
                      ))}
                    </ul>
                    {it.buttonText && <Btn text={it.buttonText} url={it.buttonUrl} base={base} secondary={!it.highlighted} />}
                  </div>
                ),
              )}
            </div>
          </div>
        </Section>
      );
    }

    case "faq":
      return (
        <Section block={block}>
          <div className="nx-container nx-narrow">
            <Head title={d.title} />
            <div className="nx-faq">
              {(d.items ?? []).map((it: { question: string; answer: string }, i: number) => (
                <details key={i} open={ctx.editing && i === 0}>
                  <summary>{it.question}</summary>
                  <div>{it.answer}</div>
                </details>
              ))}
            </div>
          </div>
        </Section>
      );

    case "cta":
      return (
        <Section block={block}>
          <div className="nx-container nx-cta">
            <h2>{d.title}</h2>
            {d.text && <p>{d.text}</p>}
            <div className="nx-btns">
              <Btn text={d.buttonText} url={d.buttonUrl} base={base} />
            </div>
          </div>
        </Section>
      );

    case "form": {
      const form = ctx.forms[d.formId];
      return (
        <Section block={block}>
          <div className="nx-container nx-narrow" style={{ maxWidth: 720 }}>
            <Head title={d.title} subtitle={d.text} />
            {form ? <FormBlock form={form} preview={ctx.editing} /> : <Empty show={ctx.editing} label="Elige un formulario en el panel de la derecha" />}
          </div>
        </Section>
      );
    }

    case "latestPosts": {
      const posts = ctx.posts.slice(0, Number(d.count) || 3);
      return (
        <Section block={block}>
          <div className="nx-container">
            {d.title && (
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "end", gap: 16, marginBottom: 36, flexWrap: "wrap" }}>
                <h2 style={{ margin: 0 }}>{d.title}</h2>
                <a href={`${base}${ctx.blogPath}`} style={{ color: "var(--c-primary)", fontWeight: 600, textDecoration: "none" }}>Ver todas →</a>
              </div>
            )}
            {posts.length ? (
              <div className="nx-grid nx-cols-3" style={{ gap: 32 }}>
                {posts.map((p) => (
                  <PostCardView key={p.id} post={p} base={base} blogPath={ctx.blogPath} showExcerpt={d.showExcerpt} />
                ))}
              </div>
            ) : (
              <p className="nx-empty">Todavía no hay entradas publicadas.</p>
            )}
          </div>
        </Section>
      );
    }

    case "map": {
      const h = Number(d.height) || 380;
      return (
        <Section block={block}>
          <div className="nx-container">
            <div className="nx-map">
              {ctx.editing ? (
                <div className="nx-hero-placeholder" style={{ height: h }}>Mapa: {d.address}</div>
              ) : (
                <iframe height={h} loading="lazy" title={`Mapa: ${d.address}`} src={`https://maps.google.com/maps?q=${encodeURIComponent(d.address || "")}&output=embed`} />
              )}
            </div>
          </div>
        </Section>
      );
    }

    case "html":
      return (
        <Section block={block}>
          <div className="nx-container" dangerouslySetInnerHTML={{ __html: d.code || "" }} />
        </Section>
      );

    default:
      return null;
  }
}

export function PostCardView({ post, base, blogPath, showExcerpt = true }: { post: PostCard; base: string; blogPath: string; showExcerpt?: boolean }) {
  return (
    <a className="nx-post-card" href={`${base}${blogPath}/${post.slug}`}>
      <div className="nx-post-img">{post.coverUrl ? <img src={post.coverUrl} alt="" loading="lazy" /> : <div className="nx-hero-placeholder"><ImageIcon size={28} /></div>}</div>
      <div className="nx-post-meta">{fmtDate(post.publishedAt)}</div>
      <h3>{post.title}</h3>
      {showExcerpt && post.excerpt && <p className="nx-muted" style={{ margin: 0 }}>{post.excerpt}</p>}
    </a>
  );
}

export function RenderBlocks({ blocks, ctx }: { blocks: Block[]; ctx: RenderCtx }) {
  return (
    <>
      {blocks.map((b) => (
        <RenderBlock key={b.id} block={b} ctx={ctx} />
      ))}
    </>
  );
}
