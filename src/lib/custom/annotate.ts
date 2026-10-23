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
function markFields($: cheerio.CheerioAPI, root: Element, nextKey: () => string, global: boolean, skipRoot = false) {
  const visit = (el: Element, isRoot: boolean) => {
    if (SKIP.has(el.tagName)) return;
    if (!isRoot && el.attribs?.[REPEAT_ATTR] !== undefined) return; // las listas se marcan aparte
    const $el = $(el);
    if (hasBackground(el)) {
      $el.attr(BG_ATTR, nextKey());
      if (global) $el.attr(GLOBAL_MARK, "");
    }
    if (el.tagName === "img") {
      if (el.attribs.src || el.attribs["data-src"]) {
        $el.attr(FIELD_ATTR, nextKey()).attr(TYPE_ATTR, "image");
        if (global) $el.attr(GLOBAL_MARK, "");
      }
      return;
    }
    if (!(isRoot && skipRoot) && isTextField($, el)) {
      $el.attr(FIELD_ATTR, nextKey()).attr(TYPE_ATTR, el.tagName === "a" ? "link" : "text");
      if (global) $el.attr(GLOBAL_MARK, "");
      return;
    }
    elementChildren(el).forEach((c) => visit(c, false));
  };
  visit(root, true);
}

function signature(el: Element) {
  const cls = (el.attribs?.class ?? "").split(/\s+/).filter(Boolean).sort().join(".");
  return cls ? `${el.tagName}.${cls}` : "";
}

/** Busca grupos de hermanos con la misma etiqueta y clase (tarjetas, proyectos…). */
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
      if (members.length >= 2 && members.every((m) => hasCandidate($, m))) {
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

  const annotateArea = (area: Element, prefix: string, global: boolean, counterRef: { n: number; r: number }) => {
    for (const group of findRepeatGroups($, area)) {
      const key = `${prefix}r${counterRef.r++}`;
      for (const item of group) {
        $(item).attr(REPEAT_ATTR, key);
        if (global) $(item).attr(GLOBAL_MARK, "");
        let n = 0;
        markFields($, item, () => `f${n++}`, false);
      }
    }
    markFields($, area, () => `${prefix}${counterRef.n++}`, global, area === body);
  };

  regions.forEach((region, i) => {
    const sig = hash(`${region.tagName}|${region.attribs?.class ?? ""}|${$(region).text().replace(/\s+/g, " ").trim()}|${i}`);
    annotateArea(region, `g${sig}-`, true, { n: 0, r: 0 });
  });
  // Resto de la página: las zonas comunes se retiran temporalmente para no marcarlas dos veces
  const placeholders = regions.map((r) => {
    const ph = $("<cms-placeholder></cms-placeholder>");
    $(r).replaceWith(ph);
    return { ph, r };
  });
  annotateArea(body, "p", false, { n: 0, r: 0 });
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
  return (byFor || wrap || el.attribs.placeholder || el.attribs["aria-label"] || el.attribs.name).replace(/\s*\*\s*$/, "").slice(0, 120);
}

function detectForms($: cheerio.CheerioAPI, pageSlug: string): AnnotatedForm[] {
  const forms: AnnotatedForm[] = [];
  $("form").each((i, el) => {
    const $f = $(el);
    const action = ($f.attr("action") ?? "").trim();
    const explicit = $f.attr(FORM_ATTR);
    if (!explicit && action && action !== "#") return; // formulario externo (newsletter, pasarela…)
    const slug = explicit || `${pageSlug || "inicio"}-formulario${i ? `-${i + 1}` : ""}`.replace(/\//g, "-");
    $f.attr(FORM_ATTR, slug);
    const fields: FormField[] = [];
    $f.find("input[name], select[name], textarea[name]").each((_, input) => {
      const t = (input.attribs.type ?? "").toLowerCase();
      if (["submit", "button", "reset", "hidden", "file", "image", "password"].includes(t)) return;
      const name = input.attribs.name;
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
    const name = $f.attr("data-cms-form-name") || $f.attr("aria-label") || $f.closest("section").find("h1,h2,h3").first().text().trim() || "Formulario";
    forms.push({ slug, name: `${name.slice(0, 60)} (${pageSlug || "inicio"})`, fields });
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
