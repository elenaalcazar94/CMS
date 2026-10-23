"use client";
/* eslint-disable @next/next/no-img-element */
import { useCallback, useEffect, useRef, useState } from "react";
import { Upload, Search, FileText, Trash2, Check, Loader2, ImageIcon, X, Copy } from "lucide-react";
import type { Media } from "@prisma/client";
import { cn, formatBytes, formatDate } from "@/lib/utils";
import { deleteMedia, updateMedia } from "@/app/actions/content";
import { toast } from "./toast";
import { Modal } from "./client";

type Item = Pick<Media, "id" | "url" | "originalName" | "mimeType" | "size" | "width" | "height" | "alt"> & { createdAt: string | Date };

export function MediaLibrary({
  siteId, mode = "manage", accept = "all", multiple = false, onPick,
}: {
  siteId: string;
  mode?: "manage" | "pick";
  accept?: "image" | "all";
  multiple?: boolean;
  onPick?: (items: Item[]) => void;
}) {
  const [items, setItems] = useState<Item[]>([]);
  const [next, setNext] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(0);
  const [q, setQ] = useState("");
  const [type, setType] = useState(accept === "image" ? "image" : "");
  const [selected, setSelected] = useState<string[]>([]);
  const [dragging, setDragging] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(
    async (cursor?: string) => {
      setLoading(true);
      const sp = new URLSearchParams({ siteId, ...(q ? { q } : {}), ...(type ? { type } : {}), ...(cursor ? { cursor } : {}) });
      const res = await fetch(`/api/admin/media?${sp}`);
      const json = await res.json();
      setItems((prev) => (cursor ? [...prev, ...json.items] : json.items));
      setNext(json.next);
      setLoading(false);
    },
    [siteId, q, type],
  );

  useEffect(() => {
    const t = setTimeout(() => load(), q ? 250 : 0);
    return () => clearTimeout(t);
  }, [load, q]);

  async function upload(files: FileList | File[]) {
    const list = Array.from(files);
    if (!list.length) return;
    setUploading(list.length);
    const fd = new FormData();
    fd.set("siteId", siteId);
    list.forEach((f) => fd.append("files", f));
    try {
      const res = await fetch("/api/admin/media", { method: "POST", body: fd });
      const json = await res.json();
      if (json.items?.length) {
        setItems((prev) => [...json.items, ...prev]);
        toast(json.items.length === 1 ? "Archivo subido" : `${json.items.length} archivos subidos`);
        if (mode === "pick") setSelected(multiple ? (s) => [...s, ...json.items.map((i: Item) => i.id)] : [json.items[0].id]);
      }
      (json.errors ?? []).forEach((e: string) => toast.error(e));
      if (json.error) toast.error(json.error);
    } catch {
      toast.error("No se pudo subir el archivo");
    }
    setUploading(0);
  }

  function toggle(id: string) {
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : multiple || mode === "manage" ? [...s, id] : [id]));
  }

  const detail = mode === "manage" && selected.length === 1 ? items.find((i) => i.id === selected[0]) : null;

  return (
    <div
      className="relative"
      onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
      onDragLeave={(e) => { if (e.currentTarget === e.target) setDragging(false); }}
      onDrop={(e) => { e.preventDefault(); setDragging(false); upload(e.dataTransfer.files); }}
    >
      {dragging && (
        <div className="pointer-events-none absolute inset-0 z-20 grid place-items-center rounded-xl border-2 border-dashed border-brand-500 bg-brand-50/90">
          <div className="text-center text-brand-700"><Upload className="mx-auto mb-2 h-8 w-8" /><p className="font-semibold">Suelta los archivos para subirlos</p></div>
        </div>
      )}

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative min-w-[200px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
          <input className="input pl-9" placeholder="Buscar archivos…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        {accept === "all" && (
          <select className="input w-auto" value={type} onChange={(e) => setType(e.target.value)}>
            <option value="">Todos</option>
            <option value="image">Imágenes</option>
            <option value="document">Documentos</option>
          </select>
        )}
        <input ref={fileRef} type="file" multiple hidden accept={accept === "image" ? "image/*" : undefined} onChange={(e) => e.target.files && upload(e.target.files)} />
        <button type="button" className="btn-primary" onClick={() => fileRef.current?.click()} disabled={!!uploading}>
          {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
          {uploading ? `Subiendo ${uploading}…` : "Subir archivos"}
        </button>
      </div>

      <div className={cn("flex gap-5", mode === "pick" && "flex-col")}>
        <div className="min-w-0 flex-1">
          {!loading && items.length === 0 ? (
            <button type="button" onClick={() => fileRef.current?.click()} className="flex w-full flex-col items-center justify-center rounded-xl border-2 border-dashed border-zinc-200 px-6 py-16 text-center transition hover:border-brand-400 hover:bg-brand-50/40">
              <div className="mb-3 grid h-12 w-12 place-items-center rounded-2xl bg-brand-50 text-brand-600"><ImageIcon className="h-6 w-6" /></div>
              <p className="font-semibold text-zinc-900">{q ? "No hay resultados" : "Aún no hay archivos"}</p>
              <p className="mt-1 text-sm text-zinc-500">Arrastra archivos aquí o pulsa para subirlos.</p>
            </button>
          ) : (
            <div className={cn("grid gap-3", mode === "pick" ? "grid-cols-3 sm:grid-cols-5" : "grid-cols-2 sm:grid-cols-4 xl:grid-cols-5")}>
              {items.map((it) => {
                const sel = selected.includes(it.id);
                const isImg = it.mimeType.startsWith("image/");
                return (
                  <button
                    key={it.id}
                    type="button"
                    onClick={() => toggle(it.id)}
                    onDoubleClick={() => mode === "pick" && onPick?.([it])}
                    className={cn("group relative aspect-square overflow-hidden rounded-xl border bg-zinc-100 text-left transition", sel ? "border-brand-500 ring-4 ring-brand-500/20" : "border-zinc-200 hover:border-zinc-300")}
                    title={it.originalName}
                  >
                    {isImg ? (
                      <img src={it.url} alt={it.alt} className="h-full w-full object-cover" loading="lazy" style={{ background: "repeating-conic-gradient(#f4f4f5 0% 25%, #fff 0% 50%) 50% / 16px 16px" }} />
                    ) : (
                      <div className="flex h-full flex-col items-center justify-center gap-2 p-3 text-zinc-500">
                        <FileText className="h-8 w-8" />
                        <span className="line-clamp-2 break-all text-center text-[11px]">{it.originalName}</span>
                      </div>
                    )}
                    <span className={cn("absolute right-2 top-2 grid h-5 w-5 place-items-center rounded-full border-2 transition", sel ? "border-brand-600 bg-brand-600 text-white" : "border-white/80 bg-black/10 opacity-0 group-hover:opacity-100")}>
                      {sel && <Check className="h-3 w-3" strokeWidth={3} />}
                    </span>
                  </button>
                );
              })}
              {loading && Array.from({ length: 5 }).map((_, i) => <div key={i} className="aspect-square animate-pulse rounded-xl bg-zinc-100" />)}
            </div>
          )}
          {next && !loading && (
            <div className="mt-5 text-center"><button type="button" className="btn-secondary" onClick={() => load(next)}>Cargar más</button></div>
          )}
        </div>

        {mode === "manage" && (
          <aside className="hidden w-72 shrink-0 lg:block">
            {detail ? (
              <MediaDetail key={detail.id} siteId={siteId} item={detail} onDeleted={(id) => { setItems((x) => x.filter((i) => i.id !== id)); setSelected([]); }} onChange={(alt) => setItems((x) => x.map((i) => (i.id === detail.id ? { ...i, alt } : i)))} />
            ) : selected.length > 1 ? (
              <div className="card card-pad sticky top-6 text-sm">
                <p className="font-semibold">{selected.length} archivos seleccionados</p>
                <div className="mt-4 flex gap-2">
                  <button className="btn-secondary btn-sm" onClick={() => setSelected([])}>Deseleccionar</button>
                  <BulkDelete siteId={siteId} ids={selected} onDone={() => { setItems((x) => x.filter((i) => !selected.includes(i.id))); setSelected([]); }} />
                </div>
              </div>
            ) : (
              <div className="sticky top-6 rounded-xl border border-dashed border-zinc-200 p-6 text-center text-sm text-zinc-500">Selecciona un archivo para ver sus detalles.</div>
            )}
          </aside>
        )}
      </div>

      {mode === "manage" && detail && (
        <div className="lg:hidden">
          <Modal open onClose={() => setSelected([])} title="Detalles">
            <MediaDetail siteId={siteId} item={detail} onDeleted={(id) => { setItems((x) => x.filter((i) => i.id !== id)); setSelected([]); }} onChange={(alt) => setItems((x) => x.map((i) => (i.id === detail.id ? { ...i, alt } : i)))} bare />
          </Modal>
        </div>
      )}

      {mode === "pick" && (
        <div className="sticky bottom-0 -mx-6 -mb-5 mt-5 flex items-center justify-between border-t border-zinc-100 bg-white px-6 py-3">
          <span className="text-sm text-zinc-500">{selected.length ? `${selected.length} seleccionado${selected.length > 1 ? "s" : ""}` : "Haz clic para seleccionar"}</span>
          <button type="button" className="btn-primary" disabled={!selected.length} onClick={() => onPick?.(selected.map((id) => items.find((i) => i.id === id)!).filter(Boolean))}>
            {multiple ? "Añadir seleccionados" : "Usar imagen"}
          </button>
        </div>
      )}
    </div>
  );
}

