"use client";
import { useState } from "react";
import { ActionForm, Modal, Submit, type ActionResult } from "@/components/admin/client";

export function EditCategory({ action, category }: { action: (fd: FormData) => Promise<ActionResult>; category: { id: string; name: string; slug: string; description: string } }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button className="btn-ghost btn-sm" onClick={() => setOpen(true)}>Editar</button>
      <Modal open={open} onClose={() => setOpen(false)} title="Editar categoría" size="sm">
        <ActionForm action={action} onDone={() => setOpen(false)} className="space-y-4">
          <input type="hidden" name="id" value={category.id} />
          <div><label className="label">Nombre</label><input name="name" required className="input" defaultValue={category.name} /></div>
          <div><label className="label">Slug</label><input name="slug" className="input" defaultValue={category.slug} /></div>
          <div><label className="label">Descripción</label><textarea name="description" className="input" defaultValue={category.description} /></div>
          <div className="flex justify-end gap-2"><button type="button" className="btn-secondary" onClick={() => setOpen(false)}>Cancelar</button><Submit>Guardar</Submit></div>
        </ActionForm>
      </Modal>
    </>
  );
}
