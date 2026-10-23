"use server";
import { z } from "zod";
import type { Prisma, SiteRole } from "@prisma/client";
import { db } from "@/lib/db";
import { assertSite, AuthError, hashPassword, hashToken, randomToken, requireSuperadmin, requireUser } from "@/lib/auth";
import { slugify, uid, appUrl } from "@/lib/utils";
import { getTemplate } from "@/lib/templates";
import { DEFAULT_CONTACT_FIELDS } from "@/lib/forms";
import { DEFAULT_SETTINGS, parseSettings, type SiteSettings } from "@/lib/settings";
import { THEMES, type ThemeSettings } from "@/lib/themes";
import { emailLayout, escapeHtml, mailEnabled, sendMail } from "@/lib/mail";

type Result = { ok?: boolean; error?: string; message?: string; redirect?: string };

async function guard<T extends Result>(fn: () => Promise<T>): Promise<T | Result> {
  try {
    return await fn();
  } catch (e) {
    if (e instanceof AuthError) return { error: e.message };
    if (e && typeof e === "object" && "code" in e && e.code === "P2002") return { error: "Ya existe un elemento con ese identificador." };
    console.error(e);
    return { error: "Ha ocurrido un error inesperado." };
  }
}

function cleanDomain(input: string) {
  const d = input.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "");
  if (!d) return null;
  if (!/^(?!-)[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(d)) throw new AuthError("El dominio no es válido. Ejemplo: www.cliente.com");
  return d;
}

/* ---------------------------------------------------------------- Sitios */