function BulkDelete({ siteId, ids, onDone }: { siteId: string; ids: string[]; onDone: () => void }) {
  return (
    <button
      className="btn-danger-ghost btn-sm"
      onClick={async () => {
        if (!confirm(`¿Eliminar ${ids.length} archivos? Las páginas que los usen dejarán de mostrarlos.`)) return;
        const r = await deleteMedia(siteId, ids);
        if (r.error) toast.error(r.error);
        else { toast(r.message!); onDone(); }
      }}
    >
      <Trash2 className="h-3.5 w-3.5" /> Eliminar
    </button>
  );
}

function MediaDetail({ siteId, item, onDeleted, onChange, bare }: { siteId: string; item: Item; onDeleted: (id: string) => void; onChange: (alt: string) => void; bare?: boolean }) {
  const [alt, setAlt] = useState(item.alt);
  const isImg = item.mimeType.startsWith("image/");
  const fullUrl = typeof window !== "undefined" ? `${window.location.origin}${item.url}` : item.url;
  return (
    <div className={cn(!bare && "card sticky top-6 overflow-hidden")}>
      <div className="grid aspect-video place-items-center bg-zinc-100">
        {isImg ? <img src={item.url} alt="" className="max-h-full max-w-full object-contain" /> : <FileText className="h-10 w-10 text-zinc-400" />}
      </div>
      <div className={cn("space-y-4 text-sm", !bare && "p-4")}>
        <div>
          <p className="break-all font-semibold">{item.originalName}</p>
          <p className="mt-0.5 text-xs text-zinc-500">
            {formatBytes(item.size)}{item.width ? ` · ${item.width}×${item.height}px` : ""} · {formatDate(item.createdAt)}
          </p>
        </div>
        {isImg && (
          <div>
            <label className="label">Texto alternativo</label>
            <textarea className="input min-h-[60px] text-[13px]" value={alt} onChange={(e) => setAlt(e.target.value)} placeholder="Describe la imagen" />
            {alt !== item.alt && (
              <button className="btn-primary btn-sm mt-2" onClick={async () => { const r = await updateMedia(siteId, item.id, alt); if (r.error) toast.error(r.error); else { toast("Guardado"); onChange(alt); } }}>Guardar</button>
            )}
          </div>
        )}
        <div>
          <label className="label">URL</label>
          <div className="flex gap-1.5">
            <input readOnly className="input text-xs" value={fullUrl} onFocus={(e) => e.target.select()} />
            <button className="btn-secondary btn-icon" title="Copiar" onClick={() => navigator.clipboard.writeText(fullUrl).then(() => toast("URL copiada"))}><Copy className="h-4 w-4" /></button>
          </div>
        </div>
        <div className="flex justify-between border-t border-zinc-100 pt-3">
          <a href={item.url} target="_blank" className="btn-ghost btn-sm" rel="noreferrer">Abrir</a>
          <button
            className="btn-danger-ghost btn-sm"
            onClick={async () => {
              if (!confirm("¿Eliminar este archivo? Las páginas que lo usen dejarán de mostrarlo.")) return;
              const r = await deleteMedia(siteId, [item.id]);
              if (r.error) toast.error(r.error);
              else { toast("Archivo eliminado"); onDeleted(item.id); }
            }}
          >
            <Trash2 className="h-3.5 w-3.5" /> Eliminar
          </button>
        </div>
      </div>
    </div>
  );
}

