"use client";
/* eslint-disable @next/next/no-img-element */
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft, Monitor, Tablet, Smartphone, Eye, Settings2, Loader2, X, Type, Link2, ImageIcon, Copy, ChevronUp, ChevronDown,
  Trash2, Bold, Italic, Underline, RemoveFormatting, Globe, Layers, Wallpaper, History, Code2, Info, List,
} from "lucide-react";
import { cn, formatDateTime, timeAgo } from "@/lib/utils";
import { saveCustomPage, type CustomPageInput } from "@/app/actions/custom";
import { restoreRevision } from "@/app/actions/content";
import { BG_ATTR, FIELD_ATTR, GLOBAL_MARK, REPEAT_ATTR, TYPE_ATTR, bgKey } from "@/lib/custom/shared";
import { toast } from "../toast";
import { Modal, Switch } from "../client";
import { MediaLibrary, ImageField } from "../MediaLibrary";

type Meta = Omit<CustomPageInput, "fields" | "globals"> & { id: string };
type Kind = "text" | "link" | "image" | "bg";
type Selection = { el: HTMLElement; kind: Kind } | null;
type OutlineItem = { el: HTMLElement; kind: Kind; label: string; global: boolean; list: string | null };

type Props = {
  siteId: string;
  meta: Meta;
  template: string;
  editSrc: string;
  base: string;
  publicUrl: string;
  previewUrl: string;
  isHome: boolean;
  canManage: boolean;
  links: { label: string; url: string }[];
  revisions: { id: string; createdAt: string; author: string | null }[];
};

const DEVICES = [
  { id: "desktop", icon: Monitor, width: "100%", label: "Escritorio" },
  { id: "tablet", icon: Tablet, width: "820px", label: "Tablet" },
  { id: "mobile", icon: Smartphone, width: "390px", label: "Móvil" },
] as const;

function kindOf(el: HTMLElement): Kind {
  const t = el.getAttribute(TYPE_ATTR);
  return t === "image" ? "image" : t === "link" ? "link" : "text";
}

function toLocalInput(iso: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

function bgUrl(el: HTMLElement) {
  const m = (el.getAttribute("style") ?? "").match(/url\(\s*['"]?([^'")]+)['"]?\s*\)/i);
  return m ? m[1] : "";
}

function setBgUrl(el: HTMLElement, url: string) {
  const style = el.getAttribute("style") ?? "";
  const value = `url("${url}")`;
  el.setAttribute("style", /url\([^)]*\)/i.test(style) ? style.replace(/url\([^)]*\)/i, value) : `${style};background-image:${value}`);
}

