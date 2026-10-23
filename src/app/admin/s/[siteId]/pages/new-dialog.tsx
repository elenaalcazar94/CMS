"use client";
import { useState } from "react";
import { Plus, Check, FileText, Home, Users, Briefcase, Mail, Rocket, Scale } from "lucide-react";
import { ActionForm, Modal, Submit } from "@/components/admin/client";
import type { ActionResult } from "@/components/admin/client";
import { cn } from "@/lib/utils";

const ICONS: Record<string, React.ElementType> = { blank: FileText, home: Home, about: Users, services: Briefcase, contact: Mail, landing: Rocket, legal: Scale };

export function NewPageDialog({ action, templates, defaultOpen }: { action: (fd: FormData) => Promise<ActionResult>; templates: { id: string; name: string; description: string }[]; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(!!defaultOpen);
  const [tpl, setTpl] = useState("blank");
  return (
    <>
      <button className="btn-primary" onClick={() => setOpen(true)}><Plus className="h-4 w-4" /> Nueva página</button>
      <Modal open={open} onClose={() => setOpen(false)} title="Nueva página" size="lg">
        <ActionForm action={action} success={null} className="space-y-5">
          <div>
            <label className="label">Título</label>
            <input name="title" className="input" placeholder="Ej.: Nuestros servicios" required autoFocus />
          </div>
          <div>
            <label className="label">Empieza con una plantilla</label>
            <input type="hidden" name="template" value={tpl} />
            <div className="grid gap-2 sm:grid-cols-2">
              {templates.map((t) => {
                const I = ICONS[t.id] ?? FileText;
                return (
                  <button type="button" key={t.id} onClick={() => setTpl(t.id)} className={cn("relative flex items-start gap-3 rounded-xl border-2 p-3 text-left transition", tpl === t.id ? "border-brand-500 bg-brand-50/40" : "border-zinc-200 hover:border-zinc-300")}>
                    <span className={cn("grid h-9 w-9 shrink-0 place-items-center rounded-lg", tpl === t.id ? "bg-brand-600 text-white" : "bg-zinc-100 text-zinc-600")}><I className="h-4 w-4" /></span>
                    <span>
                      <span className="block text-sm font-semibold">{t.name}</span>
                      <span className="block text-xs leading-snug text-zinc-500">{t.description}</span>
                    </span>
                    {tpl === t.id && <Check className="absolute right-3 top-3 h-4 w-4 text-brand-600" />}
                  </button>
                );
              })}
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