/** Campo de imagen con vista previa y selector de la biblioteca. */
export function ImageField({ siteId, value, onChange, compact }: { siteId: string; value: string; onChange: (url: string) => void; compact?: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      {value ? (
        <div className={cn("group relative overflow-hidden rounded-lg border border-zinc-200 bg-zinc-100", compact ? "h-20" : "aspect-video")}>
          <img src={value} alt="" className="h-full w-full object-cover" />
          <div className="absolute inset-0 flex items-center justify-center gap-2 bg-zinc-950/50 opacity-0 transition group-hover:opacity-100">
            <button type="button" className="btn-secondary btn-sm" onClick={() => setOpen(true)}>Cambiar</button>
            <button type="button" className="btn-icon bg-white/90 text-red-600 hover:bg-white" onClick={() => onChange("")}><X className="h-4 w-4" /></button>
          </div>
        </div>
      ) : (
        <button type="button" onClick={() => setOpen(true)} className={cn("flex w-full flex-col items-center justify-center gap-1.5 rounded-lg border-2 border-dashed border-zinc-200 text-sm text-zinc-500 transition hover:border-brand-400 hover:bg-brand-50/50 hover:text-brand-700", compact ? "h-20" : "aspect-video")}>
          <ImageIcon className="h-5 w-5" /> Elegir imagen
        </button>
      )}
      <Modal open={open} onClose={() => setOpen(false)} title="Biblioteca de medios" size="xl">
        <MediaLibrary siteId={siteId} mode="pick" accept="image" onPick={(items) => { onChange(items[0].url); setOpen(false); }} />
      </Modal>
    </>
  );
}