export function CustomPageEditor(props: Props) {
  const { siteId, base } = props;
  const router = useRouter();
  const frame = useRef<HTMLIFrameElement>(null);
  const [meta, setMeta] = useState(props.meta);
  const [selected, setSelected] = useState<Selection>(null);
  const [outline, setOutline] = useState<OutlineItem[]>([]);
  const [dirty, setDirty] = useState(false);
  const [saving, start] = useTransition();
  const [device, setDevice] = useState<(typeof DEVICES)[number]["id"]>("desktop");
  const [js, setJs] = useState(false);
  const [loading, setLoading] = useState(true);
  const [panel, setPanel] = useState<"left" | "right" | null>(null);
  const [media, setMedia] = useState<null | ((src: string, alt: string) => void)>(null);
  const [, force] = useState(0);
  const rerender = () => force((x) => x + 1);

  const doc = () => frame.current?.contentDocument ?? null;
  const strip = useCallback((u: string | null) => {
    const v = u ?? "";
    return base && v.startsWith(`${base}/`) ? v.slice(base.length) : base && v === base ? "/" : v;
  }, [base]);

  /* ---------------------------------------------------------- Selección */
  const select = useCallback((el: HTMLElement | null, kind?: Kind) => {
    const d = doc();
    if (!d) return;
    d.querySelectorAll("[data-nido-selected]").forEach((x) => x.removeAttribute("data-nido-selected"));
    d.querySelectorAll("[data-nido-item]").forEach((x) => x.removeAttribute("data-nido-item"));
    d.querySelectorAll("[contenteditable]").forEach((x) => { if (x !== el) x.removeAttribute("contenteditable"); });
    if (!el) return setSelected(null);
    el.setAttribute("data-nido-selected", "");
    el.closest(`[${REPEAT_ATTR}]`)?.setAttribute("data-nido-item", "");
    setSelected({ el, kind: kind ?? (el.hasAttribute(FIELD_ATTR) ? kindOf(el) : "bg") });
    setPanel("right");
  }, []);

  const buildOutline = useCallback(() => {
    const d = doc();
    if (!d) return;
    const items: OutlineItem[] = [];
    d.querySelectorAll<HTMLElement>(`[${FIELD_ATTR}], [${BG_ATTR}]`).forEach((el) => {
      const isField = el.hasAttribute(FIELD_ATTR);
      const kind: Kind = isField ? kindOf(el) : "bg";
      const label = kind === "image" ? (el.getAttribute("alt") || (el.getAttribute("src") ?? "").split("/").pop() || "Imagen")
        : kind === "bg" ? "Imagen de fondo" : (el.textContent ?? "").replace(/\s+/g, " ").trim().slice(0, 70) || "(vacío)";
      const item = el.closest(`[${REPEAT_ATTR}]`);
      items.push({ el, kind, label, global: el.hasAttribute(GLOBAL_MARK) || !!item?.hasAttribute(GLOBAL_MARK), list: item?.getAttribute(REPEAT_ATTR) ?? null });
      if (isField && el.hasAttribute(BG_ATTR)) items.push({ el, kind: "bg", label: "Imagen de fondo", global: el.hasAttribute(GLOBAL_MARK), list: item?.getAttribute(REPEAT_ATTR) ?? null });
    });
    setOutline(items);
  }, []);

  /* ------------------------------------------------- Recoger contenidos */
  const readField = useCallback((el: HTMLElement) => {
    const k = kindOf(el);
    if (k === "image") return { src: strip(el.getAttribute("src")), alt: el.getAttribute("alt") ?? "" };
    if (k === "link") return { text: el.innerHTML, href: strip(el.getAttribute("href")), target: el.getAttribute("target") ?? "" };
    return el.innerHTML;
  }, [strip]);

  const collect = useCallback(() => {
    const d = doc()!;
    const fields: Record<string, unknown> = {};
    const globals: Record<string, unknown> = {};
    const target = (el: Element) => (el.hasAttribute(GLOBAL_MARK) ? globals : fields);
    const scope = (root: HTMLElement, attr: string) => [...(root.matches(`[${attr}]`) ? [root] : []), ...Array.from(root.querySelectorAll<HTMLElement>(`[${attr}]`))];

    const seen = new Set<string>();
    d.querySelectorAll<HTMLElement>(`[${REPEAT_ATTR}]`).forEach((item) => {
      if (item.parentElement?.closest(`[${REPEAT_ATTR}]`)) return;
      const key = item.getAttribute(REPEAT_ATTR)!;
      if (seen.has(key)) return;
      seen.add(key);
      const all = Array.from(d.querySelectorAll<HTMLElement>(`[${REPEAT_ATTR}="${key}"]`)).filter((x) => !x.parentElement?.closest(`[${REPEAT_ATTR}]`));
      target(item)[key] = all.map((it) => {
        const obj: Record<string, unknown> = {};
        scope(it, FIELD_ATTR).forEach((f) => (obj[f.getAttribute(FIELD_ATTR)!] = readField(f)));
        scope(it, BG_ATTR).forEach((f) => (obj[bgKey(f.getAttribute(BG_ATTR)!)] = strip(bgUrl(f))));
        return obj;
      });
    });
    d.querySelectorAll<HTMLElement>(`[${FIELD_ATTR}]`).forEach((el) => {
      if (el.closest(`[${REPEAT_ATTR}]`)) return;
      target(el)[el.getAttribute(FIELD_ATTR)!] = readField(el);
    });
    d.querySelectorAll<HTMLElement>(`[${BG_ATTR}]`).forEach((el) => {
      if (el.closest(`[${REPEAT_ATTR}]`)) return;
      target(el)[bgKey(el.getAttribute(BG_ATTR)!)] = strip(bgUrl(el));
    });
    return { fields, globals };
  }, [readField, strip]);

  const save = useCallback((status?: "DRAFT" | "PUBLISHED") => {
    if (!doc()) return;
    start(async () => {
      const st = status ?? meta.status;
      const { fields, globals } = collect();
      const r = await saveCustomPage(siteId, meta.id, { ...meta, status: st, fields, globals });
      if (r.error) return toast.error(r.error);
      toast(r.message || "Guardado");
      setMeta((m) => ({ ...m, status: st }));
      setDirty(false);
      router.refresh();
    });
  }, [collect, meta, siteId, router]);

  /* ------------------------------------------------ Eventos del iframe */
  const saveRef = useRef(save);
  saveRef.current = save;

  const onFrameLoad = useCallback(() => {
    const d = doc();
    if (!d) return;
    setLoading(false);
    buildOutline();

    d.addEventListener("mousedown", (e) => {
      const t = e.target as HTMLElement;
      const field = t.closest<HTMLElement>(`[${FIELD_ATTR}]`);
      if (field && kindOf(field) !== "image" && field.getAttribute("contenteditable") !== "true") {
        field.setAttribute("contenteditable", "true");
      }
    }, true);

    d.addEventListener("click", (e) => {
      const t = e.target as HTMLElement;
      if (t.closest("a, button, label, [type=submit]")) e.preventDefault();
      const field = t.closest<HTMLElement>(`[${FIELD_ATTR}]`);
      if (field) {
        e.preventDefault();
        e.stopPropagation();
        select(field);
        if (kindOf(field) === "image") {
          setMedia(() => (src: string, alt: string) => {
            field.setAttribute("src", src);
            if (alt && !field.getAttribute("alt")) field.setAttribute("alt", alt);
            ["srcset", "sizes", "data-src", "data-srcset"].forEach((a) => field.removeAttribute(a));
            if (field.parentElement?.tagName === "PICTURE") field.parentElement.querySelectorAll("source").forEach((s) => s.remove());
            setDirty(true);
            buildOutline();
          });
        } else field.focus();
        return;
      }
      const bg = t.closest<HTMLElement>(`[${BG_ATTR}]`);
      select(bg ?? null, bg ? "bg" : undefined);
    }, true);

    d.addEventListener("submit", (e) => e.preventDefault(), true);
    d.addEventListener("input", () => setDirty(true));
    d.addEventListener("keydown", (e) => {
      const t = e.target as HTMLElement;
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        saveRef.current();
      } else if (t.isContentEditable && e.key === "Enter") {
        e.preventDefault();
        d.execCommand("insertLineBreak");
      } else if (e.key === "Escape") {
        (t as HTMLElement).blur?.();
        select(null);
      }
    });
    d.addEventListener("paste", (e) => {
      const t = e.target as HTMLElement;
      if (!t.closest?.("[contenteditable=true]")) return;
      e.preventDefault();
      d.execCommand("insertText", false, e.clipboardData?.getData("text/plain") ?? "");
    });
    d.addEventListener("focusout", () => setTimeout(buildOutline, 0));
  }, [buildOutline, select]);

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

  const src = `${props.editSrc}${js ? "&js=1" : ""}`;

  /* -------------------------------------------------------- Acciones */
  const exec = (cmd: string, value?: string) => {
    const w = frame.current?.contentWindow;
    if (!w || !selected) return;
    selected.el.setAttribute("contenteditable", "true");
    w.focus();
    if (!w.getSelection()?.rangeCount || !selected.el.contains(w.getSelection()!.anchorNode)) {
      const r = w.document.createRange();
      r.selectNodeContents(selected.el);
      w.getSelection()?.removeAllRanges();
      w.getSelection()?.addRange(r);
    }
    w.document.execCommand(cmd, false, value);
    setDirty(true);
  };

  const item = selected?.el.closest<HTMLElement>(`[${REPEAT_ATTR}]`) ?? null;
  const siblings = item ? Array.from(item.parentElement?.children ?? []).filter((c) => c.getAttribute(REPEAT_ATTR) === item.getAttribute(REPEAT_ATTR)) as HTMLElement[] : [];
  const itemIndex = item ? siblings.indexOf(item) : -1;

  const itemAction = (action: "dup" | "up" | "down" | "del") => {
    if (!item) return;
    if (action === "dup") {
      const c = item.cloneNode(true) as HTMLElement;
      c.querySelectorAll("[data-nido-selected],[contenteditable]").forEach((x) => { x.removeAttribute("data-nido-selected"); x.removeAttribute("contenteditable"); });
      c.removeAttribute("data-nido-item");
      c.removeAttribute("data-nido-selected");
      item.after(c);
      c.scrollIntoView({ behavior: "smooth", block: "nearest" });
    } else if (action === "up" && itemIndex > 0) siblings[itemIndex - 1].before(item);
    else if (action === "down" && itemIndex < siblings.length - 1) siblings[itemIndex + 1].after(item);
    else if (action === "del") {
      if (siblings.length <= 1) return toast.error("La lista debe tener al menos un elemento");
      item.remove();
      select(null);
    }
    setDirty(true);
    buildOutline();
    rerender();
  };

  const isGlobal = !!selected && (selected.el.hasAttribute(GLOBAL_MARK) || !!item?.hasAttribute(GLOBAL_MARK));
  const isPublished = meta.status === "PUBLISHED";
  const future = meta.publishedAt && new Date(meta.publishedAt) > new Date();
  const update = (p: Partial<Meta>) => { setMeta((m) => ({ ...m, ...p })); setDirty(true); };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-zinc-100">
      <header className="flex h-14 shrink-0 items-center gap-2 border-b border-zinc-200 bg-white px-2 sm:px-3">
        <Link href={`/admin/s/${siteId}/pages`} className="btn-icon btn-ghost" onClick={(e) => { if (dirty && !confirm("Hay cambios sin guardar. ¿Salir de todas formas?")) e.preventDefault(); }}>
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div className="min-w-0 flex-1">
          <p className="truncate px-2 text-[15px] font-semibold">{meta.title}</p>
          <div className="flex items-center gap-2 px-2 text-[11px] text-zinc-500">
            <span className={cn("h-1.5 w-1.5 rounded-full", isPublished && future ? "bg-sky-500" : isPublished ? "bg-emerald-500" : "bg-zinc-400")} />
            {isPublished && future ? "Programada" : isPublished ? "Publicada" : "Borrador"}
            <span className="hidden truncate sm:inline">· plantilla {props.template}</span>
            {dirty && <span className="text-amber-600">· Cambios sin guardar</span>}
          </div>
        </div>
        <div className="hidden items-center rounded-lg bg-zinc-100 p-0.5 md:flex">
          {DEVICES.map((d) => (
            <button key={d.id} title={d.label} onClick={() => setDevice(d.id)} className={cn("grid h-7 w-8 place-items-center rounded-md transition", device === d.id ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-500 hover:text-zinc-800")}>
              <d.icon className="h-4 w-4" />
            </button>
          ))}
        </div>
        <button
          className={cn("btn-ghost hidden lg:inline-flex", js && "bg-amber-50 text-amber-800")}
          title="Ejecuta el JavaScript de la web (animaciones, sliders…). Útil para ver contenido oculto."
          onClick={() => { if (dirty && !confirm("Se recargará la página y perderás los cambios sin guardar. ¿Continuar?")) return; setLoading(true); setJs(!js); setDirty(false); select(null); }}
        >
          <Code2 className="h-4 w-4" /> JS {js ? "activado" : "desactivado"}
        </button>
        <a href={props.previewUrl} target="_blank" rel="noreferrer" className="btn-ghost hidden sm:inline-flex"><Eye className="h-4 w-4" /> <span className="hidden xl:inline">Vista previa</span></a>
        <button className={cn("btn-icon btn-ghost", !selected && "bg-zinc-100")} title="Ajustes de la página" onClick={() => { select(null); setPanel("right"); }}><Settings2 className="h-4 w-4" /></button>
        {!isPublished && <button className="btn-secondary hidden sm:inline-flex" disabled={saving} onClick={() => save("DRAFT")}>Guardar borrador</button>}
        <button className="btn-primary" disabled={saving} onClick={() => save("PUBLISHED")}>
          {saving && <Loader2 className="h-4 w-4 animate-spin" />}
          {isPublished ? "Guardar y publicar" : future ? "Programar" : "Publicar"}
        </button>
      </header>

      <div className="relative flex min-h-0 flex-1">
        {/* Contenidos editables */}
        <aside className={cn("absolute inset-y-0 left-0 z-20 w-72 shrink-0 flex-col border-r border-zinc-200 bg-white shadow-pop lg:static lg:flex lg:shadow-none", panel === "left" ? "flex" : "hidden")}>
          <div className="flex items-center justify-between border-b border-zinc-100 px-4 py-3">
            <p className="flex items-center gap-1.5 text-sm font-semibold"><Layers className="h-4 w-4" /> Contenido editable</p>
            <button className="btn-icon btn-ghost lg:hidden" onClick={() => setPanel(null)}><X className="h-4 w-4" /></button>
          </div>
          <div className="scrollbar-thin min-h-0 flex-1 overflow-y-auto p-2">
            <p className="mb-2 rounded-lg bg-brand-50 px-3 py-2 text-xs leading-relaxed text-brand-900">
              Haz clic sobre cualquier texto de la web para escribir, o sobre una imagen para cambiarla.
            </p>
            {[{ t: "Común a todas las páginas", g: true }, { t: "Esta página", g: false }].map(({ t, g }) => {
              const list = outline.filter((o) => o.global === g);
              if (!list.length) return null;
              return (
                <div key={t} className="mb-3">
                  <p className="mb-1 px-2 text-[10px] font-semibold uppercase tracking-wider text-zinc-400">{t}</p>
                  {list.map((o, i) => {
                    const I = o.kind === "image" ? ImageIcon : o.kind === "link" ? Link2 : o.kind === "bg" ? Wallpaper : Type;
                    return (
                      <button
                        key={i}
                        onClick={() => { o.el.scrollIntoView({ behavior: "smooth", block: "center" }); select(o.el, o.kind); }}
                        className={cn("flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[12.5px] transition hover:bg-zinc-100", selected?.el === o.el && selected.kind === o.kind && "bg-brand-50 text-brand-800")}
                      >
                        <I className="h-3.5 w-3.5 shrink-0 text-zinc-400" />
                        <span className="min-w-0 flex-1 truncate">{o.label}</span>
                        {o.list && <List className="h-3 w-3 shrink-0 text-amber-500" />}
                      </button>
                    );
                  })}
                </div>
              );
            })}
            {!loading && outline.length === 0 && <p className="p-4 text-center text-xs text-zinc-500">No se han detectado zonas editables en esta plantilla.</p>}
          </div>
        </aside>

        {/* Web */}
        <main className="flex min-w-0 flex-1 flex-col">
          <div className="flex items-center justify-between gap-2 border-b border-zinc-200 bg-white px-3 py-1.5 lg:hidden">
            <button className="btn-secondary btn-sm" onClick={() => setPanel("left")}><Layers className="h-3.5 w-3.5" /> Contenido</button>
            <button className="btn-secondary btn-sm" onClick={() => setPanel("right")}><Settings2 className="h-3.5 w-3.5" /> {selected ? "Elemento" : "Ajustes"}</button>
          </div>
          <div className="relative flex min-h-0 flex-1 justify-center overflow-hidden p-3 sm:p-5">
            <div className="relative h-full overflow-hidden rounded-xl bg-white shadow-pop ring-1 ring-zinc-900/5 transition-all duration-300" style={{ width: DEVICES.find((d) => d.id === device)!.width, maxWidth: "100%" }}>
              {loading && <div className="absolute inset-0 z-10 grid place-items-center bg-white"><Loader2 className="h-6 w-6 animate-spin text-brand-600" /></div>}
              <iframe key={src} ref={frame} src={src} onLoad={onFrameLoad} className="h-full w-full border-0" title="Web" />
            </div>
          </div>
        </main>

        {/* Inspector */}
        <aside className={cn("absolute inset-y-0 right-0 z-20 w-[22rem] max-w-full shrink-0 flex-col border-l border-zinc-200 bg-white shadow-pop lg:static lg:flex lg:shadow-none", panel === "right" ? "flex" : "hidden")}>
          {selected ? (
            <>
              <div className="flex items-center gap-2.5 border-b border-zinc-100 px-4 py-3">
                <span className="grid h-8 w-8 place-items-center rounded-lg bg-brand-50 text-brand-700">
                  {selected.kind === "image" ? <ImageIcon className="h-4 w-4" /> : selected.kind === "link" ? <Link2 className="h-4 w-4" /> : selected.kind === "bg" ? <Wallpaper className="h-4 w-4" /> : <Type className="h-4 w-4" />}
                </span>
                <p className="flex-1 text-sm font-semibold">{{ text: "Texto", link: "Enlace / botón", image: "Imagen", bg: "Imagen de fondo" }[selected.kind]}</p>
                <button className="btn-icon btn-ghost" onClick={() => { select(null); setPanel(null); }}><X className="h-4 w-4" /></button>
              </div>
              <div className="scrollbar-thin min-h-0 flex-1 space-y-5 overflow-y-auto p-4">
                {isGlobal && (
                  <p className="flex gap-2 rounded-lg bg-sky-50 p-3 text-xs text-sky-900"><Globe className="mt-0.5 h-3.5 w-3.5 shrink-0" /> Este contenido es común a todas las páginas: si lo cambias aquí, cambia en toda la web.</p>
                )}
                {(selected.kind === "text" || selected.kind === "link") && (
                  <div>
                    <label className="label">Formato</label>
                    <div className="flex gap-1">
                      <button className="btn-secondary btn-icon" title="Negrita" onMouseDown={(e) => e.preventDefault()} onClick={() => exec("bold")}><Bold className="h-4 w-4" /></button>
                      <button className="btn-secondary btn-icon" title="Cursiva" onMouseDown={(e) => e.preventDefault()} onClick={() => exec("italic")}><Italic className="h-4 w-4" /></button>
                      <button className="btn-secondary btn-icon" title="Subrayado" onMouseDown={(e) => e.preventDefault()} onClick={() => exec("underline")}><Underline className="h-4 w-4" /></button>
                      {selected.kind === "text" && (
                        <button className="btn-secondary btn-icon" title="Enlazar el texto seleccionado" onMouseDown={(e) => e.preventDefault()} onClick={() => { const u = prompt("Dirección del enlace (https://… o /pagina)"); if (u) exec("createLink", u); }}><Link2 className="h-4 w-4" /></button>
                      )}
                      <button className="btn-secondary btn-icon" title="Quitar formato" onMouseDown={(e) => e.preventDefault()} onClick={() => exec("removeFormat")}><RemoveFormatting className="h-4 w-4" /></button>
                    </div>
                    <p className="help">Escribe directamente sobre la web. Intro hace un salto de línea.</p>
                  </div>
                )}
                {selected.kind === "link" && (
                  <LinkFields el={selected.el} base={base} strip={strip} links={props.links} onChange={() => setDirty(true)} />
                )}
                {selected.kind === "image" && (
                  <ImageFields el={selected.el} onChange={() => { setDirty(true); buildOutline(); }} onPick={() => setMedia(() => (src: string) => {
                    const f = selected.el;
                    f.setAttribute("src", src);
                    ["srcset", "sizes", "data-src", "data-srcset"].forEach((a) => f.removeAttribute(a));
                    if (f.parentElement?.tagName === "PICTURE") f.parentElement.querySelectorAll("source").forEach((s) => s.remove());
                    setDirty(true);
                    rerender();
                  })} />
                )}
                {(selected.kind === "bg" || (selected.el.hasAttribute(BG_ATTR) && selected.kind !== "image")) && (
                  <div>
                    <label className="label">Imagen de fondo</label>
                    <div className="aspect-video overflow-hidden rounded-lg border border-zinc-200 bg-zinc-100 bg-cover bg-center" style={{ backgroundImage: bgUrl(selected.el) ? `url("${bgUrl(selected.el)}")` : undefined }} />
                    <button className="btn-secondary mt-2 w-full" onClick={() => setMedia(() => (src: string) => { setBgUrl(selected.el, src); setDirty(true); rerender(); })}>
                      <Wallpaper className="h-4 w-4" /> Cambiar fondo
                    </button>
                  </div>
                )}
                {item && (
                  <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-3">
                    <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-amber-900"><List className="h-3.5 w-3.5" /> Elemento {itemIndex + 1} de {siblings.length} de una lista</p>
                    <div className="grid grid-cols-2 gap-1.5">
                      <button className="btn-secondary btn-sm" onClick={() => itemAction("dup")}><Copy className="h-3.5 w-3.5" /> Duplicar</button>
                      <button className="btn-danger-ghost btn-sm border border-red-100 bg-white" onClick={() => itemAction("del")}><Trash2 className="h-3.5 w-3.5" /> Eliminar</button>
                      <button className="btn-secondary btn-sm" disabled={itemIndex === 0} onClick={() => itemAction("up")}><ChevronUp className="h-3.5 w-3.5" /> Antes</button>
                      <button className="btn-secondary btn-sm" disabled={itemIndex === siblings.length - 1} onClick={() => itemAction("down")}><ChevronDown className="h-3.5 w-3.5" /> Después</button>
                    </div>
                    <p className="mt-2 text-[11px] text-amber-800">Duplica un elemento para añadir uno nuevo y cambia después sus textos e imágenes.</p>
                  </div>
                )}
              </div>
            </>
          ) : (
            <PageSettings meta={meta} update={update} siteId={siteId} canManage={props.canManage} isHome={props.isHome} publicUrl={props.publicUrl} revisions={props.revisions} onUnpublish={() => save("DRAFT")} onClose={() => setPanel(null)} />
          )}
        </aside>
      </div>

      <Modal open={!!media} onClose={() => setMedia(null)} title="Elegir imagen" size="xl">
        <MediaLibrary siteId={siteId} mode="pick" accept="image" onPick={(items) => { media?.(items[0].url, items[0].alt); setMedia(null); }} />
      </Modal>
    </div>
  );
}

