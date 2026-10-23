"use server";
import { z } from "zod";
import type { SiteRole } from "@prisma/client";
import { db } from "@/lib/db";
import { hashPassword, randomToken, requireSuperadmin } from "@/lib/auth";

const schema = z.object({
  name: z.string().trim().min(2, "Escribe el nombre"),
  email: z.string().trim().toLowerCase().email("Email no válido"),
  role: z.enum(["SUPERADMIN", "USER"]),
  password: z.string().optional(),
});

/** Crea o actualiza un usuario y sus accesos a sitios (campos site:<id> = rol | vacío). */
export async function saveUser(fd: FormData) {
  const me = await requireSuperadmin();
  const parsed = schema.safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { name, email, role } = parsed.data;
  const id = fd.get("id") ? String(fd.get("id")) : null;
  const password = parsed.data.password?.trim();
  if (password && password.length < 8) return { error: "La contraseña debe tener al menos 8 caracteres" };

  const clash = await db.user.findUnique({ where: { email } });
  if (clash && clash.id !== id) return { error: "Ya existe un usuario con ese email" };
  if (id === me.id && role !== "SUPERADMIN") return { error: "No puedes quitarte el rol de superadministrador" };

  let generated: string | null = null;
  let userId = id;
  if (id) {
    await db.user.update({
      where: { id },
      data: { name, email, role, active: id === me.id ? true : fd.get("active") === "on", ...(password ? { passwordHash: await hashPassword(password) } : {}) },
    });
    if (password) await db.session.deleteMany({ where: { userId: id } });
  } else {
    generated = password ? null : randomToken(9);
    const u = await db.user.create({ data: { name, email, role, passwordHash: await hashPassword(password || generated!) } });
    userId = u.id;
  }

  const entries = [...fd.entries()].filter(([k]) => k.startsWith("site:"));
  for (const [k, v] of entries) {
    const siteId = k.slice(5);
    const r = String(v);
    if (["ADMIN", "EDITOR", "CLIENT"].includes(r)) {
      await db.membership.upsert({ where: { userId_siteId: { userId: userId!, siteId } }, create: { userId: userId!, siteId, role: r as SiteRole }, update: { role: r as SiteRole } });
    } else {
      await db.membership.deleteMany({ where: { userId: userId!, siteId } });
    }
  }
  return { ok: true, message: generated ? `Usuario creado. Contraseña temporal: ${generated}` : id ? "Usuario actualizado" : "Usuario creado" };
}

export async function deleteUser(id: string) {
  const me = await requireSuperadmin();
  if (id === me.id) return { error: "No puedes eliminar tu propia cuenta" };
  await db.user.delete({ where: { id } });
  return { ok: true, message: "Usuario eliminado" };
}
