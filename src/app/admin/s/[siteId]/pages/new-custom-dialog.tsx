"use client";
import { useState } from "react";
import { Plus, Check, FileCode2 } from "lucide-react";
import { ActionForm, Modal, Submit, type ActionResult } from "@/components/admin/client";
import { cn, slugify } from "@/lib/utils";

type Tpl = { path: string; title: string; fieldCount: number };

export function NewCustomPageDialog({ action, templates, defaultOpen }: { action: (fd: FormData) => Promise<ActionResult>; templates: Tpl[]; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(!!defaultOpen);
  const [tpl, setTpl] = useState(templates.find((t) => !/^(index|404)\.html$/.test(t.path))?.path ?? templates[0]?.path ?? "");
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [touched, setTouched] = useState(false);
  const folder = tpl.replace(/\.html?$/, "").replace(/(^|\/)[^/]*$/, "");
  const suggested = `${folder ? `${folder}/` : ""}${slugify(title).replace(/\//g, "-")}`;
  return (
    <>
      <button className="btn-primary" onClick={() => setOpen(true)} disabled={!templates.length}><Plus className="h-4 w-4" /> Nueva página</button>
      <Modal open={open} onClose={() => setOpen(false)} title="Nueva página" size="lg">
        <ActionForm action={action} success={null} className="space-y-5">
          <div>
            <label className="label">¿Qué tipo de página es?</label>
            <p className="mb-2 text-xs text-zinc-500">Elige el HTML que servirá de plantilla. La página nueva tendrá su mismo diseño y empezará con sus mismos contenidos de ejemplo.</p>
            <input type="hidden" name="template" value={tpl} />
            <div className="grid max-h-64 gap-2 overflow-y-auto sm:grid-cols-2">
              {templates.map((t) => (
                <button type="button" key={t.path} onClick={() => setTpl(t.path)} className={cn("relative flex items-start gap-3 rounded-xl border-2 p-3 text-left transition", tpl === t.path ? "border-brand-500 bg-brand-50/40" : "border-zinc-200 hover:border-zinc-300")}>
                  <span className={cn("grid h-9 w-9 shrink-0 place-items-center rounded-lg", tpl === t.path ? "bg-brand-600 text-white" : "bg-zinc-100 text-zinc-600")}><FileCode2 className="h-4 w-4" /></span>
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold">{t.title}</span>
                    <span className="block truncate font-mono text-[11px] text-zinc-500">{t.path} · {t.fieldCount} zonas</span>
                  </span>
                  {tpl === t.path && <Check className="absolute right-3 top-3 h-4 w-4 text-brand-600" />}
                </button>
              ))}
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div><label className="label">Título</label><input name="title" className="input" required placeholder="Casa Luna" value={title} onChange={(e) => setTitle(e.target.value)} /></div>
            <div>
              <label className="label">URL</label>
              <div className="flex items-center overflow-hidden rounded-lg border border-zinc-200 bg-zinc-50 shadow-sm focus-within:border-brand-500">
                <span className="pl-3 text-sm text-zinc-400">/</span>
                <input name="slug" className="w-full bg-white px-1.5 py-2 text-sm outline-none" value={touched ? slug : suggested} onChange={(e) => { setTouched(true); setSlug(e.target.value); }} placeholder="proyectos/casa-luna" />
              </div>
            </div>
          </div>
          <div className="flex justify-end gap-2 border-t border-zinc-100 pt-4">
            <button type="button" className="btn-secondary" onClick={() => setOpen(false)}>Cancelar</button>
            <Submit pendingText="Creando…">Crear y editar</Submit>
          </div>
        </ActionForm>
      </Modal>
    </>
  );
}
