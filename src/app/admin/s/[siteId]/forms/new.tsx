"use client";
import { useState } from "react";
import { Plus } from "lucide-react";
import { ActionForm, Modal, Submit, type ActionResult } from "@/components/admin/client";

export function NewFormButton({ action }: { action: (fd: FormData) => Promise<ActionResult> }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button className="btn-primary" onClick={() => setOpen(true)}><Plus className="h-4 w-4" /> Nuevo formulario</button>
      <Modal open={open} onClose={() => setOpen(false)} title="Nuevo formulario" size="sm">
        <ActionForm action={action} success={null} className="space-y-4">
          <div><label className="label">Nombre</label><input name="name" required className="input" placeholder="Solicitud de presupuesto" autoFocus /></div>
          <p className="text-xs text-zinc-500">Empezará con los campos de un formulario de contacto. Podrás cambiarlos después.</p>
          <div className="flex justify-end gap-2"><button type="button" className="btn-secondary" onClick={() => setOpen(false)}>Cancelar</button><Submit>Crear</Submit></div>
        </ActionForm>
      </Modal>
    </>
  );
}
