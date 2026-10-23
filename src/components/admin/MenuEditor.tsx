"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { DndContext, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, useSortable, verticalListSortingStrategy, arrayMove } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Trash2, ChevronDown, Plus, Loader2, IndentIncrease, IndentDecrease, Link2, FileText } from "lucide-react";
import { cn, uid } from "@/lib/utils";
import { saveMenu } from "@/app/actions/content";
import { toast } from "./toast";
import { Switch } from "./client";
import { Card } from "./ui";

export type MenuItem = { id: string; label: string; url: string; button?: boolean; newTab?: boolean; children?: MenuItem[] };
type LinkOpt = { label: string; url: string; draft: boolean };

const LOCATIONS = [
  { id: "header", label: "Menú principal", help: "Aparece en la cabecera de todas las páginas." },
  { id: "footer", label: "Menú del pie", help: "Enlaces en el pie de página: legal, contacto…" },
] as const;

function ItemRow({ item, depth, onChange, onRemove, onIndent, onOutdent, canIndent, location }: {
  item: MenuItem; depth: number; onChange: (p: Partial<MenuItem>) => void; onRemove: () => void; onIndent?: () => void; onOutdent?: () => void; canIndent: boolean; location: string;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id });
  const [open, setOpen] = useState(false);
  return (
    <div ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition, marginLeft: depth * 28 }} className={cn("rounded-lg border bg-white", isDragging ? "z-10 shadow-pop" : "", open ? "border-brand-300" : "border-zinc-200")}>
      <div className="flex items-center gap-2 px-2 py-2">
        <button {...attributes} {...listeners} className="cursor-grab touch-none text-zinc-300 hover:text-zinc-600"><GripVertical className="h-4 w-4" /></button>
        <button onClick={() => setOpen(!open)} className="flex min-w-0 flex-1 items-center gap-2 text-left">
          <span className="truncate text-sm font-medium">{item.label || "Sin texto"}</span>
          {item.button && <span className="badge-brand">Botón</span>}
          <span className="truncate font-mono text-[11px] text-zinc-400">{item.url}</span>
        </button>
        {depth === 0 && canIndent && <button title="Convertir en submenú" onClick={onIndent} className="btn-icon btn-ghost p-1"><IndentIncrease className="h-4 w-4" /></button>}
        {depth === 1 && <button title="Sacar del submenú" onClick={onOutdent} className="btn-icon btn-ghost p-1"><IndentDecrease className="h-4 w-4" /></button>}
        <button onClick={() => setOpen(!open)} className="btn-icon btn-ghost p-1"><ChevronDown className={cn("h-4 w-4 transition", open && "rotate-180")} /></button>
        <button onClick={onRemove} className="btn-icon btn-ghost p-1 hover:text-red-600"><Trash2 className="h-4 w-4" /></button>
      </div>
      {open && (
        <div className="grid gap-3 border-t border-zinc-100 bg-zinc-50/50 p-3 sm:grid-cols-2">
          <div><label className="label">Texto</label><input className="input" value={item.label} onChange={(e) => onChange({ label: e.target.value })} /></div>
          <div><label className="label">Enlace</label><input className="input" value={item.url} onChange={(e) => onChange({ url: e.target.value })} /></div>
          <Switch label="Abrir en pestaña nueva" checked={!!item.newTab} onChange={(newTab) => onChange({ newTab })} />
          {location === "header" && depth === 0 && <Switch label="Mostrar como botón" checked={!!item.button} onChange={(button) => onChange({ button })} />}
        </div>
      )}
    </div>
  );
}

/** Aplana el árbol (1 nivel) para ordenar con dnd y lo reconstruye después. */
type Flat = { item: MenuItem; depth: number };
const flatten = (items: MenuItem[]): Flat[] => items.flatMap((i) => [{ item: { ...i, children: undefined }, depth: 0 }, ...(i.children ?? []).map((c) => ({ item: c, depth: 1 }))]);
const build = (flat: Flat[]): MenuItem[] => {
  const out: MenuItem[] = [];
  for (const f of flat) {
    if (f.depth === 1 && out.length) out[out.length - 1].children!.push(f.item);
    else out.push({ ...f.item, children: [] });
  }
  return out;
};