export async function createSite(fd: FormData) {
  await requireSuperadmin();
  return guard(async () => {
    const user = await requireUser();
    const name = String(fd.get("name") ?? "").trim();
    if (name.length < 2) return { error: "Escribe el nombre del sitio" };
    const slug = slugify(String(fd.get("slug") || name)).replace(/\//g, "-");
    if (!slug) return { error: "El identificador no es válido" };
    if (await db.site.findUnique({ where: { slug } })) return { error: "Ya hay un sitio con ese identificador" };
    const theme = THEMES.some((t) => t.id === fd.get("theme")) ? String(fd.get("theme")) : "aurora";
    const domain = cleanDomain(String(fd.get("domain") ?? ""));
    const starter = fd.get("starter") === "on";

    const site = await db.site.create({
      data: {
        name, slug, domain, theme,
        tagline: String(fd.get("tagline") ?? ""),
        settings: { ...DEFAULT_SETTINGS, contactEmail: String(fd.get("contactEmail") ?? "") } as Prisma.InputJsonValue,
      },
    });
    if (starter) await seedStarterContent(site.id, user.id, String(fd.get("contactEmail") ?? ""));
    return { ok: true, message: "¡Sitio creado!", redirect: `/admin/s/${site.id}` };
  });
}

async function seedStarterContent(siteId: string, userId: string, notify: string) {
  const form = await db.form.create({
    data: { siteId, name: "Contacto", slug: "contacto", fields: DEFAULT_CONTACT_FIELDS, notifyEmails: notify },
  });
  const mk = (title: string, slug: string, tpl: string) =>
    db.page.create({
      data: { siteId, title, slug, status: "PUBLISHED", publishedAt: new Date(), authorId: userId, blocks: getTemplate(tpl).build({ formId: form.id }) as unknown as Prisma.InputJsonValue },
    });
  const home = await mk("Inicio", "inicio", "home");
  // Añade el formulario de contacto al final de la portada
  const homeBlocks = getTemplate("home").build({}).concat(getTemplate("contact").build({ formId: form.id }).filter((b) => b.type === "form").map((b) => ({ ...b, data: { ...b.data, title: "Contacto", text: "Escríbenos y te responderemos lo antes posible.", _bg: "surface", _spacing: "md" } })));
  await db.page.update({ where: { id: home.id }, data: { blocks: homeBlocks as unknown as Prisma.InputJsonValue } });
  await mk("Sobre nosotros", "sobre-nosotros", "about");
  await mk("Servicios", "servicios", "services");
  await mk("Contacto", "contacto", "contact");
  const privacy = await mk("Política de privacidad", "privacidad", "legal");
  await db.site.update({ where: { id: siteId }, data: { homePageId: home.id } });

  await db.menu.createMany({
    data: [
      {
        siteId, location: "header",
        items: [
          { id: uid(), label: "Inicio", url: "/" },
          { id: uid(), label: "Sobre nosotros", url: "/sobre-nosotros" },
          { id: uid(), label: "Servicios", url: "/servicios" },
          { id: uid(), label: "Blog", url: "/blog" },
          { id: uid(), label: "Contacto", url: "/contacto", button: true },
        ],
      },
      { siteId, location: "footer", items: [{ id: uid(), label: "Contacto", url: "/contacto" }, { id: uid(), label: "Privacidad", url: `/${privacy.slug}` }] },
    ],
  });

  const cat = await db.category.create({ data: { siteId, name: "Noticias", slug: "noticias" } });
  await db.post.create({
    data: {
      siteId, authorId: userId, title: "¡Bienvenidos a nuestra nueva web!", slug: "bienvenidos",
      excerpt: "Estrenamos web con un diseño renovado y mucho contenido por venir.",
      content: "<p>Estamos muy contentos de presentaros nuestra nueva web. Aquí encontraréis toda la información sobre nuestros servicios, novedades y consejos.</p><h2>¿Qué encontrarás aquí?</h2><ul><li>Noticias y novedades</li><li>Consejos prácticos</li><li>Casos de éxito</li></ul><p>¡Gracias por visitarnos!</p>",
      status: "PUBLISHED", publishedAt: new Date(), categories: { connect: { id: cat.id } },
    },
  });
}

export async function updateSiteGeneral(siteId: string, fd: FormData) {
  return guard(async () => {
    const access = await assertSite(siteId, "settings");
    const name = String(fd.get("name") ?? "").trim();
    if (name.length < 2) return { error: "Escribe el nombre del sitio" };
    const data: Prisma.SiteUpdateInput = {
      name,
      tagline: String(fd.get("tagline") ?? "").trim(),
      language: String(fd.get("language") ?? "es"),
      maintenance: fd.get("maintenance") === "on",
      homePage: fd.get("homePageId") ? { connect: { id: String(fd.get("homePageId")) } } : { disconnect: true },
      domain: cleanDomain(String(fd.get("domain") ?? "")),
    };
    if (access.role === "SUPERADMIN" && fd.get("slug")) {
      const slug = slugify(String(fd.get("slug"))).replace(/\//g, "-");
      if (!slug) return { error: "Identificador no válido" };
      data.slug = slug;
    }
    await db.site.update({ where: { id: siteId }, data });
    return { ok: true };
  });
}

/** Guarda una parte de los ajustes (contacto, SEO, blog, avanzado…). */
export async function updateSiteSettings(siteId: string, fd: FormData) {
  return guard(async () => {
    const access = await assertSite(siteId, "settings");
    const site = await db.site.findUniqueOrThrow({ where: { id: siteId } });
    const current = parseSettings(site.settings);
    const next: SiteSettings = { ...current, social: { ...current.social } };
    for (const [k, v] of fd.entries()) {
      const val = String(v);
      if (k.startsWith("social.")) next.social[k.slice(7) as keyof SiteSettings["social"]] = val.trim();
      else if (k === "postsPerPage") next.postsPerPage = Math.min(48, Math.max(1, Number(val) || 9));
      else if (k === "blogSlug") next.blogSlug = slugify(val).replace(/\//g, "-") || "blog";
      else if (k === "headCode") { if (access.role === "ADMIN" || access.role === "SUPERADMIN") next.headCode = val; }
      else if (k in DEFAULT_SETTINGS && typeof DEFAULT_SETTINGS[k as keyof SiteSettings] === "string") (next as Record<string, unknown>)[k] = val.trim();
    }
    // Interruptores: presentes como "on" o vacíos
    for (const key of ["blogEnabled", "cookieNotice"] as const) if (fd.has(key)) next[key] = fd.get(key) === "on";
    await db.site.update({ where: { id: siteId }, data: { settings: next as unknown as Prisma.InputJsonValue } });
    return { ok: true };
  });
}

export async function updateAppearance(siteId: string, input: { theme: string; themeSettings: Partial<ThemeSettings>; logoUrl: string | null; faviconUrl: string | null }) {
  return guard(async () => {
    await assertSite(siteId, "appearance");
    if (!THEMES.some((t) => t.id === input.theme)) return { error: "Tema no válido" };
    await db.site.update({
      where: { id: siteId },
      data: { theme: input.theme, themeSettings: input.themeSettings as Prisma.InputJsonValue, logoUrl: input.logoUrl || null, faviconUrl: input.faviconUrl || null },
    });
    return { ok: true, message: "Apariencia guardada" };
  });
}

export async function deleteSite(siteId: string, fd: FormData) {
  await requireSuperadmin();
  return guard(async () => {
    const site = await db.site.findUniqueOrThrow({ where: { id: siteId } });
    if (String(fd.get("confirm") ?? "").trim() !== site.name) return { error: "Escribe el nombre exacto del sitio para confirmar" };
    await db.site.delete({ where: { id: siteId } });
    return { ok: true, message: "Sitio eliminado", redirect: "/admin" };
  });
}

/* --------------------------------------------------------------- Equipo */

const memberSchema = z.object({
  email: z.string().trim().toLowerCase().email("Email no válido"),
  name: z.string().trim().optional(),
  role: z.enum(["ADMIN", "EDITOR", "CLIENT"]),
  password: z.string().optional(),
});

export async function addMember(siteId: string, fd: FormData) {
  return guard(async () => {
    await assertSite(siteId, "members");
    const parsed = memberSchema.safeParse(Object.fromEntries(fd));
    if (!parsed.success) return { error: parsed.error.issues[0].message };
    const { email, role } = parsed.data;
    const site = await db.site.findUniqueOrThrow({ where: { id: siteId } });
    let user = await db.user.findUnique({ where: { email } });
    let message = "Usuario añadido al sitio";
    if (!user) {
      const name = parsed.data.name || email.split("@")[0];
      const password = parsed.data.password && parsed.data.password.length >= 8 ? parsed.data.password : randomToken(9);
      user = await db.user.create({ data: { email, name, passwordHash: await hashPassword(password) } });
      const sent = await sendMail({
        to: email,
        subject: `Tu acceso a ${site.name}`,
        html: emailLayout(`Bienvenido a ${site.name}`, `<p>Hola ${escapeHtml(name)},</p><p>Ya tienes acceso para gestionar la web <strong>${escapeHtml(site.name)}</strong>.</p><p><strong>Acceso:</strong> <a href="${appUrl()}/login">${appUrl()}/login</a><br/><strong>Email:</strong> ${escapeHtml(email)}<br/><strong>Contraseña:</strong> ${escapeHtml(password)}</p><p>Te recomendamos cambiar la contraseña desde «Mi cuenta» al entrar.</p>`),
      });
      message = sent ? "Usuario creado. Le hemos enviado sus datos de acceso por email." : `Usuario creado. Contraseña: ${password} (cópiala, no se volverá a mostrar)`;
    }
    await db.membership.upsert({
      where: { userId_siteId: { userId: user.id, siteId } },
      create: { userId: user.id, siteId, role: role as SiteRole },
      update: { role: role as SiteRole },
    });
    return { ok: true, message };
  });
}

export async function updateMemberRole(siteId: string, userId: string, role: SiteRole) {
  return guard(async () => {
    const access = await assertSite(siteId, "members");
    if (userId === access.user.id && access.role !== "SUPERADMIN") return { error: "No puedes cambiar tu propio rol" };
    await db.membership.update({ where: { userId_siteId: { userId, siteId } }, data: { role } });
    return { ok: true, message: "Rol actualizado" };
  });
}

export async function removeMember(siteId: string, userId: string) {
  return guard(async () => {
    const access = await assertSite(siteId, "members");
    if (userId === access.user.id) return { error: "No puedes quitarte a ti mismo" };
    await db.membership.delete({ where: { userId_siteId: { userId, siteId } } });
    return { ok: true, message: "Acceso retirado" };
  });
}

/* ------------------------------------------------------------ Claves API */

export async function createApiKey(siteId: string, fd: FormData) {
  return guard(async () => {
    await assertSite(siteId, "settings");
    const name = String(fd.get("name") ?? "").trim() || "Clave API";
    const key = `nido_${randomToken(24)}`;
    await db.apiKey.create({ data: { siteId, name, keyHash: hashToken(key), prefix: key.slice(0, 10) } });
    return { ok: true, message: key };
  });
}

export async function deleteApiKey(siteId: string, id: string) {
  return guard(async () => {
    await assertSite(siteId, "settings");
    await db.apiKey.deleteMany({ where: { id, siteId } });
    return { ok: true, message: "Clave revocada" };
  });
}

export async function mailStatus() {
  return mailEnabled();
}
