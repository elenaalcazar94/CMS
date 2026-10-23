import "server-only";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import type { SiteRole, User } from "@prisma/client";
import { db } from "./db";
import { can, type Capability } from "./permissions";

export const SESSION_COOKIE = "nido_session";
const SESSION_DAYS = 30;

export function hashToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export function randomToken(bytes = 32) {
  return crypto.randomBytes(bytes).toString("base64url");
}

export async function hashPassword(password: string) {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password: string, hash: string) {
  return bcrypt.compare(password, hash);
}

export async function createSession(userId: string) {
  const token = randomToken();
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 86400_000);
  const ua = (await headers()).get("user-agent")?.slice(0, 250) ?? null;
  await db.session.create({ data: { id: hashToken(token), userId, expiresAt, userAgent: ua } });
  await db.user.update({ where: { id: userId }, data: { lastLoginAt: new Date() } });
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.APP_URL?.startsWith("https://") ?? false,
    path: "/",
    expires: expiresAt,
  });
}

export async function destroySession() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) await db.session.deleteMany({ where: { id: hashToken(token) } });
  jar.delete(SESSION_COOKIE);
}

export const getCurrentUser = cache(async (): Promise<User | null> => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const session = await db.session.findUnique({ where: { id: hashToken(token) }, include: { user: true } });
  if (!session || session.expiresAt < new Date() || !session.user.active) return null;
  return session.user;
});

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

export async function requireSuperadmin() {
  const user = await requireUser();
  if (user.role !== "SUPERADMIN") redirect("/admin");
  return user;
}

export type SiteAccess = { user: User; role: SiteRole | "SUPERADMIN"; siteId: string };

export const getSiteAccess = cache(async (siteId: string): Promise<SiteAccess | null> => {
  const user = await getCurrentUser();
  if (!user) return null;
  if (user.role === "SUPERADMIN") {
    const exists = await db.site.count({ where: { id: siteId } });
    return exists ? { user, role: "SUPERADMIN", siteId } : null;
  }
  const m = await db.membership.findUnique({ where: { userId_siteId: { userId: user.id, siteId } } });
  return m ? { user, role: m.role, siteId } : null;
});

/** Para páginas: redirige si no hay acceso. */
export async function requireSite(siteId: string, cap?: Capability) {
  const user = await requireUser();
  const access = await getSiteAccess(siteId);
  if (!access) redirect("/admin");
  if (cap && !can(access.role, cap)) redirect(`/admin/s/${siteId}`);
  return { ...access, user };
}

export class AuthError extends Error {}

/** Para server actions y API: lanza error si no hay acceso. */
export async function assertSite(siteId: string, cap?: Capability) {
  const access = await getSiteAccess(siteId);
  if (!access) throw new AuthError("No tienes acceso a este sitio.");
  if (cap && !can(access.role, cap)) throw new AuthError("No tienes permiso para esta acción.");
  return access;
}

/** Limitador de intentos en memoria (por proceso). */
const buckets = new Map<string, { count: number; reset: number }>();
export function rateLimit(key: string, limit: number, windowMs: number) {
  const now = Date.now();
  const b = buckets.get(key);
  if (!b || b.reset < now) {
    buckets.set(key, { count: 1, reset: now + windowMs });
    return true;
  }
  b.count++;
  return b.count <= limit;
}

export async function clientIp() {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0].trim() || h.get("x-real-ip") || "local";
}
