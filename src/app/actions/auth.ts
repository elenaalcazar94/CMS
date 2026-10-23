"use server";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import {
  clientIp, createSession, destroySession, hashPassword, hashToken, randomToken, rateLimit, requireUser, verifyPassword,
} from "@/lib/auth";
import { emailLayout, mailEnabled, sendMail } from "@/lib/mail";
import { appUrl } from "@/lib/utils";

export async function login(fd: FormData) {
  const email = String(fd.get("email") ?? "").trim().toLowerCase();
  const password = String(fd.get("password") ?? "");
  const ip = await clientIp();
  if (!rateLimit(`login:${ip}`, 10, 15 * 60_000) || !rateLimit(`login:${email}`, 6, 15 * 60_000)) {
    return { error: "Demasiados intentos. Espera unos minutos e inténtalo de nuevo." };
  }
  const user = await db.user.findUnique({ where: { email } });
  // Comparamos siempre para no revelar si el email existe por tiempo de respuesta
  const ok = await verifyPassword(password, user?.passwordHash ?? "$2a$12$invalidinvalidinvalidinvalidinvalidinvalidinvalidinva");
  if (!user || !ok) return { error: "Email o contraseña incorrectos." };
  if (!user.active) return { error: "Tu cuenta está desactivada. Contacta con el administrador." };
  await createSession(user.id);
  return { ok: true, redirect: "/admin" };
}

export async function logout() {
  await destroySession();
  redirect("/login");
}

const setupSchema = z.object({
  name: z.string().trim().min(2, "Escribe tu nombre"),
  email: z.string().trim().toLowerCase().email("Email no válido"),
  password: z.string().min(8, "La contraseña debe tener al menos 8 caracteres"),
});

export async function setup(fd: FormData) {
  if ((await db.user.count()) > 0) return { error: "La instalación ya está completada." };
  const parsed = setupSchema.safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const user = await db.user.create({
    data: { name: parsed.data.name, email: parsed.data.email, passwordHash: await hashPassword(parsed.data.password), role: "SUPERADMIN" },
  });
  await createSession(user.id);
  return { ok: true, redirect: "/admin" };
}

export async function requestReset(fd: FormData) {
  const email = String(fd.get("email") ?? "").trim().toLowerCase();
  if (!rateLimit(`reset:${await clientIp()}`, 5, 30 * 60_000)) return { error: "Demasiadas solicitudes. Inténtalo más tarde." };
  if (!mailEnabled()) return { error: "El envío de correos no está configurado. Pide a tu administrador que restablezca tu contraseña." };
  const user = await db.user.findUnique({ where: { email } });
  if (user?.active) {
    const token = randomToken();
    await db.passwordResetToken.create({ data: { id: hashToken(token), userId: user.id, expiresAt: new Date(Date.now() + 3600_000) } });
    const link = `${appUrl()}/reset/${token}`;
    await sendMail({
      to: user.email,
      subject: "Restablecer tu contraseña",
      html: emailLayout("Restablecer contraseña", `<p>Hola ${user.name},</p><p>Pulsa el botón para elegir una nueva contraseña. El enlace caduca en 1 hora.</p><p><a href="${link}" style="display:inline-block;background:#5f2cf5;color:#fff;padding:12px 20px;border-radius:10px;text-decoration:none;font-weight:600">Elegir nueva contraseña</a></p><p style="color:#8a8697;font-size:13px">Si no lo has solicitado, ignora este mensaje.</p>`),
    });
  }
  return { ok: true, message: "Si el email existe, recibirás un enlace en unos minutos." };
}

export async function resetPassword(fd: FormData) {
  const token = String(fd.get("token") ?? "");
  const password = String(fd.get("password") ?? "");
  if (password.length < 8) return { error: "La contraseña debe tener al menos 8 caracteres." };
  const rec = await db.passwordResetToken.findUnique({ where: { id: hashToken(token) } });
  if (!rec || rec.usedAt || rec.expiresAt < new Date()) return { error: "El enlace no es válido o ha caducado." };
  await db.$transaction([
    db.user.update({ where: { id: rec.userId }, data: { passwordHash: await hashPassword(password) } }),
    db.passwordResetToken.update({ where: { id: rec.id }, data: { usedAt: new Date() } }),
    db.session.deleteMany({ where: { userId: rec.userId } }),
  ]);
  await createSession(rec.userId);
  return { ok: true, message: "Contraseña actualizada", redirect: "/admin" };
}

export async function updateAccount(fd: FormData) {
  const user = await requireUser();
  const name = String(fd.get("name") ?? "").trim();
  const email = String(fd.get("email") ?? "").trim().toLowerCase();
  if (name.length < 2) return { error: "Escribe tu nombre" };
  if (!z.string().email().safeParse(email).success) return { error: "Email no válido" };
  if (email !== user.email && (await db.user.findUnique({ where: { email } }))) return { error: "Ese email ya está en uso" };
  await db.user.update({ where: { id: user.id }, data: { name, email } });
  return { ok: true };
}

export async function changePassword(fd: FormData) {
  const user = await requireUser();
  const current = String(fd.get("current") ?? "");
  const next = String(fd.get("password") ?? "");
  if (!(await verifyPassword(current, user.passwordHash))) return { error: "La contraseña actual no es correcta" };
  if (next.length < 8) return { error: "La nueva contraseña debe tener al menos 8 caracteres" };
  await db.user.update({ where: { id: user.id }, data: { passwordHash: await hashPassword(next) } });
  await db.session.deleteMany({ where: { userId: user.id } });
  await createSession(user.id);
  return { ok: true, message: "Contraseña actualizada" };
}