function LinkFields({ el, base, strip, links, onChange }: { el: HTMLElement; base: string; strip: (u: string | null) => string; links: { label: string; url: string }[]; onChange: () => void }) {
  const [href, setHref] = useState(strip(el.getAttribute("href")));
  const [blank, setBlank] = useState(el.getAttribute("target") === "_blank");
  useEffect(() => { setHref(strip(el.getAttribute("href"))); setBlank(el.getAttribute("target") === "_blank"); }, [el, strip]);
  return (
    <div className="space-y-3">
      <div>
        <label className="label">Enlace</label>
        <input
          className="input"
          list="nido-links"
          value={href}
          placeholder="/pagina, #seccion o https://…"
          onChange={(e) => {
            setHref(e.target.value);
            const v = e.target.value;
            el.setAttribute("href", base && v.startsWith("/") && !v.startsWith("//") ? `${base}${v}` : v);
            onChange();
          }}
        />
        <datalist id="nido-links">{links.map((l) => <option key={l.url} value={l.url}>{l.label}</option>)}</datalist>
      </div>
      <Switch label="Abrir en pestaña nueva" checked={blank} onChange={(v) => { setBlank(v); if (v) el.setAttribute("target", "_blank"); else el.removeAttribute("target"); onChange(); }} />
    </div>
  );
}

