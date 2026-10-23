import { requireUser } from "@/lib/auth";
import { Card, PageHeader, Avatar } from "@/components/admin/ui";
import { ActionForm, Submit } from "@/components/admin/client";
import { changePassword, updateAccount } from "@/app/actions/auth";

export const metadata = { title: "Mi cuenta" };

export default async function AccountPage() {
  const user = await requireUser();
  return (
    <div className="max-w-2xl">
      <PageHeader title="Mi cuenta" />
      <div className="space-y-6">
        <Card title="Perfil">
          <ActionForm action={updateAccount} className="space-y-4 p-5">
            <div className="flex items-center gap-4">
              <Avatar name={user.name} size={52} />
              <div><p className="font-semibold">{user.name}</p><p className="text-sm text-zinc-500">{user.role === "SUPERADMIN" ? "Superadministrador" : "Usuario"}</p></div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div><label className="label">Nombre</label><input name="name" className="input" defaultValue={user.name} required /></div>
              <div><label className="label">Email</label><input name="email" type="email" className="input" defaultValue={user.email} required /></div>
            </div>
            <Submit>Guardar</Submit>
          </ActionForm>
        </Card>
        <Card title="Contraseña" description="Al cambiarla se cerrarán tus otras sesiones abiertas.">
          <ActionForm action={changePassword} success={null} resetOnSuccess className="space-y-4 p-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <div><label className="label">Contraseña actual</label><input name="current" type="password" className="input" required autoComplete="current-password" /></div>
              <div><label className="label">Nueva contraseña</label><input name="password" type="password" className="input" minLength={8} required autoComplete="new-password" /></div>
            </div>
            <Submit>Cambiar contraseña</Submit>
          </ActionForm>
        </Card>
      </div>
    </div>
  );
}
