import type { SiteRole } from "@prisma/client";

export type Capability =
  | "pages.edit"
  | "pages.manage"
  | "posts"
  | "media"
  | "menus"
  | "forms"
  | "messages"
  | "appearance"
  | "settings"
  | "members"
  | "html";

const CLIENT: Capability[] = ["pages.edit", "posts", "media", "messages"];
const EDITOR: Capability[] = [...CLIENT, "pages.manage", "menus", "forms"];
const ADMIN: Capability[] = [...EDITOR, "appearance", "settings", "members", "html"];

export const ROLE_CAPS: Record<SiteRole, Capability[]> = { CLIENT, EDITOR, ADMIN };

export const ROLE_LABELS: Record<SiteRole, string> = {
  ADMIN: "Administrador",
  EDITOR: "Editor",
  CLIENT: "Cliente",
};

export const ROLE_DESCRIPTIONS: Record<SiteRole, string> = {
  ADMIN: "Control total del sitio: diseño, ajustes, usuarios y claves API.",
  EDITOR: "Crea y edita páginas, entradas, menús y formularios.",
  CLIENT: "Edita textos e imágenes, escribe en el blog y lee los mensajes.",
};

export function can(role: SiteRole | "SUPERADMIN", cap: Capability) {
  if (role === "SUPERADMIN") return true;
  return ROLE_CAPS[role].includes(cap);
}