function ImageFields({ el, onChange, onPick }: { el: HTMLElement; onChange: () => void; onPick: () => void }) {
  const [alt, setAlt] = useState(el.getAttribute("alt") ?? "");
  useEffect(() => setAlt(el.getAttribute("alt") ?? ""), [el]);
  const src = el.getAttribute("src") ?? "";
  return (
    <div className="space-y-3">
      <div className="grid aspect-video place-items-center overflow-hidden rounded-lg border border-zinc-200 bg-zinc-100">
        {src ? <img src={src} alt="" className="max-h-full max-w-full object-contain" /> : <ImageIcon className="h-6 w-6 text-zinc-400" />}
      </div>
      <button className="btn-primary w-full" onClick={onPick}><ImageIcon className="h-4 w-4" /> Cambiar imagen</button>
      <div>
        <label className="label">Texto alternativo</label>
        <input className="input" value={alt} placeholder="Describe la imagen" onChange={(e) => { setAlt(e.target.value); el.setAttribute("alt", e.target.value); onChange(); }} />
        <p className="help">Ayuda a la accesibilidad y al SEO.</p>
      </div>
    </div>
  );
}

function PageSettings({ meta, update, siteId, canManage, isHome, publicUrl, revisions, onUnpublish, onClose }: {
  meta: Meta; update: (p: Partial<Meta>) => void; siteId: string; canManage: boolean; isHome: boolean; publicUrl: string;
  revisions: Props["revisions"]; onUnpublish: () => void; onClose: () => void;
}) {
  const [restoring, setRestoring] = useState<string | null>(null);
  return (
    <>
      <div className="flex items-center justify-between border-b border-zinc-100 px-4 py-3">
        <p className="text-sm font-semibold">Ajustes de la página</p>
        <button className="btn-icon btn-ghost lg:hidden" onClick={onClose}><X className="h-4 w-4" /></button>
      </div>
      <div className="scrollbar-thin min-h-0 flex-1 space-y-5 overflow-y-auto p-4">
        <p className="flex gap-2 rounded-lg bg-zinc-50 p-3 text-xs text-zinc-600"><Info className="mt-0.5 h-3.5 w-3.5 shrink-0" /> Selecciona un texto o una imagen de la web para editarlo.</p>
        <div><label className="label">Título de la página</label><input className="input" value={meta.title} onChange={(e) => update({ title: e.target.value })} /></div>
        <div>
          <label className="label">URL</label>
          <div className="flex items-center overflow-hidden rounded-lg border border-zinc-200 bg-zinc-50 shadow-sm">
            <span className="pl-3 text-sm text-zinc-400">/</span>
            <input className="w-full bg-white px-1.5 py-2 text-sm outline-none disabled:bg-zinc-50 disabled:text-zinc-500" value={isHome ? "" : meta.slug} disabled={!canManage || isHome} onChange={(e) => update({ slug: e.target.value })} />
          </div>
          <p className="help">{isHome ? "Es la portada de la web." : <a className="text-brand-600 hover:underline" href={`${publicUrl}/${meta.slug}`} target="_blank" rel="noreferrer">{publicUrl.replace(/^https?:\/\//, "")}/{meta.slug}</a>}</p>
        </div>
        <div>
          <label className="label">Fecha de publicación</label>
          <input type="datetime-local" className="input" value={toLocalInput(meta.publishedAt)} onChange={(e) => update({ publishedAt: e.target.value ? new Date(e.target.value).toISOString() : null })} />
          <p className="help">Pon una fecha futura para programarla. También ordena los listados automáticos.</p>
        </div>
        <div>
          <label className="label">Imagen principal</label>
          <ImageField siteId={siteId} value={meta.ogImage ?? ""} onChange={(v) => update({ ogImage: v })} compact />
          <p className="help">Se usa en los listados automáticos (p. ej. proyectos) y al compartir en redes.</p>
        </div>
        <div>
          <label className="label">Descripción</label>
          <textarea className="input" value={meta.seoDescription} onChange={(e) => update({ seoDescription: e.target.value })} placeholder="Resumen breve para listados y Google" />
          <p className={cn("help", meta.seoDescription.length > 160 && "text-amber-600")}>{meta.seoDescription.length}/160</p>
        </div>
        <div><label className="label">Título para Google</label><input className="input" value={meta.seoTitle} placeholder={meta.title} onChange={(e) => update({ seoTitle: e.target.value })} /></div>
        <Switch label="Ocultar de buscadores" checked={meta.noindex} onChange={(noindex) => update({ noindex })} />
        {meta.status === "PUBLISHED" && <button className="btn-secondary btn-sm w-full" onClick={onUnpublish}>Pasar a borrador (despublicar)</button>}
        <section className="border-t border-zinc-100 pt-4">
          <h3 className="mb-2 flex items-center gap-1.5 text-[13px] font-semibold"><History className="h-4 w-4" /> Historial</h3>
          {revisions.length ? (
            <ul className="space-y-0.5">
              {revisions.map((r) => (
                <li key={r.id} className="flex items-center justify-between rounded-md px-1.5 py-1 text-xs hover:bg-zinc-50">
                  <span title={formatDateTime(r.createdAt)}>{timeAgo(r.createdAt)}{r.author && <span className="text-zinc-500"> · {r.author}</span>}</span>
                  <button className="font-medium text-brand-600 hover:text-brand-800" disabled={!!restoring} onClick={async () => {
                    if (!confirm("¿Restaurar esta versión de los textos e imágenes de la página?")) return;
                    setRestoring(r.id);
                    const res = await restoreRevision(siteId, r.id);
                    if (res.error) { toast.error(res.error); setRestoring(null); } else window.location.reload();
                  }}>{restoring === r.id ? "…" : "Restaurar"}</button>
                </li>
              ))}
            </ul>
          ) : <p className="text-xs text-zinc-500">Cada vez que guardes se creará una versión.</p>}
        </section>
      </div>
    </>
  );
}
