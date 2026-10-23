"use client";
import { useCallback, useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Eye, Loader2, Settings2, X, History, Plus } from "lucide-react";
import { savePost, restoreRevision, quickCategory, type PostInput } from "@/app/actions/content";
import { cn, formatDateTime, timeAgo, slugify } from "@/lib/utils";
import { toast } from "../toast";
import { Switch } from "../client";
import { RichText } from "../RichText";
import { ImageField } from "../MediaLibrary";

type Props = {
  siteId: string;
  post: PostInput & { id: string };
  categories: { id: string; name: string }[];
  blogUrl: string;
  previewUrl: string;
  revisions: { id: string; createdAt: string; author: string | null }[];
};

function toLocalInput(iso: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border-b border-zinc-100 px-4 py-4 last:border-0">
      <h3 className="mb-3 text-[13px] font-semibold text-zinc-900">{title}</h3>
      {children}
    </section>
  );
}

export function PostEditor({ siteId, post: initial, categories: initialCats, blogUrl, previewUrl, revisions }: Props) {
  const router = useRouter();
  const [post, setPost] = useState(initial);
  const [cats, setCats] = useState(initialCats);
  const [newCat, setNewCat] = useState("");
  const [tagInput, setTagInput] = useState("");
  const [dirty, setDirty] = useState(false);
  const [saving, start] = useTransition();
  const [panel, setPanel] = useState(false);

  const update = (p: Partial<PostInput>) => {
    setPost((x) => ({ ...x, ...p }));
    setDirty(true);
  };

  const save = useCallback(
    (status?: "DRAFT" | "PUBLISHED") =>
      start(async () => {
        const st = status ?? post.status;
        const r = await savePost(siteId, post.id, { ...post, status: st });
        if (r.error) return toast.error(r.error);
        toast(r.message || "Guardado");
        setPost((x) => ({ ...x, status: st }));
        setDirty(false);
        router.refresh();
      }),
    [post, siteId, router],
  );

  useEffect(() => {
    const on = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        save();
      }
    };
    window.addEventListener("keydown", on);
    return () => window.removeEventListener("keydown", on);
  }, [save]);

  useEffect(() => {
    if (!dirty) return;
    const h = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", h);
    return () => window.removeEventListener("beforeunload", h);
  }, [dirty]);

  const addTag = () => {
    const parts = tagInput.split(",").map((t) => t.trim()).filter(Boolean);
    if (parts.length) update({ tags: Array.from(new Set([...post.tags, ...parts])) });
    setTagInput("");
  };

  const isPublished = post.status === "PUBLISHED";
  const future = post.publishedAt && new Date(post.publishedAt) > new Date();
  const words = post.content.replace(/<[^>]+>/g, " ").split(/\s+/).filter(Boolean).length;
  const slugPreview = post.slug || slugify(post.title) || "…";

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-white">
      <header className="flex h-14 shrink-0 items-center gap-2 border-b border-zinc-200 px-2 sm:px-3">
        <Link href={`/admin/s/${siteId}/posts`} className="btn-icon btn-ghost" onClick={(e) => { if (dirty && !confirm("Hay cambios sin guardar. ¿Salir de todas formas?")) e.preventDefault(); }}>
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div className="flex min-w-0 flex-1 items-center gap-2 text-xs text-zinc-500">
          <span className={cn("h-1.5 w-1.5 rounded-full", isPublished && future ? "bg-sky-500" : isPublished ? "bg-emerald-500" : "bg-zinc-400")} />
          {isPublished && future ? "Programada" : isPublished ? "Publicada" : "Borrador"}
          <span className="hidden sm:inline">· {words} palabras · {Math.max(1, Math.round(words / 220))} min de lectura</span>
          {dirty && <span className="text-amber-600">· Sin guardar</span>}
        </div>
        <a href={previewUrl} target="_blank" rel="noreferrer" className="btn-ghost hidden sm:inline-flex"><Eye className="h-4 w-4" /> Vista previa</a>
        <button className={cn("btn-icon btn-ghost lg:hidden", panel && "bg-zinc-100")} onClick={() => setPanel(!panel)}><Settings2 className="h-4 w-4" /></button>
        {!isPublished && <button className="btn-secondary hidden sm:inline-flex" disabled={saving} onClick={() => save("DRAFT")}>Guardar borrador</button>}
        <button className="btn-primary" disabled={saving} onClick={() => save("PUBLISHED")}>
          {saving && <Loader2 className="h-4 w-4 animate-spin" />}
          {isPublished ? "Actualizar" : future ? "Programar" : "Publicar"}
        </button>
      </header>

      <div className="relative flex min-h-0 flex-1">
        <main className="scrollbar-thin min-w-0 flex-1 overflow-y-auto">
          <div className="mx-auto max-w-[760px] px-5 pb-32 pt-10 sm:px-8">
            <textarea
              value={post.title}
              onChange={(e) => update({ title: e.target.value })}
              placeholder="Título de la entrada"
              rows={1}
              className="w-full resize-none bg-transparent text-3xl font-bold leading-tight tracking-tight outline-none placeholder:text-zinc-300 sm:text-4xl"
              style={{ fieldSizing: "content" } as React.CSSProperties}
              autoFocus={!post.title}
            />
            <div className="mt-6">
              <RichText value={post.content} onChange={(content) => update({ content })} siteId={siteId} full placeholder="Empieza a escribir tu historia…" />
            </div>
          </div>
        </main>

        <aside className={cn("scrollbar-thin absolute inset-y-0 right-0 z-10 w-80 overflow-y-auto border-l border-zinc-200 bg-zinc-50/50 shadow-pop lg:static lg:block lg:shadow-none", panel ? "block bg-white" : "hidden")}>
          <div className="flex items-center justify-between px-4 pt-3 lg:hidden">
            <span className="text-sm font-semibold">Ajustes</span>
            <button className="btn-icon btn-ghost" onClick={() => setPanel(false)}><X className="h-4 w-4" /></button>
          </div>
          <Section title="Publicación">
            <label className="label">Fecha de publicación</label>
            <input type="datetime-local" className="input" value={toLocalInput(post.publishedAt)} onChange={(e) => update({ publishedAt: e.target.value ? new Date(e.target.value).toISOString() : null })} />
            <p className="help">Pon una fecha futura para programarla.</p>
            {isPublished && <button className="btn-secondary btn-sm mt-3 w-full" onClick={() => save("DRAFT")}>Pasar a borrador</button>}
          </Section>
          <Section title="Imagen destacada">
            <ImageField siteId={siteId} value={post.coverUrl ?? ""} onChange={(coverUrl) => update({ coverUrl })} />
          </Section>
          <Section title="URL">
            <div className="flex items-center overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-sm focus-within:border-brand-500">
              <span className="pl-3 text-xs text-zinc-400">/</span>
              <input className="w-full px-1.5 py-2 text-sm outline-none" value={post.slug} placeholder={slugify(post.title) || "url-de-la-entrada"} onChange={(e) => update({ slug: e.target.value })} />
            </div>
            <p className="help break-all">{blogUrl.replace(/^https?:\/\//, "")}/{slugPreview}</p>
          </Section>
          <Section title="Extracto">
            <textarea className="input text-[13px]" value={post.excerpt} onChange={(e) => update({ excerpt: e.target.value })} placeholder="Resumen breve para el listado del blog. Si lo dejas vacío se genera automáticamente." />
          </Section>
          <Section title="Categorías">
            <div className="max-h-44 space-y-1 overflow-y-auto">
              {cats.map((c) => (
                <label key={c.id} className="flex cursor-pointer items-center gap-2 rounded-md px-1 py-1 text-sm hover:bg-zinc-100">
                  <input type="checkbox" className="h-4 w-4 rounded accent-brand-600" checked={post.categoryIds.includes(c.id)} onChange={(e) => update({ categoryIds: e.target.checked ? [...post.categoryIds, c.id] : post.categoryIds.filter((x) => x !== c.id) })} />
                  {c.name}
                </label>
              ))}
              {!cats.length && <p className="text-xs text-zinc-500">Aún no hay categorías.</p>}
            </div>
            <div className="mt-2 flex gap-1.5">
              <input className="input py-1.5 text-[13px]" placeholder="Nueva categoría" value={newCat} onChange={(e) => setNewCat(e.target.value)} onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), (e.currentTarget.nextElementSibling as HTMLButtonElement)?.click())} />
              <button
                className="btn-secondary btn-icon"
                onClick={async () => {
                  const r = await quickCategory(siteId, newCat);
                  if (r.error || !r.category) return toast.error(r.error ?? "Error");
                  setCats((c) => (c.some((x) => x.id === r.category!.id) ? c : [...c, r.category!]));
                  update({ categoryIds: Array.from(new Set([...post.categoryIds, r.category.id])) });
                  setNewCat("");
                }}
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>
          </Section>
          <Section title="Etiquetas">
            <div className="flex flex-wrap gap-1.5 rounded-lg border border-zinc-200 bg-white p-1.5 shadow-sm focus-within:border-brand-500">
              {post.tags.map((t) => (
                <span key={t} className="inline-flex items-center gap-1 rounded-md bg-zinc-100 py-0.5 pl-2 pr-1 text-xs font-medium">
                  {t}
                  <button onClick={() => update({ tags: post.tags.filter((x) => x !== t) })} className="text-zinc-400 hover:text-zinc-800"><X className="h-3 w-3" /></button>
                </span>
              ))}
              <input
                className="min-w-[80px] flex-1 bg-transparent px-1 py-0.5 text-sm outline-none"
                placeholder={post.tags.length ? "" : "Escribe y pulsa Enter"}
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === ",") { e.preventDefault(); addTag(); }
                  if (e.key === "Backspace" && !tagInput && post.tags.length) update({ tags: post.tags.slice(0, -1) });
                }}
                onBlur={addTag}
              />
            </div>
          </Section>
          <Section title="SEO">
            <div className="space-y-3">
              <div>
                <label className="label">Título SEO</label>
                <input className="input" value={post.seoTitle} placeholder={post.title} onChange={(e) => update({ seoTitle: e.target.value })} />
              </div>
              <div>
                <label className="label">Meta descripción</label>
                <textarea className="input text-[13px]" value={post.seoDescription} placeholder={post.excerpt} onChange={(e) => update({ seoDescription: e.target.value })} />
                <p className="help">{post.seoDescription.length}/160</p>
              </div>
              <Switch label="Ocultar de buscadores" checked={post.noindex} onChange={(noindex) => update({ noindex })} />
            </div>
          </Section>
          <Section title="Historial">
            {revisions.length ? (
              <ul className="space-y-0.5">
                {revisions.map((r) => (
                  <li key={r.id} className="flex items-center justify-between rounded-md px-1.5 py-1 text-xs hover:bg-zinc-100">
                    <span title={formatDateTime(r.createdAt)}><History className="mr-1 inline h-3 w-3 text-zinc-400" />{timeAgo(r.createdAt)}{r.author && <span className="text-zinc-500"> · {r.author}</span>}</span>
                    <button className="font-medium text-brand-600 hover:text-brand-800" onClick={async () => {
                      if (!confirm("¿Restaurar esta versión?")) return;
                      const res = await restoreRevision(siteId, r.id);
                      if (res.error) toast.error(res.error); else window.location.reload();
                    }}>Restaurar</button>
                  </li>
                ))}
              </ul>
            ) : <p className="text-xs text-zinc-500">Se guardará una versión cada vez que guardes.</p>}
          </Section>
        </aside>
      </div>
    </div>
  );
}
