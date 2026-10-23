"use client";
import { useState } from "react";
import { ChevronDown, ChevronUp, Plus, Trash2, GripVertical, Copy } from "lucide-react";
import { ICON_OPTIONS, type FieldDef } from "@/lib/blocks";
import { cn, uid } from "@/lib/utils";
import { Icon } from "@/components/Icon";
import { Switch } from "../client";
import { RichText } from "../RichText";
import { ImageField, GalleryField } from "../MediaLibrary";

export type FieldsCtx = {
  siteId: string;
  forms: { id: string; name: string }[];
  links: { label: string; url: string }[];
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Data = Record<string, any>;

export function Fields({ fields, data, onChange, ctx }: { fields: FieldDef[]; data: Data; onChange: (d: Data) => void; ctx: FieldsCtx }) {
  return (
    <div className="space-y-4">
      {fields.map((f) => (
        <FieldControl key={f.key} field={f} value={data[f.key]} onChange={(v) => onChange({ ...data, [f.key]: v })} ctx={ctx} />
      ))}
    </div>
  );
}

function UrlInput({ value, onChange, ctx, placeholder }: { value: string; onChange: (v: string) => void; ctx: FieldsCtx; placeholder?: string }) {
  const [open, setOpen] = useState(false);
  const q = (value ?? "").toLowerCase();
  const matches = ctx.links.filter((l) => !q || l.label.toLowerCase().includes(q) || l.url.includes(q)).slice(0, 8);
  return (
    <div className="relative">
      <input
        className="input"
        value={value ?? ""}
        placeholder={placeholder ?? "/pagina, #seccion o https://…"}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
      />
      {open && matches.length > 0 && (
        <div className="animate-pop absolute left-0 right-0 top-full z-30 mt-1 max-h-56 overflow-y-auto rounded-lg border border-zinc-200 bg-white p-1 shadow-pop">
          <p className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-zinc-400">Enlazar a una página</p>
          {matches.map((l) => (
            <button key={l.url} type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => { onChange(l.url); setOpen(false); }} className="flex w-full items-center justify-between gap-3 rounded-md px-2 py-1.5 text-left text-[13px] hover:bg-zinc-100">
              <span className="truncate">{l.label}</span>
              <span className="shrink-0 text-xs text-zinc-400">{l.url}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function IconPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <button type="button" onClick={() => setOpen(!open)} className="input flex items-center gap-2 text-left">
        <span className="grid h-6 w-6 place-items-center rounded-md bg-brand-50 text-brand-700"><Icon name={value || "star"} size={14} /></span>
        <span className="flex-1 text-zinc-700">{value || "star"}</span>
        <ChevronDown className="h-4 w-4 text-zinc-400" />
      </button>
      {open && (
        <div className="mt-1.5 grid grid-cols-6 gap-1 rounded-lg border border-zinc-200 bg-white p-1.5">
          {ICON_OPTIONS.map((n) => (
            <button key={n} type="button" title={n} onClick={() => { onChange(n); setOpen(false); }} className={cn("grid aspect-square place-items-center rounded-md transition hover:bg-zinc-100", value === n && "bg-brand-50 text-brand-700 ring-1 ring-brand-300")}>
              <Icon name={n} size={16} />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function ListField({ field, value, onChange, ctx }: { field: Extract<FieldDef, { type: "list" }>; value: Data[]; onChange: (v: Data[]) => void; ctx: FieldsCtx }) {
  const items = Array.isArray(value) ? value : [];
  const [open, setOpen] = useState<number | null>(items.length ? 0 : null);
  const update = (i: number, d: Data) => onChange(items.map((it, j) => (j === i ? d : it)));
  const move = (i: number, dir: number) => {
    const n = [...items];
    const [x] = n.splice(i, 1);
    n.splice(i + dir, 0, x);
    onChange(n);
    setOpen(i + dir);
  };
  return (
    <div className="space-y-1.5">
      {items.map((it, i) => (
        <div key={i} className={cn("overflow-hidden rounded-lg border bg-white transition", open === i ? "border-brand-200 shadow-sm" : "border-zinc-200")}>
          <div className="flex items-center gap-1 pl-2 pr-1">
            <GripVertical className="h-3.5 w-3.5 shrink-0 text-zinc-300" />
            <button type="button" onClick={() => setOpen(open === i ? null : i)} className="min-w-0 flex-1 truncate py-2 text-left text-[13px] font-medium text-zinc-800">
              {(field.titleKey && it[field.titleKey]) || `${field.itemLabel} ${i + 1}`}
            </button>
            <button type="button" title="Subir" disabled={i === 0} onClick={() => move(i, -1)} className="btn-icon btn-ghost p-1 disabled:opacity-20"><ChevronUp className="h-3.5 w-3.5" /></button>
            <button type="button" title="Bajar" disabled={i === items.length - 1} onClick={() => move(i, 1)} className="btn-icon btn-ghost p-1 disabled:opacity-20"><ChevronDown className="h-3.5 w-3.5" /></button>
            <button type="button" title="Duplicar" onClick={() => { const n = [...items]; n.splice(i + 1, 0, structuredClone(it)); onChange(n); }} className="btn-icon btn-ghost p-1"><Copy className="h-3.5 w-3.5" /></button>
            <button type="button" title="Eliminar" onClick={() => { onChange(items.filter((_, j) => j !== i)); setOpen(null); }} className="btn-icon btn-ghost p-1 hover:text-red-600"><Trash2 className="h-3.5 w-3.5" /></button>
          </div>
          {open === i && (
            <div className="border-t border-zinc-100 bg-zinc-50/50 p-3">
              <Fields fields={field.fields} data={it} onChange={(d) => update(i, d)} ctx={ctx} />
            </div>
          )}
        </div>
      ))}
      <button type="button" onClick={() => { onChange([...items, structuredClone(field.newItem)]); setOpen(items.length); }} className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-zinc-300 py-2 text-[13px] font-medium text-zinc-600 transition hover:border-brand-400 hover:bg-brand-50/50 hover:text-brand-700">
        <Plus className="h-3.5 w-3.5" /> Añadir {field.itemLabel.toLowerCase()}
      </button>
    </div>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function FieldControl({ field: f, value, onChange, ctx }: { field: FieldDef; value: any; onChange: (v: any) => void; ctx: FieldsCtx }) {
  if (f.type === "toggle") return <Switch label={f.label} checked={!!value} onChange={onChange} />;

  let control: React.ReactNode;
  switch (f.type) {
    case "text":
      control = <input className="input" value={value ?? ""} placeholder={f.placeholder} onChange={(e) => onChange(e.target.value)} />;
      break;
    case "textarea":
      control = <textarea className="input min-h-[72px]" value={value ?? ""} placeholder={f.placeholder} onChange={(e) => onChange(e.target.value)} />;
      break;
    case "code":
      control = <textarea className="input min-h-[200px] font-mono text-xs" spellCheck={false} value={value ?? ""} onChange={(e) => onChange(e.target.value)} />;
      break;
    case "number":
      control = <input type="number" className="input" value={value ?? ""} min={f.min} max={f.max} onChange={(e) => onChange(e.target.value === "" ? "" : Number(e.target.value))} />;
      break;
    case "url":
      control = <UrlInput value={value} onChange={onChange} ctx={ctx} placeholder={f.placeholder} />;
      break;
    case "color":
      control = (
        <div className="flex gap-2">
          <input type="color" className="h-9 w-12 cursor-pointer rounded-lg border border-zinc-200 bg-white p-1" value={value || "#000000"} onChange={(e) => onChange(e.target.value)} />
          <input className="input font-mono" value={value ?? ""} onChange={(e) => onChange(e.target.value)} />
        </div>
      );
      break;
    case "richtext":
      control = <RichText value={value ?? ""} onChange={onChange} siteId={ctx.siteId} />;
      break;
    case "image":
      control = <ImageField siteId={ctx.siteId} value={value ?? ""} onChange={onChange} />;
      break;
    case "gallery":
      control = <GalleryField siteId={ctx.siteId} value={Array.isArray(value) ? value : []} onChange={onChange} />;
      break;
    case "icon":
      control = <IconPicker value={value} onChange={onChange} />;
      break;
    case "form":
      control = ctx.forms.length ? (
        <select className="input" value={value ?? ""} onChange={(e) => onChange(e.target.value)}>
          <option value="">— Elige un formulario —</option>
          {ctx.forms.map((fm) => <option key={fm.id} value={fm.id}>{fm.name}</option>)}
        </select>
      ) : (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">Aún no hay formularios. Créalo en la sección «Formularios».</p>
      );
      break;
    case "select":
      control =
        f.options.length <= 3 ? (
          <div className="flex rounded-lg bg-zinc-100 p-0.5">
            {f.options.map((o) => (
              <button key={o.value} type="button" onClick={() => onChange(o.value)} className={cn("flex-1 rounded-md px-2 py-1.5 text-xs font-medium transition", value === o.value ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-500 hover:text-zinc-800")}>
                {o.label}
              </button>
            ))}
          </div>
        ) : (
          <select className="input" value={value ?? ""} onChange={(e) => onChange(e.target.value)}>
            {f.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        );
      break;
    case "list":
      control = <ListField field={f} value={value} onChange={onChange} ctx={ctx} />;
      break;
  }

  return (
    <div>
      <label className="label">{f.label}</label>
      {control}
      {f.help && <p className="help">{f.help}</p>}
    </div>
  );
}

export { uid };
