"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, ChevronUp, ChevronDown, Loader2, AlertTriangle, Type, Mail, Phone, AlignLeft, List, CheckSquare, Hash, Calendar } from "lucide-react";
import { FIELD_TYPES, type FormField, type FormFieldType } from "@/lib/forms";
import { themeCssVars, type ThemeSettings } from "@/lib/themes";
import { cn, slugify, uid } from "@/lib/utils";
import { saveForm } from "@/app/actions/content";
import { FormBlock } from "@/components/site/FormBlock";
import { toast } from "./toast";
import { Card } from "./ui";
import { Switch } from "./client";

const TYPE_ICONS: Record<FormFieldType, React.ElementType> = { text: Type, email: Mail, tel: Phone, textarea: AlignLeft, select: List, checkbox: CheckSquare, number: Hash, date: Calendar };

type F = { id: string; slug: string; name: string; fields: FormField[]; submitLabel: string; successMessage: string; notifyEmails: string };

export function FormBuilder({ siteId, form: initial, theme, mailEnabled }: { siteId: string; form: F; theme: { id: string; settings: ThemeSettings }; mailEnabled: boolean }) {
  const [form, setForm] = useState(initial);
  const [open, setOpen] = useState<string | null>(null);
  const [saving, start] = useTransition();
  const router = useRouter();
  const set = (p: Partial<F>) => setForm((f) => ({ ...f, ...p }));
  const setField = (id: string, p: Partial<FormField>) => set({ fields: form.fields.map((f) => (f.id === id ? { ...f, ...p } : f)) });
  const move = (i: number, d: number) => {
    const n = [...form.fields];
    const [x] = n.splice(i, 1);
    n.splice(i + d, 0, x);
    set({ fields: n });
  };
  const add = (type: FormFieldType) => {
    const label = FIELD_TYPES.find((t) => t.value === type)!.label;
    const f: FormField = { id: `${type}_${uid().slice(0, 4)}`, type, label, required: false, width: "full", options: type === "select" ? "Opción 1\nOpción 2" : "" };
    set({ fields: [...form.fields, f] });
    setOpen(f.id);
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
      <div className="space-y-6">
        <Card title="Campos" description="Haz clic en un campo para editarlo.">
          <div className="space-y-1.5 p-4">
            {form.fields.map((f, i) => {
              const I = TYPE_ICONS[f.type];
              return (
                <div key={i} className={cn("rounded-lg border transition", open === f.id ? "border-brand-300 shadow-sm" : "border-zinc-200")}>
                  <div className="flex items-center gap-2 px-2.5 py-2">
                    <span className="grid h-7 w-7 place-items-center rounded-md bg-zinc-100 text-zinc-500"><I className="h-3.5 w-3.5" /></span>
                    <button className="min-w-0 flex-1 text-left" onClick={() => setOpen(open === f.id ? null : f.id)}>
                      <span className="block truncate text-sm font-medium">{f.label || "Sin etiqueta"} {f.required && <span className="text-brand-600">*</span>}</span>
                      <span className="text-[11px] text-zinc-500">{FIELD_TYPES.find((t) => t.value === f.type)?.label}{f.width === "half" ? " · media anchura" : ""}</span>
                    </button>
                    <button className="btn-icon btn-ghost p-1" disabled={i === 0} onClick={() => move(i, -1)}><ChevronUp className="h-4 w-4" /></button>
                    <button className="btn-icon btn-ghost p-1" disabled={i === form.fields.length - 1} onClick={() => move(i, 1)}><ChevronDown className="h-4 w-4" /></button>
                    <button className="btn-icon btn-ghost p-1 hover:text-red-600" onClick={() => set({ fields: form.fields.filter((x) => x.id !== f.id) })}><Trash2 className="h-4 w-4" /></button>
                  </div>
                  {open === f.id && (
                    <div className="grid gap-3 border-t border-zinc-100 bg-zinc-50/50 p-3 sm:grid-cols-2">
                      <div className="sm:col-span-2"><label className="label">Etiqueta</label><input className="input" value={f.label} onChange={(e) => setField(f.id, { label: e.target.value })} /></div>
                      <div>
                        <label className="label">Tipo</label>
                        <select className="input" value={f.type} onChange={(e) => setField(f.id, { type: e.target.value as FormFieldType })}>
                          {FIELD_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="label">Ancho</label>
                        <select className="input" value={f.width ?? "full"} onChange={(e) => setField(f.id, { width: e.target.value as "full" | "half" })}>
                          <option value="full">Completo</option><option value="half">Mitad</option>
                        </select>
                      </div>
                      {f.type !== "checkbox" && <div className="sm:col-span-2"><label className="label">Texto de ayuda (placeholder)</label><input className="input" value={f.placeholder ?? ""} onChange={(e) => setField(f.id, { placeholder: e.target.value })} /></div>}
                      {f.type === "select" && <div className="sm:col-span-2"><label className="label">Opciones (una por línea)</label><textarea className="input" value={f.options ?? ""} onChange={(e) => setField(f.id, { options: e.target.value })} /></div>}
                      <div><label className="label">Identificador</label><input className="input font-mono text-xs" value={f.id} onChange={(e) => { const nid = slugify(e.target.value).replace(/[/-]/g, "_"); setField(f.id, { id: nid }); setOpen(nid); }} /></div>
                      <div className="flex items-end pb-2"><Switch label="Obligatorio" checked={!!f.required} onChange={(v) => setField(f.id, { required: v })} /></div>
                    </div>
                  )}
                </div>
              );
            })}
            <div className="pt-2">
              <p className="mb-2 text-xs font-medium text-zinc-500">Añadir campo</p>
              <div className="flex flex-wrap gap-1.5">
                {FIELD_TYPES.map((t) => {
                  const I = TYPE_ICONS[t.value];
                  return <button key={t.value} className="btn-secondary btn-sm" onClick={() => add(t.value)}><Plus className="h-3 w-3" /><I className="h-3.5 w-3.5" /> {t.label}</button>;
                })}
              </div>
            </div>
          </div>
        </Card>
        <Card title="Ajustes">
          <div className="space-y-4 p-5">
            <div><label className="label">Nombre interno</label><input className="input" value={form.name} onChange={(e) => set({ name: e.target.value })} /></div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div><label className="label">Texto del botón</label><input className="input" value={form.submitLabel} onChange={(e) => set({ submitLabel: e.target.value })} /></div>
              <div><label className="label">Mensaje de confirmación</label><input className="input" value={form.successMessage} onChange={(e) => set({ successMessage: e.target.value })} /></div>
            </div>
            <div>
              <label className="label">Enviar avisos a</label>
              <input className="input" value={form.notifyEmails} onChange={(e) => set({ notifyEmails: e.target.value })} placeholder="hola@cliente.com, otro@cliente.com" />
              <p className="help">Separa varios emails con comas. Si lo dejas vacío, se avisa al email de contacto del sitio (Ajustes → Contacto) o, si no hay, a los administradores. Los mensajes siempre se guardan en «Mensajes».</p>
              {!mailEnabled && <p className="mt-2 flex items-center gap-1.5 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800"><AlertTriangle className="h-3.5 w-3.5" /> El servidor no tiene SMTP configurado: los avisos por email no se enviarán.</p>}
            </div>
          </div>
        </Card>
        <div className="flex justify-end">
          <button className="btn-primary" disabled={saving} onClick={() => start(async () => { const r = await saveForm(siteId, form.id, form); if (r.error) toast.error(r.error); else { toast(r.message!); router.refresh(); } })}>
            {saving && <Loader2 className="h-4 w-4 animate-spin" />} Guardar formulario
          </button>
        </div>
      </div>
      <div className="lg:sticky lg:top-6 lg:h-fit">
        <p className="mb-2 text-xs font-medium uppercase tracking-wider text-zinc-500">Vista previa</p>
        <div className="nx overflow-hidden rounded-xl border border-zinc-200" data-theme={theme.id} data-btn={theme.settings.buttonStyle} style={{ ...(themeCssVars(theme.settings) as React.CSSProperties), minHeight: 0, padding: 24, background: "var(--c-surface)" }}>
          <FormBlock form={{ id: form.id, fields: form.fields, submitLabel: form.submitLabel, successMessage: form.successMessage }} preview />
        </div>
        <p className="mt-3 text-xs text-zinc-500">Para mostrarlo en la web, edita una página y añade el bloque <strong>Formulario</strong>. Para webs headless: <code className="rounded bg-zinc-100 px-1">POST /api/v1/forms/{form.slug}</code></p>
      </div>
    </div>
  );
}
