import { Users } from "lucide-react";
import { db } from "@/lib/db";
import { requireSuperadmin } from "@/lib/auth";
import { ROLE_LABELS } from "@/lib/permissions";
import { Avatar, Card, PageHeader, EmptyState } from "@/components/admin/ui";
import { ConfirmButton } from "@/components/admin/client";
import { deleteUser } from "@/app/actions/users";
import { timeAgo } from "@/lib/utils";
import { UserDialog } from "./dialog";

export const metadata = { title: "Usuarios" };

export default async function UsersPage() {
  const me = await requireSuperadmin();
  const [users, sites] = await Promise.all([
    db.user.findMany({ orderBy: [{ role: "asc" }, { name: "asc" }], include: { memberships: { include: { site: { select: { name: true } } } } } }),
    db.site.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);
  return (
    <>
      <PageHeader title="Usuarios" description="Todas las personas con acceso al panel y a qué sitios pueden entrar." actions={<UserDialog sites={sites} />} />
      <Card>
        {users.length === 0 ? <EmptyState icon={<Users className="h-6 w-6" />} title="Sin usuarios" /> : (
          <div className="overflow-x-auto">
            <table className="table-base">
              <thead><tr><th>Usuario</th><th>Rol</th><th className="hidden md:table-cell">Sitios</th><th className="hidden sm:table-cell">Último acceso</th><th /></tr></thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id} className={u.active ? "" : "opacity-50"}>
                    <td>
                      <div className="flex items-center gap-3">
                        <Avatar name={u.name} size={34} />
                        <div className="min-w-0"><p className="truncate font-medium">{u.name} {u.id === me.id && <span className="text-xs text-zinc-400">(tú)</span>}</p><p className="truncate text-xs text-zinc-500">{u.email}</p></div>
                      </div>
                    </td>
                    <td>{u.role === "SUPERADMIN" ? <span className="badge-brand">Superadmin</span> : u.active ? <span className="badge-gray">Usuario</span> : <span className="badge-amber">Desactivado</span>}</td>
                    <td className="hidden max-w-xs text-xs text-zinc-600 md:table-cell">
                      {u.role === "SUPERADMIN" ? "Todos" : u.memberships.length ? u.memberships.map((m) => `${m.site.name} (${ROLE_LABELS[m.role]})`).join(", ") : "—"}
                    </td>
                    <td className="hidden text-xs text-zinc-500 sm:table-cell">{u.lastLoginAt ? timeAgo(u.lastLoginAt) : "Nunca"}</td>
                    <td>
                      <div className="flex justify-end gap-1">
                        <UserDialog sites={sites} user={{ id: u.id, name: u.name, email: u.email, role: u.role, active: u.active, memberships: Object.fromEntries(u.memberships.map((m) => [m.siteId, m.role])) }} self={u.id === me.id} />
                        {u.id !== me.id && <ConfirmButton action={deleteUser.bind(null, u.id)} title="¿Eliminar usuario?" description={`Se eliminará la cuenta de ${u.name}. Su contenido se conserva.`} className="btn-ghost btn-sm text-zinc-400 hover:text-red-600">Eliminar</ConfirmButton>}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  );
}
