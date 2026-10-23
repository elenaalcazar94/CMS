"use client";
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  DndContext, PointerSensor, KeyboardSensor, closestCenter, useSensor, useSensors, type DragEndEvent,
} from "@dnd-kit/core";
import { SortableContext, useSortable, verticalListSortingStrategy, arrayMove, sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  ArrowLeft, Monitor, Tablet, Smartphone, Undo2, Redo2, Eye, Settings2, Plus, Layers, ChevronUp, ChevronDown, Copy, Trash2,
  GripVertical, X, Loader2, History, Home, LayoutTemplate, Search,
} from "lucide-react";
import { BLOCKS, CATEGORY_LABELS, blockFields, createBlock, getBlockDef, type Block, type BlockCategory } from "@/lib/blocks";
import { themeCssVars, googleFontsHref, type ThemeSettings } from "@/lib/themes";
import { cn, formatDateTime, uid, timeAgo } from "@/lib/utils";
import { RenderBlock, type RenderCtx } from "@/components/site/Blocks";
import { Icon } from "@/components/Icon";
import { savePage, restoreRevision, type PageInput } from "@/app/actions/content";
import { toast } from "../toast";
import { Switch } from "../client";
import { ImageField } from "../MediaLibrary";
import { CanvasFrame } from "./CanvasFrame";
import { Fields, type FieldsCtx } from "./Fields";

type PageData = Omit<PageInput, "blocks"> & { id: string; blocks: Block[] };
type Revision = { id: string; createdAt: string; author: string | null };

type Props = {
  siteId: string;
  page: PageData;
  isHome: boolean;
  previewUrl: string;
  publicUrl: string;
  theme: { id: string; settings: ThemeSettings };
  renderCtx: RenderCtx;
  fieldsCtx: Omit<FieldsCtx, "siteId">;
  revisions: Revision[];
  canManage: boolean;
  canHtml: boolean;
};

const DEVICES = [
  { id: "desktop", icon: Monitor, width: "100%", label: "Escritorio" },
  { id: "tablet", icon: Tablet, width: "820px", label: "Tablet" },
  { id: "mobile", icon: Smartphone, width: "390px", label: "Móvil" },
] as const;

function isTyping(e: KeyboardEvent) {
  const t = e.target as HTMLElement;
  return t?.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(t?.tagName);
}

