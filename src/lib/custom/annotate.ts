import "server-only";
import crypto from "node:crypto";
import path from "node:path";
import * as cheerio from "cheerio";
import type { AnyNode, Element } from "domhandler";
import type { FormField, FormFieldType } from "@/lib/forms";
import {
  BG_ATTR, COLLECTION_ATTR, FIELD_ATTR, FORM_ATTR, GLOBAL_ATTR, GLOBAL_MARK, REPEAT_ATTR, TYPE_ATTR, htmlPathToSlug,
} from "./shared";

/*
 * Prepara un HTML subido para que sea editable:
 *  1. Reescribe las rutas relativas (css, js, imágenes, enlaces a otras páginas) como rutas absolutas del sitio.
 *  2. Marca las zonas editables. Si el HTML ya trae atributos data-cms-*, se respetan tal cual (modo manual).
 *     Si no, se detectan automáticamente textos, enlaces, imágenes, fondos y listas repetidas.
 *  3. Detecta los formularios para conectarlos a la bandeja de mensajes.
 */

const SKIP = new Set(["script", "style", "noscript", "template", "svg", "iframe", "select", "textarea", "input", "option", "canvas", "video", "audio", "object", "map", "head", "math"]);
const INLINE = new Set(["a", "abbr", "b", "bdi", "bdo", "br", "cite", "code", "data", "dfn", "em", "i", "kbd", "mark", "q", "s", "samp", "small", "span", "strong", "sub", "sup", "time", "u", "var", "wbr", "font", "del", "ins"]);
const URL_ATTRS = ["href", "src", "poster", "action", "data-src", "data-bg", "data-background", "xlink:href"];
const SRCSET_ATTRS = ["srcset", "data-srcset"];

export type AnnotatedForm = { slug: string; name: string; fields: FormField[] };
export type AnnotateResult = { html: string; title: string; fieldCount: number; forms: AnnotatedForm[]; manual: boolean };

const isEl = (n: AnyNode): n is Element => n.type === "tag" || n.type === "script" || n.type === "style";
const hash = (s: string) => crypto.createHash("sha1").update(s).digest("hex").slice(0, 6);