/** Varias imágenes reordenables (galería, logos). */
export function GalleryField({ siteId, value, onChange }: { siteId: string; value: { src: string; alt?: string }[]; onChange: (v: { src: string; alt?: string }[]) => void }) {
  const [open, setOpen] = useState(false);
  const move = (i: number, d: number) => {
    const n = [...value];
    const [x] = n.splice(i, 1);
    n.splice(i + d, 0, x);
    onChange(n);
  };
  return (
    <>
      <div className="grid grid-cols-3 gap-2">
        {value.map((img, i) => (
          <div key={i} className="group relative aspect-square overflow-hidden rounded-lg border border-zinc-200 bg-zinc-100">
            <img src={img.src} alt="" className="h-full w-full object-cover" />
            <div className="absolute inset-0 flex items-end justify-between bg-gradient-to-t from-black/60 to-transparent p-1 opacity-0 transition group-hover:opacity-100">
              <div className="flex gap-0.5">
                {i > 0 && <button type="button" className="rounded bg-white/90 px-1.5 text-xs" onClick={() => move(i, -1)}>←</button>}
                {i < value.length - 1 && <button type="button" className="rounded bg-white/90 px-1.5 text-xs" onClick={() => move(i, 1)}>→</button>}
              </div>
              <button type="button" className="rounded bg-white/90 p-0.5 text-red-600" onClick={() => onChange(value.filter((_, j) => j !== i))}><X className="h-3.5 w-3.5" /></button>
            </div>
          </div>
        ))}
        <button type="button" onClick={() => setOpen(true)} className="grid aspect-square place-items-center rounded-lg border-2 border-dashed border-zinc-200 text-zinc-400 transition hover:border-brand-400 hover:text-brand-600">
          <span className="text-center text-xs"><ImageIcon className="mx-auto mb-1 h-5 w-5" />Añadir</span>
        </button>
      </div>
      <Modal open={open} onClose={() => setOpen(false)} title="Añadir imágenes" size="xl">
        <MediaLibrary siteId={siteId} mode="pick" accept="image" multiple onPick={(items) => { onChange([...value, ...items.map((i) => ({ src: i.url, alt: i.alt }))]); setOpen(false); }} />
      </Modal>
    </>
  );
}