export function MenuEditor({ siteId, header, footer, links }: { siteId: string; header: MenuItem[]; footer: MenuItem[]; links: LinkOpt[] }) {
  const [loc, setLoc] = useState<"header" | "footer">("header");
  const [menus, setMenus] = useState({ header: flatten(header), footer: flatten(footer) });
  const [custom, setCustom] = useState({ label: "", url: "" });
  const [saving, start] = useTransition();
  const router = useRouter();
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));
  const flat = menus[loc];
  const setFlat = (f: Flat[]) => setMenus((m) => ({ ...m, [loc]: f }));

  const onDragEnd = (e: DragEndEvent) => {
    if (!e.over || e.active.id === e.over.id) return;
    const from = flat.findIndex((f) => f.item.id === e.active.id);
    const to = flat.findIndex((f) => f.item.id === e.over!.id);
    const next = arrayMove(flat, from, to);
    if (next[0]?.depth === 1) next[0] = { ...next[0], depth: 0 };
    setFlat(next);
  };
  const add = (label: string, url: string) => setFlat([...flat, { item: { id: uid(), label, url }, depth: 0 }]);

  return (
    <div className="grid gap-6 lg:grid-cols-[300px_1fr]">
      <div className="space-y-4">
        <Card title="Páginas">
          <div className="max-h-72 space-y-0.5 overflow-y-auto p-2">
            {links.map((l) => (
              <button key={l.url} onClick={() => add(l.label, l.url)} className="group flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm hover:bg-zinc-100">
                <FileText className="h-4 w-4 text-zinc-400" />
                <span className="flex-1 truncate">{l.label}</span>
                {l.draft && <span className="badge-gray">Borrador</span>}
                <Plus className="h-4 w-4 text-zinc-300 group-hover:text-brand-600" />
              </button>
            ))}
          </div>
        </Card>
        <Card title="Enlace personalizado">
          <div className="space-y-3 p-4">
            <input className="input" placeholder="Texto" value={custom.label} onChange={(e) => setCustom({ ...custom, label: e.target.value })} />
            <input className="input" placeholder="https://… o #seccion" value={custom.url} onChange={(e) => setCustom({ ...custom, url: e.target.value })} />
            <button className="btn-secondary w-full" disabled={!custom.label || !custom.url} onClick={() => { add(custom.label, custom.url); setCustom({ label: "", url: "" }); }}>
              <Link2 className="h-4 w-4" /> Añadir enlace
            </button>
          </div>
        </Card>
      </div>
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-100 px-5 py-3">
          <div className="flex rounded-lg bg-zinc-100 p-0.5">
            {LOCATIONS.map((l) => (
              <button key={l.id} onClick={() => setLoc(l.id)} className={cn("rounded-md px-3 py-1.5 text-[13px] font-medium transition", loc === l.id ? "bg-white shadow-sm" : "text-zinc-500 hover:text-zinc-800")}>{l.label}</button>
            ))}
          </div>
          <button className="btn-primary" disabled={saving} onClick={() => start(async () => { const r = await saveMenu(siteId, loc, build(flat)); if (r.error) toast.error(r.error); else { toast(r.message!); router.refresh(); } })}>
            {saving && <Loader2 className="h-4 w-4 animate-spin" />} Guardar menú
          </button>
        </div>
        <div className="p-5">
          <p className="mb-4 text-sm text-zinc-500">{LOCATIONS.find((l) => l.id === loc)!.help}</p>
          {flat.length ? (
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
              <SortableContext items={flat.map((f) => f.item.id)} strategy={verticalListSortingStrategy}>
                <div className="space-y-1.5">
                  {flat.map((f, i) => (
                    <ItemRow
                      key={f.item.id}
                      item={f.item}
                      depth={f.depth}
                      location={loc}
                      canIndent={i > 0}
                      onChange={(p) => setFlat(flat.map((x, j) => (j === i ? { ...x, item: { ...x.item, ...p } } : x)))}
                      onRemove={() => setFlat(flat.filter((_, j) => j !== i))}
                      onIndent={() => setFlat(flat.map((x, j) => (j === i ? { ...x, depth: 1, item: { ...x.item, button: false } } : x)))}
                      onOutdent={() => setFlat(flat.map((x, j) => (j === i ? { ...x, depth: 0 } : x)))}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          ) : (
            <div className="rounded-xl border-2 border-dashed border-zinc-200 py-12 text-center text-sm text-zinc-500">El menú está vacío. Añade páginas desde la izquierda.</div>
          )}
        </div>
      </Card>
    </div>
  );
}