/** Convierte una referencia relativa en una ruta absoluta del sitio. */
export function resolveRef(ref: string, filePath: string): string {
  const v = ref.trim();
  if (!v || /^(#|[a-z][a-z0-9+.-]*:|\/\/|\{\{)/i.test(v)) return ref;
  const m = v.match(/^([^?#]*)(.*)$/)!;
  const target = m[1];
  if (!target) return ref;
  const abs = target.startsWith("/") ? path.posix.normalize(target) : path.posix.normalize(path.posix.join("/", path.posix.dirname(filePath), target));
  if (/\.html?$/i.test(abs)) {
    const slug = htmlPathToSlug(abs.slice(1));
    return `/${slug}${m[2]}`;
  }
  return `${abs}${m[2]}`;
}

function rewriteCssUrls(css: string, filePath: string) {
  return css.replace(/url\(\s*(['"]?)([^'")]+)\1\s*\)/g, (all, q, u) => (/^(data:|#)/.test(u) ? all : `url(${q}${resolveRef(u, filePath)}${q})`));
}

function rewriteUrls($: cheerio.CheerioAPI, filePath: string) {
  for (const attr of URL_ATTRS) {
    $(`[${attr.replace(":", "\\:")}]`).each((_, el) => {
      const v = $(el).attr(attr);
      if (v != null) $(el).attr(attr, resolveRef(v, filePath));
    });
  }
  for (const attr of SRCSET_ATTRS) {
    $(`[${attr}]`).each((_, el) => {
      const v = $(el).attr(attr)!;
      $(el).attr(attr, v.split(",").map((part) => {
        const [u, ...d] = part.trim().split(/\s+/);
        return [resolveRef(u, filePath), ...d].join(" ");
      }).join(", "));
    });
  }
  $("[style]").each((_, el) => {
    $(el).attr("style", rewriteCssUrls($(el).attr("style")!, filePath));
  });
  $("style").each((_, el) => {
    $(el).text(rewriteCssUrls($(el).text(), filePath));
  });
}

function onlyInlineDescendants(el: Element): boolean {
  return el.children.every((c) => !isEl(c) || (INLINE.has(c.tagName) && onlyInlineDescendants(c)));
}

function hasDirectText(el: Element) {
  return el.children.some((c) => c.type === "text" && c.data.trim().length > 0);
}

function elementChildren(el: Element) {
  return el.children.filter(isEl);
}

function isTextField($: cheerio.CheerioAPI, el: Element) {
  if (!$(el).text().trim()) return false;
  if (!onlyInlineDescendants(el)) return false;
  // <li><a>Inicio</a></li> → mejor que el campo sea el enlace
  if (!hasDirectText(el) && elementChildren(el).length === 1) return false;
  return true;
}

function hasBackground(el: Element) {
  return /background(-image)?\s*:[^;]*url\(/i.test(el.attribs?.style ?? "");
}

function hasCandidate($: cheerio.CheerioAPI, el: Element): boolean {
  if (SKIP.has(el.tagName)) return false;
  if (el.tagName === "img" || hasBackground(el) || isTextField($, el)) return true;
  return elementChildren(el).some((c) => hasCandidate($, c));
}

/** Marca los campos de un subárbol en orden de lectura. */
type KeyFn = (el: Element, kind: "bg" | "img" | "text") => string;

function markFields($: cheerio.CheerioAPI, root: Element, nextKey: KeyFn, global: boolean, skipRoot = false) {
  const visit = (el: Element, isRoot: boolean) => {
    if (SKIP.has(el.tagName)) return;
    if (!isRoot && el.attribs?.[REPEAT_ATTR] !== undefined) return; // las listas se marcan aparte
    const $el = $(el);
    if (hasBackground(el)) {
      $el.attr(BG_ATTR, nextKey(el, "bg"));
      if (global) $el.attr(GLOBAL_MARK, "");
    }
    if (el.tagName === "img") {
      if (el.attribs.src || el.attribs["data-src"]) {
        $el.attr(FIELD_ATTR, nextKey(el, "img")).attr(TYPE_ATTR, "image");
        if (global) $el.attr(GLOBAL_MARK, "");
      }
      return;
    }
    if (!(isRoot && skipRoot) && isTextField($, el)) {
      $el.attr(FIELD_ATTR, nextKey(el, "text")).attr(TYPE_ATTR, el.tagName === "a" ? "link" : "text");
      if (global) $el.attr(GLOBAL_MARK, "");
      return;
    }
    elementChildren(el).forEach((c) => visit(c, false));
  };
  visit(root, true);
}

const STATE_CLASSES = new Set(["on", "off", "active", "is-active", "current", "is-current", "selected", "is-selected", "show", "shown", "open", "is-open", "visible", "is-visible", "revealed", "animated", "aos-animate"]);

function signature(el: Element) {
  if (INLINE.has(el.tagName)) return ""; // trozos de un mismo texto (p. ej. líneas de un titular) no son listas
  // Las clases de estado (activo, visible…) no cambian qué es un elemento
  const cls = (el.attribs?.class ?? "").split(/\s+/).filter((c) => c && !STATE_CLASSES.has(c)).sort().join(".");
  return cls ? `${el.tagName}.${cls}` : "";
}

/** Estructura de campos de un elemento (p. ej. "img,h3,p"), para comparar elementos de una lista. */
function fieldShape($: cheerio.CheerioAPI, root: Element) {
  const out: string[] = [];
  const visit = (el: Element, isRoot: boolean) => {
    if (SKIP.has(el.tagName)) return;
    if (hasBackground(el)) out.push("bg");
    if (el.tagName === "img") return void out.push("img");
    if (!isRoot && isTextField($, el)) return void out.push(el.tagName);
    elementChildren(el).forEach((c) => visit(c, false));
  };
  visit(root, true);
  if (!out.length && isTextField($, root)) out.push(root.tagName);
  return out.join(",");
}

const hasFormControls = ($: cheerio.CheerioAPI, el: Element) =>
  ["input", "select", "textarea", "button", "form"].includes(el.tagName) || $(el).find("input, select, textarea, button, form").length > 0;

/** Busca grupos de hermanos con la misma etiqueta, clase y estructura (tarjetas, proyectos…). */
function findRepeatGroups($: cheerio.CheerioAPI, root: Element) {
  const groups: Element[][] = [];
  const walk = (el: Element) => {
    if (SKIP.has(el.tagName)) return;
    const kids = elementChildren(el);
    const bySig = new Map<string, Element[]>();
    for (const k of kids) {
      const sig = signature(k);
      if (!sig) continue;
      if (!bySig.has(sig)) bySig.set(sig, []);
      bySig.get(sig)!.push(k);
    }
    const inGroup = new Set<Element>();
    for (const members of bySig.values()) {
      const shape = members.length >= 2 ? fieldShape($, members[0]) : "";
      if (
        members.length >= 2 && shape &&
        members.every((m) => hasCandidate($, m) && !hasFormControls($, m) && fieldShape($, m) === shape)
      ) {
        groups.push(members);
        members.forEach((m) => inGroup.add(m));
      }
    }
    kids.forEach((k) => !inGroup.has(k) && walk(k));
  };
  walk(root);
  return groups;
}

function isGlobalRegion(el: Element, $: cheerio.CheerioAPI) {
  const tag = el.tagName;
  const role = el.attribs?.role;
  if (!(tag === "header" || tag === "footer" || tag === "nav" || role === "banner" || role === "contentinfo")) return false;
  return $(el).parents("main, article, section").length === 0;
}

function autoAnnotate($: cheerio.CheerioAPI) {
  const body = $("body")[0] as Element | undefined;
  if (!body) return;

  // Zonas comunes (cabecera, menú, pie): claves derivadas de su contenido para compartirlas entre páginas
  const regions: Element[] = [];
  $("body *").each((_, el) => {
    if (isGlobalRegion(el, $) && !regions.some((r) => $(el).parents().toArray().includes(r))) regions.push(el);
  });

  // Claves derivadas del contenido original: si vuelves a subir la web con cambios,
  // los textos ya editados siguen en su sitio aunque añadas o quites otros elementos.
  const used = new Map<string, number>();
  const unique = (base: string) => {
    const n = (used.get(base) ?? 0) + 1;
    used.set(base, n);
    return n > 1 ? `${base}-${n}` : base;
  };
  const contentKey = (prefix: string): KeyFn => (el, kind) => {
    const basis =
      kind === "img" ? `img|${el.attribs.src ?? el.attribs["data-src"] ?? ""}`
      : kind === "bg" ? `bg|${(el.attribs.style ?? "").match(/url\(([^)]*)\)/i)?.[1] ?? ""}`
      : `${el.tagName}|${$(el).text().replace(/\s+/g, " ").trim().slice(0, 160)}`;
    return unique(`${prefix}${hash(basis)}`);
  };

  const annotateArea = (area: Element, prefix: string, global: boolean) => {
    for (const group of findRepeatGroups($, area)) {
      const first = group[0];
      const key = unique(`${prefix}r${hash(`${signature(first)}|${fieldShape($, first)}|${signature(first.parent as Element)}`)}`);
      for (const item of group) {
        $(item).attr(REPEAT_ATTR, key);
        if (global) $(item).attr(GLOBAL_MARK, "");
        let n = 0;
        markFields($, item, () => `f${n++}`, false);
      }
    }
    markFields($, area, contentKey(prefix), global, area === body);
  };

  regions.forEach((region) => annotateArea(region, "g", true));
  // Resto de la página: las zonas comunes se retiran temporalmente para no marcarlas dos veces
  const placeholders = regions.map((r) => {
    const ph = $("<cms-placeholder></cms-placeholder>");
    $(r).replaceWith(ph);
    return { ph, r };
  });
  annotateArea(body, "p", false);
  placeholders.forEach(({ ph, r }) => ph.replaceWith(r));
}

function manualAnnotate($: cheerio.CheerioAPI) {
  $(`[${FIELD_ATTR}]`).each((_, el) => {
    const $el = $(el);
    if (!$el.attr(TYPE_ATTR)) $el.attr(TYPE_ATTR, el.tagName === "img" ? "image" : el.tagName === "a" ? "link" : "text");
  });
  $(`[${GLOBAL_ATTR}] [${FIELD_ATTR}], [${GLOBAL_ATTR}] [${BG_ATTR}], [${GLOBAL_ATTR}] [${REPEAT_ATTR}], [${GLOBAL_ATTR}][${FIELD_ATTR}], [${GLOBAL_ATTR}][${BG_ATTR}], [${GLOBAL_ATTR}][${REPEAT_ATTR}]`).attr(GLOBAL_MARK, "");
}

function labelFor($: cheerio.CheerioAPI, form: cheerio.Cheerio<Element>, el: Element) {
  const id = el.attribs.id;
  const byFor = id ? form.find(`label[for="${id}"]`).first().text().trim() : "";
  const wrap = $(el).closest("label").text().trim();
  return (byFor || wrap || el.attribs.placeholder || el.attribs["aria-label"] || el.attribs.name).replace(/\s+/g, " ").replace(/\s*\*\s*$/, "").trim().slice(0, 120);
}

/** Campo trampa antispam: oculto a las personas, solo lo rellenan los bots. */
function isHoneypot($: cheerio.CheerioAPI, input: Element) {
  const name = (input.attribs.name ?? "").toLowerCase();
  if (["_hp", "honeypot", "hp", "website", "url_trap", "bot-field"].includes(name)) return true;
  if (input.attribs.tabindex === "-1" && input.attribs.autocomplete === "off") return true;
  return $(input).closest('[aria-hidden="true"], .hp, .honeypot, [hidden]').length > 0;
}

function detectForms($: cheerio.CheerioAPI, pageSlug: string): AnnotatedForm[] {
  const forms: AnnotatedForm[] = [];
  $("form").each((i, el) => {
    const $f = $(el);
    // Las rutas ya están reescritas: "/gracias" es una página de la web; "https://…" es un servicio externo
    const action = ($f.attr("action") ?? "").trim();
    const explicit = $f.attr(FORM_ATTR);
    const local = !action || action === "#" || (action.startsWith("/") && !action.startsWith("//"));
    if (!explicit && !local) return; // formulario externo (newsletter, pasarela de pago…)
    if (!explicit && (($f.attr("method") ?? "get").toLowerCase() === "get") && $f.find("input[type=search], input[name=q], input[name=s]").length) return; // buscadores
    const slug = explicit || `${pageSlug || "inicio"}-formulario${i ? `-${i + 1}` : ""}`.replace(/\//g, "-");
    $f.attr(FORM_ATTR, slug);
    // Si el formulario llevaba a una página propia (p. ej. gracias.html), se mantiene como página de destino
    if (action && action !== "#" && local) $f.attr("data-cms-redirect", action);
    const fields: FormField[] = [];
    const traps: string[] = [];
    $f.find("input[name], select[name], textarea[name]").each((_, input) => {
      const t = (input.attribs.type ?? "").toLowerCase();
      if (["submit", "button", "reset", "hidden", "file", "image", "password"].includes(t)) return;
      const name = input.attribs.name;
      if (isHoneypot($, input)) {
        traps.push(name);
        return;
      }
      if (fields.some((x) => x.id === name)) return;
      const type: FormFieldType =
        input.tagName === "textarea" ? "textarea"
        : input.tagName === "select" ? "select"
        : (["email", "tel", "number", "date", "checkbox"].includes(t) ? t : "text") as FormFieldType;
      fields.push({
        id: name,
        type,
        label: labelFor($, $f, input),
        required: input.attribs.required !== undefined,
        options: input.tagName === "select" ? $(input).find("option").toArray().map((o) => $(o).attr("value") ?? $(o).text()).filter(Boolean).join("\n") : "",
        width: "full",
      });
    });
    if (traps.length) $f.attr("data-cms-hp", traps.join(" "));
    const name = $f.attr("data-cms-form-name") || $f.attr("aria-label") || $f.closest("section").find("h1,h2,h3").first().text().trim() || "Formulario";
    forms.push({ slug, name: `${name.replace(/\s+/g, " ").slice(0, 60)} (${pageSlug || "inicio"})`, fields });
  });
  return forms;
}

export function annotateHtml(source: string, filePath: string): AnnotateResult {
  const $ = cheerio.load(source);
  rewriteUrls($, filePath);
  const manual = $(`[${FIELD_ATTR}], [${BG_ATTR}], [${REPEAT_ATTR}], [${COLLECTION_ATTR}]`).length > 0;
  if (manual) manualAnnotate($);
  else autoAnnotate($);
  const forms = detectForms($, htmlPathToSlug(filePath));
  const fieldCount = $(`[${FIELD_ATTR}], [${BG_ATTR}]`).length;
  const title = $("title").first().text().trim() || $("h1").first().text().trim() || htmlPathToSlug(filePath) || "Inicio";
  return { html: $.html(), title: title.slice(0, 120), fieldCount, forms, manual };
}
