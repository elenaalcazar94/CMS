import "server-only";
import { cache } from "react";
import { headers } from "next/headers";
import { db } from "./db";

function normalizeHost(h: string) {
  return decodeURIComponent(h).toLowerCase().replace(/:\d+$/, "").replace(/^www\./, "");
}

/** Resuelve un sitio a partir de su slug, su dominio propio o su subdominio. */
export const resolveSite = cache(async (param: string) => {
  const key = normalizeHost(param);
  const root = process.env.ROOT_DOMAIN?.toLowerCase();
  if (root && key.endsWith(`.${root}`)) {
    const sub = key.slice(0, -root.length - 1);
    const s = await db.site.findUnique({ where: { slug: sub } });
    if (s) return s;
  }
  return db.site.findFirst({
    where: { OR: [{ slug: key }, { domain: key }, { domain: `www.${key}` }] },
  });
});

/** Prefijo de los enlaces internos: "" en dominio propio, "/s/slug" en vista previa. */
export async function siteBase(param: string, prefix: "s" | "c" = "s") {
  const h = await headers();
  return h.get("x-nido-domain") ? "" : `/${prefix}/${param}`;
}

export function siteHref(base: string, url?: string | null) {
  if (!url) return "#";
  if (url.startsWith("/") && !url.startsWith("//")) return `${base}${url}` || "/";
  return url;
}

/** URL pública absoluta de un sitio. */
export function publicSiteUrl(site: { slug: string; domain: string | null; kind?: string }) {
  if (site.domain) return `https://${site.domain}`;
  const root = process.env.ROOT_DOMAIN;
  if (root) return `https://${site.slug}.${root}`;
  return `${(process.env.APP_URL || "http://localhost:3000").replace(/\/$/, "")}${previewBase(site)}`;
}

/** Ruta de vista previa en el dominio del panel: /s/slug (bloques) o /c/slug (web a medida). */
export function previewBase(site: { slug: string; kind?: string }) {
  return `/${site.kind === "custom" ? "c" : "s"}/${site.slug}`;
}
