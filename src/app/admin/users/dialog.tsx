"use client";
import { useState } from "react";
import { Plus } from "lucide-react";
import { ActionForm, Modal, Submit, Switch } from "@/components/admin/client";
import { saveUser } from "@/app/actions/users";
import { ROLE_LABELS } from "@/lib/permissions";

type U = { id: string; name: string; email: string; role: "SUPERADMIN" | "USER"; active: boolean; memberships: Record<string, string> };

export function UserDialog({ sites, user, self }: { sites: { id: string; name: string }[]; user?: U; self?: boolean }) {
  const [open, setOpen] = useState(false);
  const [role, setRole] = useState(user?.role ?? "USER");
  return (
    <>
      {user ? <button className="btn-secondary btn-sm" onClick={() => setOpen(true)}>Editar</button> : <button className="btn-primary" onClick={() => setOpen(true)}><Plus className="h-4 w-4" /> Nuevo usuario</button>}
      <Modal open={open} onClose={() => setOpen(false)} title={user ? "Editar usuario" : "Nuevo usuario"} size="lg">
        <ActionForm action={saveUser} success={null} onDone={() => setOpen(false)} className="space-y-5">
          {user && <input type="hidden" name="id" value={user.id} />}
          <div className="grid gap-4 sm:grid-cols-2">
            <div><label className="label">Nombre</label><input name="name" required className="input" defaultValue={user?.name} /></div>
            <div><label className="label">Email</label><input name="email" type="email" required className="input" defaultValue={user?.email} /></div>
            <div>
              <label className="label">{user ? "Nueva contraseña" : "Contraseña"}</label>
              <input name="password" type="text" className="input" minLength={8} placeholder={user ? "Déjalo vacío para no cambiarla" : "Vacío = se genera una"} autoComplete="new-password" />
            </div>
            <div>
              <label className="label">Tipo de cuenta</label>
              <select name="role" className="input" value={role} onChange={(e) => setRole(e.target.value as U["role"])} disabled={self}>
                <option value="USER">Usuario (acceso por sitio)</option>
                <option value="SUPERADMIN">Superadministrador (todo)</option>
              </select>
              {self && <input type="hidden" name="role" value="SUPERADMIN" />}
            </div>
          </div>
          {user && !self && <Switch name="active" checked={user.active} label="Cuenta activa" description="Si la desactivas, no podrá iniciar sesión." />}
          {role === "USER" && (
            <div>
              <label className="label">Acceso a sitios</label>
              <div className="divide-y divide-zinc-100 rounded-lg border border-zinc-200">
                {sites.length === 0 && <p className="p-4 text-sm text-zinc-500">Aún no hay sitios.</p>}
                {sites.map((s) => (
                  <div key={s.id} className="flex items-center justify-between gap-3 px-3 py-2">
                    <span className="text-sm">{s.name}</span>
                    <select name={`site:${s.id}`} className="input w-auto py-1 text-[13px]" defaultValue={user?.memberships[s.id] ?? ""}>
                      <option value="">Sin acceso</option>
                      {(["CLIENT", "EDITOR", "ADMIN"] as const).map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
                    </select>
                  </div>
                ))}
              </div>
            </div>
          )}
          <div className="flex justify-end gap-2 border-t border-zinc-100 pt-4">
            <button type="button" className="btn-secondary" onClick={() => setOpen(false)}>Cancelar</button>
            <Submit>{user ? "Guardar" : "Crear usuario"}</Submit>
          </div>
        </ActionForm>
      </Modal>
    </>
  );
}