export function PageEditor(props: Props) {
  const { siteId, theme, renderCtx, canManage, canHtml } = props;
  const router = useRouter();
  const [meta, setMeta] = useState(() => ({ ...props.page, blocks: undefined }));
  const [blocks, setBlocksState] = useState<Block[]>(props.page.blocks);
  const [selected, setSelected] = useState<string | null>(null);
  const [panel, setPanel] = useState<"add" | "layers">(props.page.blocks.length ? "layers" : "add");
  const [rightPanel, setRightPanel] = useState<"block" | "page">("page");
  const [insertAt, setInsertAt] = useState<number | null>(null);
  const [device, setDevice] = useState<(typeof DEVICES)[number]["id"]>("desktop");
  const [dirty, setDirty] = useState(false);
  const [saving, startSaving] = useTransition();
  const [mobilePanel, setMobilePanel] = useState<"left" | "right" | null>(null);

  // Historial de deshacer/rehacer
  const past = useRef<Block[][]>([]);
  const future = useRef<Block[][]>([]);
  const lastPush = useRef(0);
  const [, bump] = useState(0);

  const setBlocks = useCallback((updater: Block[] | ((b: Block[]) => Block[]), coalesce = false) => {
    setBlocksState((prev) => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      const now = Date.now();
      if (!coalesce || now - lastPush.current > 800) {
        past.current = [...past.current.slice(-60), prev];
        future.current = [];
      }
      lastPush.current = now;
      return next;
    });
    setDirty(true);
    bump((x) => x + 1);
  }, []);

  const undo = useCallback(() => {
    const prev = past.current.pop();
    if (!prev) return;
    setBlocksState((cur) => {
      future.current.push(cur);
      return prev;
    });
    setDirty(true);
    bump((x) => x + 1);
  }, []);

  const redo = useCallback(() => {
    const nxt = future.current.pop();
    if (!nxt) return;
    setBlocksState((cur) => {
      past.current.push(cur);
      return nxt;
    });
    setDirty(true);
    bump((x) => x + 1);
  }, []);

  const updateMeta = (patch: Partial<typeof meta>) => {
    setMeta((m) => ({ ...m, ...patch }));
    setDirty(true);
  };

  const save = useCallback(
    (status?: "DRAFT" | "PUBLISHED") => {
      startSaving(async () => {
        const st = status ?? meta.status;
        const res = await savePage(siteId, meta.id, { ...meta, status: st, blocks });
        if (res.error) return toast.error(res.error);
        toast(res.message || "Guardado");
        setMeta((m) => ({ ...m, status: st }));
        setDirty(false);
        router.refresh();
      });
    },
    [meta, blocks, siteId, router],
  );

  const onKey = useCallback(
    (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key.toLowerCase() === "s") {
        e.preventDefault();
        save();
      } else if (mod && e.key.toLowerCase() === "z" && !isTyping(e)) {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
      } else if (e.key === "Escape" && !isTyping(e)) {
        setSelected(null);
        setRightPanel("page");
      }
    },
    [save, undo, redo],
  );

  useEffect(() => {
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onKey]);

  useEffect(() => {
    if (!dirty) return;
    const h = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", h);
    return () => window.removeEventListener("beforeunload", h);
  }, [dirty]);

  const select = (id: string | null) => {
    setSelected(id);
    setRightPanel(id ? "block" : "page");
    if (id) setMobilePanel("right");
  };

  function addBlock(type: string) {
    const b = createBlock(type, uid());
    const idx = insertAt ?? (selected ? blocks.findIndex((x) => x.id === selected) + 1 : blocks.length);
    setBlocks((bs) => [...bs.slice(0, idx), b, ...bs.slice(idx)]);
    setInsertAt(null);
    select(b.id);
    setPanel("layers");
    setTimeout(() => {
      const doc = document.querySelector<HTMLIFrameElement>("iframe[title='Lienzo del editor']")?.contentDocument;
      doc?.getElementById(`cb-${b.id}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 60);
  }

  const move = (id: string, dir: -1 | 1) =>
    setBlocks((bs) => {
      const i = bs.findIndex((b) => b.id === id);
      if (i + dir < 0 || i + dir >= bs.length) return bs;
      return arrayMove(bs, i, i + dir);
    });
  const duplicate = (id: string) =>
    setBlocks((bs) => {
      const i = bs.findIndex((b) => b.id === id);
      const copy = { ...structuredClone(bs[i]), id: uid() };
      setTimeout(() => select(copy.id));
      return [...bs.slice(0, i + 1), copy, ...bs.slice(i + 1)];
    });
  const remove = (id: string) => {
    setBlocks((bs) => bs.filter((b) => b.id !== id));
    if (selected === id) select(null);
  };

  const selectedBlock = blocks.find((b) => b.id === selected);
  const selectedDef = selectedBlock ? getBlockDef(selectedBlock.type) : undefined;
  const fieldsCtx: FieldsCtx = { siteId, ...props.fieldsCtx };
  const vars = useMemo(() => themeCssVars(theme.settings) as React.CSSProperties, [theme.settings]);
  const deviceWidth = DEVICES.find((d) => d.id === device)!.width;
  const isPublished = meta.status === "PUBLISHED";
  const isScheduled = isPublished && meta.publishedAt && new Date(meta.publishedAt) > new Date();

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-zinc-100">
      {/* Barra superior */}
      <header className="flex h-14 shrink-0 items-center gap-2 border-b border-zinc-200 bg-white px-2 sm:px-3">
        <Link href={`/admin/s/${siteId}/pages`} className="btn-icon btn-ghost" title="Volver a páginas" onClick={(e) => { if (dirty && !confirm("Hay cambios sin guardar. ¿Salir de todas formas?")) e.preventDefault(); }}>
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div className="min-w-0 flex-1">
          <input
            value={meta.title}
            onChange={(e) => updateMeta({ title: e.target.value })}
            className="w-full max-w-sm truncate rounded-md bg-transparent px-2 py-1 text-[15px] font-semibold outline-none transition hover:bg-zinc-100 focus:bg-zinc-100"
            placeholder="Título de la página"
          />
          <div className="flex items-center gap-2 px-2 text-[11px] text-zinc-500">
            <span className={cn("h-1.5 w-1.5 rounded-full", isScheduled ? "bg-sky-500" : isPublished ? "bg-emerald-500" : "bg-zinc-400")} />
            {isScheduled ? "Programada" : isPublished ? "Publicada" : "Borrador"}
            {props.isHome && <span className="flex items-center gap-1"><Home className="h-3 w-3" /> Portada</span>}
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
        <div className="hidden items-center sm:flex">
          <button className="btn-icon btn-ghost" title="Deshacer (Ctrl+Z)" disabled={!past.current.length} onClick={undo}><Undo2 className="h-4 w-4" /></button>
          <button className="btn-icon btn-ghost" title="Rehacer (Ctrl+Shift+Z)" disabled={!future.current.length} onClick={redo}><Redo2 className="h-4 w-4" /></button>
        </div>
        <a href={props.previewUrl} target="_blank" rel="noreferrer" className="btn-ghost hidden sm:inline-flex" title={dirty ? "Guarda para ver los últimos cambios" : "Vista previa"}>
          <Eye className="h-4 w-4" /> <span className="hidden lg:inline">Vista previa</span>
        </a>
        <button className={cn("btn-icon btn-ghost", rightPanel === "page" && !selected && "bg-zinc-100 text-zinc-900")} title="Ajustes de la página" onClick={() => { select(null); setMobilePanel("right"); }}>
          <Settings2 className="h-4 w-4" />
        </button>
        {!isPublished && (
          <button className="btn-secondary hidden sm:inline-flex" disabled={saving} onClick={() => save("DRAFT")}>Guardar borrador</button>
        )}
        <button className="btn-primary" disabled={saving} onClick={() => save("PUBLISHED")}>
          {saving && <Loader2 className="h-4 w-4 animate-spin" />}
          {isPublished ? "Actualizar" : meta.publishedAt && new Date(meta.publishedAt) > new Date() ? "Programar" : "Publicar"}
        </button>
      </header>

      <div className="relative flex min-h-0 flex-1">
        {/* Panel izquierdo */}
        <aside className={cn("absolute inset-y-0 left-0 z-20 w-72 shrink-0 flex-col border-r border-zinc-200 bg-white shadow-pop lg:static lg:flex lg:shadow-none", mobilePanel === "left" ? "flex" : "hidden")}>
          <div className="flex items-center gap-1 border-b border-zinc-100 p-2">
            <button onClick={() => setPanel("add")} className={cn("flex flex-1 items-center justify-center gap-1.5 rounded-md py-1.5 text-[13px] font-medium transition", panel === "add" ? "bg-zinc-100 text-zinc-900" : "text-zinc-500 hover:text-zinc-800")}>
              <Plus className="h-4 w-4" /> Añadir
            </button>
            <button onClick={() => setPanel("layers")} className={cn("flex flex-1 items-center justify-center gap-1.5 rounded-md py-1.5 text-[13px] font-medium transition", panel === "layers" ? "bg-zinc-100 text-zinc-900" : "text-zinc-500 hover:text-zinc-800")}>
              <Layers className="h-4 w-4" /> Estructura <span className="text-xs text-zinc-400">{blocks.length}</span>
            </button>
            <button className="btn-icon btn-ghost lg:hidden" onClick={() => setMobilePanel(null)}><X className="h-4 w-4" /></button>
          </div>
          <div className="scrollbar-thin min-h-0 flex-1 overflow-y-auto p-3">
            {panel === "add" ? (
              <BlockLibrary canHtml={canHtml} onAdd={(t) => { addBlock(t); setMobilePanel(null); }} insertAt={insertAt} onCancelInsert={() => setInsertAt(null)} />
            ) : (
              <LayerList blocks={blocks} selected={selected} onSelect={select} onReorder={(b) => setBlocks(b)} onRemove={remove} onDuplicate={duplicate} onAdd={() => setPanel("add")} />
            )}
          </div>
        </aside>

        {/* Lienzo */}
        <main className="flex min-w-0 flex-1 flex-col">
          <div className="flex items-center justify-between gap-2 border-b border-zinc-200 bg-white px-3 py-1.5 lg:hidden">
            <button className="btn-secondary btn-sm" onClick={() => setMobilePanel("left")}><Plus className="h-3.5 w-3.5" /> Bloques</button>
            <button className="btn-secondary btn-sm" onClick={() => setMobilePanel("right")}><Settings2 className="h-3.5 w-3.5" /> {selected ? "Editar bloque" : "Ajustes"}</button>
          </div>
          <div className="flex min-h-0 flex-1 justify-center overflow-hidden p-3 sm:p-5">
            <div className="h-full overflow-hidden rounded-xl bg-white shadow-pop ring-1 ring-zinc-900/5 transition-all duration-300" style={{ width: deviceWidth, maxWidth: "100%" }}>
              <CanvasFrame className="h-full w-full border-0" onKeyDown={onKey}>
                <div className="nx" data-theme={theme.id} data-header={theme.settings.headerStyle} data-btn={theme.settings.buttonStyle} style={{ ...vars, minHeight: "100vh" }} onClick={() => select(null)}>
                  <link rel="stylesheet" href={googleFontsHref(theme.settings)} />
                  {blocks.length === 0 ? (
                    <EmptyCanvas onAdd={() => { setPanel("add"); setMobilePanel("left"); }} />
                  ) : (
                    blocks.map((b, i) => (
                      <div
                        key={b.id}
                        id={`cb-${b.id}`}
                        className={cn("canvas-block group/cb", selected === b.id && "selected")}
                        onClick={(e) => { e.stopPropagation(); select(b.id); }}
                      >
                        <RenderBlock block={b} ctx={renderCtx} />
                        {selected === b.id && (
                          <div className="cb-tools absolute right-3 top-3 z-10 flex items-center gap-0.5 rounded-lg bg-zinc-900 p-0.5 font-sans text-white shadow-pop" onClick={(e) => e.stopPropagation()}>
                            <span className="px-2 text-[11px] font-medium">{getBlockDef(b.type)?.name}</span>
                            <ToolBtn title="Subir" onClick={() => move(b.id, -1)} disabled={i === 0}><ChevronUp className="h-3.5 w-3.5" /></ToolBtn>
                            <ToolBtn title="Bajar" onClick={() => move(b.id, 1)} disabled={i === blocks.length - 1}><ChevronDown className="h-3.5 w-3.5" /></ToolBtn>
                            <ToolBtn title="Duplicar" onClick={() => duplicate(b.id)}><Copy className="h-3.5 w-3.5" /></ToolBtn>
                            <ToolBtn title="Eliminar" onClick={() => remove(b.id)}><Trash2 className="h-3.5 w-3.5" /></ToolBtn>
                          </div>
                        )}
                        <button
                          type="button"
                          title="Insertar bloque aquí"
                          className="cb-tools absolute -bottom-3 left-1/2 z-10 grid h-6 w-6 -translate-x-1/2 place-items-center rounded-full bg-brand-600 text-white opacity-0 shadow-pop transition hover:scale-110 group-hover/cb:opacity-100"
                          onClick={(e) => { e.stopPropagation(); setInsertAt(i + 1); setPanel("add"); setMobilePanel("left"); }}
                        >
                          <Plus className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </CanvasFrame>
            </div>
          </div>
        </main>

        {/* Panel derecho */}
        <aside className={cn("absolute inset-y-0 right-0 z-20 w-[22rem] max-w-full shrink-0 flex-col border-l border-zinc-200 bg-white shadow-pop lg:static lg:flex lg:shadow-none", mobilePanel === "right" ? "flex" : "hidden")}>
          {rightPanel === "block" && selectedBlock && selectedDef ? (
            <>
              <div className="flex items-center gap-2.5 border-b border-zinc-100 px-4 py-3">
                <span className="grid h-8 w-8 place-items-center rounded-lg bg-brand-50 text-brand-700"><Icon name={selectedDef.icon} size={16} /></span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold">{selectedDef.name}</p>
                  <p className="truncate text-xs text-zinc-500">{selectedDef.description}</p>
                </div>
                <button className="btn-icon btn-ghost" onClick={() => { select(null); setMobilePanel(null); }}><X className="h-4 w-4" /></button>
              </div>
              <div className="scrollbar-thin min-h-0 flex-1 overflow-y-auto p-4">
                {selectedBlock.type === "html" && !canHtml ? (
                  <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800">Solo un administrador puede editar este bloque.</p>
                ) : (
                  <Fields
                    key={selectedBlock.id}
                    fields={blockFields(selectedDef)}
                    data={selectedBlock.data}
                    ctx={fieldsCtx}
                    onChange={(d) => setBlocks((bs) => bs.map((b) => (b.id === selectedBlock.id ? { ...b, data: d } : b)), true)}
                  />
                )}
              </div>
              <div className="flex justify-between border-t border-zinc-100 px-4 py-2.5">
                <button className="btn-ghost btn-sm" onClick={() => duplicate(selectedBlock.id)}><Copy className="h-3.5 w-3.5" /> Duplicar</button>
                <button className="btn-danger-ghost btn-sm" onClick={() => remove(selectedBlock.id)}><Trash2 className="h-3.5 w-3.5" /> Eliminar bloque</button>
              </div>
            </>
          ) : (
            <PageSettings
              meta={meta}
              update={updateMeta}
              siteId={siteId}
              canManage={canManage}
              publicUrl={props.publicUrl}
              isHome={props.isHome}
              revisions={props.revisions}
              onUnpublish={() => save("DRAFT")}
              onClose={() => setMobilePanel(null)}
            />
          )}
        </aside>
      </div>
    </div>
  );
}

function ToolBtn({ children, ...p }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button type="button" {...p} className="grid h-6 w-6 place-items-center rounded-md transition hover:bg-white/15 disabled:opacity-30">{children}</button>;
}

function EmptyCanvas({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="grid min-h-[80vh] place-items-center p-10 font-sans">
      <div className="text-center">
        <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-brand-50 text-brand-600"><LayoutTemplate className="h-7 w-7" /></div>
        <h3 className="text-lg font-semibold text-zinc-900">Tu página está vacía</h3>
        <p className="mt-1 text-sm text-zinc-500">Añade bloques desde el panel de la izquierda para empezar.</p>
        <button className="cb-tools btn-primary mt-5" onClick={(e) => { e.stopPropagation(); onAdd(); }}><Plus className="h-4 w-4" /> Añadir primer bloque</button>
      </div>
    </div>
  );
}

function BlockLibrary({ onAdd, canHtml, insertAt, onCancelInsert }: { onAdd: (type: string) => void; canHtml: boolean; insertAt: number | null; onCancelInsert: () => void }) {
  const [q, setQ] = useState("");
  const list = BLOCKS.filter((b) => (!b.cap || canHtml) && (!q || `${b.name} ${b.description}`.toLowerCase().includes(q.toLowerCase())));
  const cats = Object.keys(CATEGORY_LABELS) as BlockCategory[];
  return (
    <div>
      {insertAt !== null && (
        <div className="mb-3 flex items-center justify-between rounded-lg bg-brand-50 px-3 py-2 text-xs font-medium text-brand-800">
          Insertando en la posición {insertAt + 1}
          <button onClick={onCancelInsert} className="text-brand-600 hover:text-brand-900"><X className="h-3.5 w-3.5" /></button>
        </div>
      )}
      <div className="relative mb-3">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-400" />
        <input className="input py-1.5 pl-8 text-[13px]" placeholder="Buscar bloques…" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      {cats.map((c) => {
        const items = list.filter((b) => b.category === c);
        if (!items.length) return null;
        return (
          <div key={c} className="mb-4">
            <p className="mb-2 px-1 text-[10px] font-semibold uppercase tracking-wider text-zinc-400">{CATEGORY_LABELS[c]}</p>
            <div className="grid grid-cols-2 gap-1.5">
              {items.map((b) => (
                <button key={b.type} onClick={() => onAdd(b.type)} title={b.description} className="group flex flex-col items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-2 py-3 text-center transition hover:border-brand-300 hover:bg-brand-50/50 hover:shadow-sm">
                  <span className="grid h-8 w-8 place-items-center rounded-md bg-zinc-100 text-zinc-600 transition group-hover:bg-brand-100 group-hover:text-brand-700"><Icon name={b.icon} size={16} /></span>
                  <span className="text-[12px] font-medium leading-tight text-zinc-700">{b.name}</span>
                </button>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function LayerItem({ block, selected, onSelect, onRemove, onDuplicate }: { block: Block; selected: boolean; onSelect: () => void; onRemove: () => void; onDuplicate: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: block.id });
  const def = getBlockDef(block.type);
  const d = block.data;
  const summary = d.title || d.text || d.question || (d.html ? String(d.html).replace(/<[^>]+>/g, " ").trim() : "") || "";
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn("group flex items-center gap-1.5 rounded-lg border bg-white px-1.5 py-1.5 transition", selected ? "border-brand-300 bg-brand-50/60" : "border-transparent hover:bg-zinc-50", isDragging && "z-10 shadow-pop")}
    >
      <button {...attributes} {...listeners} className="cursor-grab touch-none p-0.5 text-zinc-300 hover:text-zinc-600 active:cursor-grabbing" aria-label="Arrastrar"><GripVertical className="h-4 w-4" /></button>
      <button onClick={onSelect} className="flex min-w-0 flex-1 items-center gap-2 text-left">
        <span className={cn("grid h-7 w-7 shrink-0 place-items-center rounded-md", selected ? "bg-brand-100 text-brand-700" : "bg-zinc-100 text-zinc-500")}><Icon name={def?.icon ?? "star"} size={14} /></span>
        <span className="min-w-0">
          <span className="block text-[13px] font-medium text-zinc-800">{def?.name}</span>
          {summary && <span className="block truncate text-[11px] text-zinc-500">{String(summary).slice(0, 60)}</span>}
        </span>
      </button>
      <div className="flex opacity-0 transition group-hover:opacity-100">
        <button title="Duplicar" onClick={onDuplicate} className="btn-icon btn-ghost p-1"><Copy className="h-3.5 w-3.5" /></button>
        <button title="Eliminar" onClick={onRemove} className="btn-icon btn-ghost p-1 hover:text-red-600"><Trash2 className="h-3.5 w-3.5" /></button>
      </div>
    </div>
  );
}

function LayerList({ blocks, selected, onSelect, onReorder, onRemove, onDuplicate, onAdd }: { blocks: Block[]; selected: string | null; onSelect: (id: string) => void; onReorder: (b: Block[]) => void; onRemove: (id: string) => void; onDuplicate: (id: string) => void; onAdd: () => void }) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));
  const onDragEnd = (e: DragEndEvent) => {
    if (!e.over || e.active.id === e.over.id) return;
    const from = blocks.findIndex((b) => b.id === e.active.id);
    const to = blocks.findIndex((b) => b.id === e.over!.id);
    onReorder(arrayMove(blocks, from, to));
  };
  if (!blocks.length) {
    return (
      <div className="py-10 text-center text-sm text-zinc-500">
        No hay bloques todavía.
        <button className="btn-secondary btn-sm mx-auto mt-3 flex" onClick={onAdd}><Plus className="h-3.5 w-3.5" /> Añadir bloque</button>
      </div>
    );
  }
  return (
    <>
      <p className="mb-2 px-1 text-[11px] text-zinc-500">Arrastra para reordenar. Haz clic para editar.</p>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={blocks.map((b) => b.id)} strategy={verticalListSortingStrategy}>
          <div className="space-y-0.5">
            {blocks.map((b) => (
              <LayerItem key={b.id} block={b} selected={selected === b.id} onSelect={() => onSelect(b.id)} onRemove={() => onRemove(b.id)} onDuplicate={() => onDuplicate(b.id)} />
            ))}
          </div>
        </SortableContext>
      </DndContext>
      <button className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-zinc-300 py-2 text-[13px] font-medium text-zinc-600 transition hover:border-brand-400 hover:bg-brand-50/50 hover:text-brand-700" onClick={onAdd}>
        <Plus className="h-3.5 w-3.5" /> Añadir bloque
      </button>
    </>
  );
}

type Meta = Omit<PageData, "blocks"> & { blocks?: undefined };

function toLocalInput(iso: string | null | undefined) {
  if (!iso) return "";
  const d = new Date(iso);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

function PageSettings({ meta, update, siteId, canManage, publicUrl, isHome, revisions, onUnpublish, onClose }: {
  meta: Meta; update: (p: Partial<Meta>) => void; siteId: string; canManage: boolean; publicUrl: string; isHome: boolean; revisions: Revision[]; onUnpublish: () => void; onClose: () => void;
}) {
  const [restoring, setRestoring] = useState<string | null>(null);
  const seoTitle = meta.seoTitle || meta.title;
  const seoDesc = meta.seoDescription || "Añade una descripción para que Google muestre un resumen atractivo de esta página.";
  return (
    <>
      <div className="flex items-center justify-between border-b border-zinc-100 px-4 py-3">
        <p className="text-sm font-semibold">Ajustes de la página</p>
        <button className="btn-icon btn-ghost lg:hidden" onClick={onClose}><X className="h-4 w-4" /></button>
      </div>
      <div className="scrollbar-thin min-h-0 flex-1 space-y-6 overflow-y-auto p-4">
        <section className="space-y-4">
          <div>
            <label className="label">URL de la página</label>
            <div className="flex items-center overflow-hidden rounded-lg border border-zinc-200 bg-zinc-50 shadow-sm focus-within:border-brand-500 focus-within:ring-4 focus-within:ring-brand-500/15">
              <span className="pl-3 text-sm text-zinc-400">/</span>
              <input className="w-full bg-white px-1.5 py-2 text-sm outline-none disabled:bg-zinc-50 disabled:text-zinc-500" value={meta.slug} disabled={!canManage || isHome} onChange={(e) => update({ slug: e.target.value })} />
            </div>
            <p className="help">{isHome ? "Esta página es la portada y se muestra en la raíz del sitio." : <a className="text-brand-600 hover:underline" href={`${publicUrl}/${meta.slug}`} target="_blank" rel="noreferrer">{publicUrl.replace(/^https?:\/\//, "")}/{meta.slug}</a>}</p>
          </div>
          <div>
            <label className="label">Fecha de publicación</label>
            <input type="datetime-local" className="input" value={toLocalInput(meta.publishedAt)} onChange={(e) => update({ publishedAt: e.target.value ? new Date(e.target.value).toISOString() : null })} />
            <p className="help">Elige una fecha futura para programar la publicación.</p>
          </div>
          {meta.status === "PUBLISHED" && (
            <button className="btn-secondary btn-sm w-full" onClick={onUnpublish}>Pasar a borrador (despublicar)</button>
          )}
        </section>

        <section className="space-y-4 border-t border-zinc-100 pt-5">
          <h3 className="text-[13px] font-semibold text-zinc-900">SEO y redes sociales</h3>
          <div className="rounded-lg border border-zinc-200 p-3">
            <p className="text-[11px] text-zinc-500">Vista previa en Google</p>
            <p className="mt-1 truncate text-[15px] text-[#1a0dab]">{seoTitle}</p>
            <p className="truncate text-xs text-emerald-700">{publicUrl.replace(/^https?:\/\//, "")}{isHome ? "" : `/${meta.slug}`}</p>
            <p className="mt-0.5 line-clamp-2 text-xs text-zinc-600">{seoDesc}</p>
          </div>
          <div>
            <label className="label">Título SEO</label>
            <input className="input" value={meta.seoTitle ?? ""} placeholder={meta.title} onChange={(e) => update({ seoTitle: e.target.value })} />
            <p className={cn("help", (meta.seoTitle?.length ?? 0) > 60 && "text-amber-600")}>{meta.seoTitle?.length ?? 0}/60 caracteres recomendados</p>
          </div>
          <div>
            <label className="label">Meta descripción</label>
            <textarea className="input" value={meta.seoDescription ?? ""} onChange={(e) => update({ seoDescription: e.target.value })} />
            <p className={cn("help", (meta.seoDescription?.length ?? 0) > 160 && "text-amber-600")}>{meta.seoDescription?.length ?? 0}/160 caracteres recomendados</p>
          </div>
          <div>
            <label className="label">Imagen para redes sociales</label>
            <ImageField siteId={siteId} value={meta.ogImage ?? ""} onChange={(v) => update({ ogImage: v })} compact />
          </div>
          <Switch label="Ocultar de buscadores" description="Añade «noindex» para que Google no la indexe." checked={!!meta.noindex} onChange={(v) => update({ noindex: v })} />
        </section>

        <section className="border-t border-zinc-100 pt-5">
          <h3 className="mb-3 flex items-center gap-1.5 text-[13px] font-semibold text-zinc-900"><History className="h-4 w-4" /> Historial de versiones</h3>
          {revisions.length ? (
            <ul className="space-y-1">
              {revisions.map((r) => (
                <li key={r.id} className="flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-xs hover:bg-zinc-50">
                  <span title={formatDateTime(r.createdAt)}>
                    <span className="font-medium text-zinc-800">{timeAgo(r.createdAt)}</span>
                    {r.author && <span className="text-zinc-500"> · {r.author}</span>}
                  </span>
                  <button
                    className="btn-ghost btn-sm"
                    disabled={!!restoring}
                    onClick={async () => {
                      if (!confirm("¿Restaurar esta versión? La versión actual quedará guardada en el historial.")) return;
                      setRestoring(r.id);
                      const res = await restoreRevision(siteId, r.id);
                      if (res.error) { toast.error(res.error); setRestoring(null); }
                      else window.location.reload();
                    }}
                  >
                    {restoring === r.id ? <Loader2 className="h-3 w-3 animate-spin" /> : "Restaurar"}
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-zinc-500">Cada vez que guardes se creará una versión que podrás restaurar.</p>
          )}
        </section>
      </div>
    </>
  );
}
