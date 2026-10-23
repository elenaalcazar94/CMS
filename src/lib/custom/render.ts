import "server-only";
import * as cheerio from "cheerio";
import type { Element } from "domhandler";
import {
  BG_ATTR, COLLECTION_ATTR, COLLECTION_FIELD_ATTR, FIELD_ATTR, FORM_ATTR, GLOBAL_MARK, REPEAT_ATTR, TYPE_ATTR,
  bgKey, type FieldMap, type ImageValue, type LinkValue,
} from "./shared";

export type CollectionItem = {
  title: string;
  url: string;
  description: string;
  image: string;
  date: string | null;
  fields: FieldMap;
};

export type RenderInput = {
  html: string;
  fields: FieldMap;
  globals: FieldMap;
  base: string;
  mode: "public" | "edit";
  runScripts?: boolean;
  page: { title: string; seoTitle?: string | null; seoDescription?: string | null; ogImage?: string | null; noindex?: boolean; canonical?: string };
  headCode?: string;
  forms: Record<string, string>; // slug → id
  collections: Record<string, CollectionItem[]>;
};

type $T = cheerio.CheerioAPI;

const URL_ATTRS = ["href", "src", "poster", "action", "data-src", "data-bg", "data-background"];

function setBg(style: string | undefined, url: string) {
  const s = style ?? "";
  const value = `url("${url.replace(/"/g, "%22")}")`;
  if (/url\([^)]*\)/i.test(s)) return s.replace(/url\([^)]*\)/i, value);
  return `${s}${s && !s.trim().endsWith(";") ? ";" : ""}background-image:${value}`;
}

function applyField($: $T, el: Element, value: unknown) {
  if (value == null) return;
  const $el = $(el);
  const type = $el.attr(TYPE_ATTR);
  if (type === "image") {
    const v = value as ImageValue;
    if (!v.src) return;
    $el.attr("src", v.src).attr("alt", v.alt ?? "");
    $el.removeAttr("srcset").removeAttr("sizes").removeAttr("data-src").removeAttr("data-srcset");
    if (el.parent && (el.parent as Element).tagName === "picture") $el.siblings("source").remove();
    return;
  }
  if (type === "link") {
    const v = value as LinkValue;
    if (typeof v === "string") return void $el.html(v);
    if (v.text != null) $el.html(v.text);
    if (v.href) $el.attr("href", v.href);
    if (v.target) $el.attr("target", v.target);
    else if (v.target === "") $el.removeAttr("target");
    return;
  }
  if (typeof value === "string") $el.html(value);
}

function scopeFields($: $T, root: cheerio.Cheerio<Element>, attr: string) {
  return root.filter(`[${attr}]`).add(root.find(`[${attr}]`)).toArray();
}

function applyScope($: $T, root: cheerio.Cheerio<Element>, values: Record<string, unknown>) {
  for (const el of scopeFields($, root, FIELD_ATTR)) applyField($, el, values[$(el).attr(FIELD_ATTR)!]);
  for (const el of scopeFields($, root, BG_ATTR)) {
    const v = values[bgKey($(el).attr(BG_ATTR)!)];
    if (typeof v === "string" && v) $(el).attr("style", setBg($(el).attr("style"), v));
  }
}

function applyRepeats($: $T, fields: FieldMap, globals: FieldMap) {
  const seen = new Set<string>();
  $(`[${REPEAT_ATTR}]`).each((_, el) => {
    const key = $(el).attr(REPEAT_ATTR)!;
    if (seen.has(key) || $(el).parents(`[${REPEAT_ATTR}]`).length) return;
    seen.add(key);
    const map = $(el).is(`[${GLOBAL_MARK}]`) ? globals : fields;
    const value = map[key];
    if (!Array.isArray(value) || value.length === 0) return;
    const items = $(`[${REPEAT_ATTR}="${key}"]`).filter((_, x) => $(x).parents(`[${REPEAT_ATTR}]`).length === 0);
    const template = items.first().clone();
    const clones = value.map((item) => {
      const c = template.clone();
      applyScope($, c, item as Record<string, unknown>);
      return c;
    });
    const anchor = items.first();
    clones.forEach((c) => anchor.before(c));
    items.remove();
  });
}

function applyStatic($: $T, fields: FieldMap, globals: FieldMap) {
  $(`[${FIELD_ATTR}]`).each((_, el) => {
    if ($(el).closest(`[${REPEAT_ATTR}]`).length) return;
    const map = $(el).is(`[${GLOBAL_MARK}]`) ? globals : fields;
    applyField($, el, map[$(el).attr(FIELD_ATTR)!]);
  });
  $(`[${BG_ATTR}]`).each((_, el) => {
    if ($(el).closest(`[${REPEAT_ATTR}]`).length) return;
    const map = $(el).is(`[${GLOBAL_MARK}]`) ? globals : fields;
    const v = map[bgKey($(el).attr(BG_ATTR)!)];
    if (typeof v === "string" && v) $(el).attr("style", setBg($(el).attr("style"), v));
  });
}

function fieldText(v: unknown): string | null {
  if (typeof v === "string") return v;
  if (v && typeof v === "object" && "text" in v) return String((v as LinkValue).text);
  return null;
}

function applyCollections($: $T, collections: Record<string, CollectionItem[]>, mode: RenderInput["mode"]) {
  $(`[${COLLECTION_ATTR}]`).each((_, container) => {
    const name = $(container).attr(COLLECTION_ATTR)!;
    const items = collections[name] ?? [];
    const template = $(container).children().first().clone();
    if (!template.length) return;
    if (!items.length) {
      if (mode === "public") $(container).empty();
      return;
    }
    $(container).empty();
    for (const item of items) {
      const card = template.clone();
      for (const el of scopeFields($, card, COLLECTION_FIELD_ATTR)) {
        const $el = $(el);
        const f = $el.attr(COLLECTION_FIELD_ATTR)!;
        if (f === "url") $el.attr("href", item.url);
        else if (f === "image" || f === "imagen") {
          if (!item.image) continue;
          if (el.tagName === "img") $el.attr("src", item.image).attr("alt", item.title).removeAttr("srcset");
          else $el.attr("style", setBg($el.attr("style"), item.image));
        } else if (f === "title" || f === "titulo") $el.text(item.title);
        else if (f === "description" || f === "descripcion") $el.text(item.description);
        else if (f === "date" || f === "fecha") $el.text(item.date ? new Intl.DateTimeFormat("es-ES", { dateStyle: "long" }).format(new Date(item.date)) : "");
        else {
          const v = item.fields[f];
          if (el.tagName === "img" && v && typeof v === "object" && "src" in v) $el.attr("src", (v as ImageValue).src);
          else {
            const t = fieldText(v);
            if (t != null) $el.html(t);
          }
        }
      }
      if (card.is("a") && !card.is(`[${COLLECTION_FIELD_ATTR}]`)) card.attr("href", item.url);
      // Las tarjetas se generan solas: no son editables
      card.add(card.find("*")).each((_, x) => {
        for (const a of Object.keys((x as Element).attribs ?? {})) if (a.startsWith("data-cms") && a !== COLLECTION_FIELD_ATTR) $(x).removeAttr(a);
      });
      $(container).append(card);
    }
  });
}

function withBase(url: string, base: string) {
  if (!base || !url.startsWith("/") || url.startsWith("//") || url.startsWith(`${base}/`)) return url;
  // La biblioteca de medios y la API se sirven siempre desde la raíz
  if (/^\/(uploads|api)\//.test(url)) return url;
  return `${base}${url}`;
}

export function rebaseCss(css: string, base: string) {
  if (!base) return css;
  return css.replace(/url\(\s*(['"]?)(\/[^/'")][^'")]*)\1\s*\)/g, (_, q, u) => `url(${q}${withBase(u, base)}${q})`);
}

function applyBase($: $T, base: string) {
  if (!base) return;
  for (const attr of URL_ATTRS) {
    $(`[${attr}]`).each((_, el) => {
      $(el).attr(attr, withBase($(el).attr(attr)!, base));
    });
  }
  for (const attr of ["srcset", "data-srcset"]) {
    $(`[${attr}]`).each((_, el) => {
      $(el).attr(attr, $(el).attr(attr)!.split(",").map((p) => {
        const [u, ...d] = p.trim().split(/\s+/);
        return [withBase(u, base), ...d].join(" ");
      }).join(", "));
    });
  }
  $("[style]").each((_, el) => {
    $(el).attr("style", rebaseCss($(el).attr("style")!, base));
  });
  $("style").each((_, el) => {
    $(el).text(rebaseCss($(el).text(), base));
  });
}

function setMeta($: $T, page: RenderInput["page"]) {
  const head = $("head");
  if (!head.length) return;
  const title = page.seoTitle || page.title;
  if (title) {
    if ($("title").length) $("title").first().text(title);
    else head.append(`<title></title>`).find("title").text(title);
  }
  const meta = (attr: "name" | "property", key: string, content: string) => {
    const existing = $(`meta[${attr}="${key}"]`);
    if (existing.length) existing.attr("content", content);
    else head.append($("<meta>").attr(attr, key).attr("content", content));
  };
  if (page.seoDescription) {
    meta("name", "description", page.seoDescription);
    meta("property", "og:description", page.seoDescription);
  }
  if (title) meta("property", "og:title", title);
  if (page.ogImage) meta("property", "og:image", page.ogImage);
  if (page.noindex) meta("name", "robots", "noindex");
  if (page.canonical && !$('link[rel="canonical"]').length) head.append($('<link rel="canonical">').attr("href", page.canonical));
}

/*
 * Conecta los formularios de la web al CMS. Se ejecuta antes que el JavaScript propio de la web
 * (fase de captura) y sin bloquearlo: si la web valida y redirige a su página de gracias,
 * el envío sigue en segundo plano (keepalive).
 */
const FORM_SCRIPT = `<script>(function(){document.querySelectorAll('form[data-nido-form]').forEach(function(f){f.addEventListener('submit',function(e){if(f.__nido)return;if(!f.checkValidity())return;var hp=(f.getAttribute('data-nido-hp')||'').split(' ').filter(Boolean);for(var i=0;i<hp.length;i++){var t=f.elements[hp[i]];if(t&&t.value){e.preventDefault();return}}var d={};new FormData(f).forEach(function(v,k){if(hp.indexOf(k)<0)d[k]=v});f.querySelectorAll('input[type=checkbox]').forEach(function(c){if(c.name&&!(c.name in d))d[c.name]=''});e.preventDefault();f.__nido=true;var b=f.querySelector('[type=submit],button:not([type])');if(b)b.disabled=true;var to=f.hasAttribute('data-nido-redirect')?f.getAttribute('action'):null;fetch('/api/public/forms/'+f.getAttribute('data-nido-form'),{method:'POST',keepalive:true,headers:{'Content-Type':'application/json'},body:JSON.stringify(d)}).then(function(r){return r.json().then(function(j){return{ok:r.ok,j:j}})}).then(function(x){if(x.ok){if(to){location.href=to}else{var p=document.createElement('p');p.className='nido-form-ok';p.setAttribute('role','status');p.textContent=x.j.message||'¡Gracias!';f.replaceWith(p)}}else{f.__nido=false;if(b)b.disabled=false;alert(x.j.error||'Revisa el formulario')}}).catch(function(){f.__nido=false;if(b)b.disabled=false;alert('No se ha podido enviar. Inténtalo de nuevo.')})},true)})})();</script>`;

const EDIT_CSS = `<style id="nido-edit">
[data-cms],[data-cms-bg]{transition:outline-color .12s}
[data-cms]{cursor:text;outline:1px dashed transparent;outline-offset:3px}
[data-cms]:hover{outline-color:rgba(112,71,255,.7)}
[data-cms-type=image]{cursor:pointer}
[data-cms-bg]:hover{outline:2px dashed rgba(245,158,11,.6);outline-offset:-2px}
[data-nido-selected]{outline:2px solid #7047ff!important;outline-offset:3px}
[data-nido-item]{outline:2px dashed #f59e0b!important;outline-offset:6px}
[contenteditable=true]{outline:2px solid #7047ff!important;outline-offset:3px;cursor:text}
[data-cms-collection]{outline:2px dotted rgba(14,165,233,.6);outline-offset:6px}
[data-aos],.reveal,.fade-in,.fade-up,.animate,.wow{opacity:1!important;transform:none!important;visibility:visible!important}
</style>`;

export function renderCustomPage(input: RenderInput) {
  const $ = cheerio.load(input.html);
  applyRepeats($, input.fields, input.globals);
  applyStatic($, input.fields, input.globals);
  applyCollections($, input.collections, input.mode);
  setMeta($, input.page);

  $(`form[${FORM_ATTR}]`).each((_, el) => {
    const id = input.forms[$(el).attr(FORM_ATTR)!];
    if (!id) return;
    $(el).attr("data-nido-form", id);
    if ($(el).attr("data-cms-redirect")) $(el).attr("data-nido-redirect", "");
    if ($(el).attr("data-cms-hp")) $(el).attr("data-nido-hp", $(el).attr("data-cms-hp")!);
  });

  applyBase($, input.base);

  if (input.mode === "edit") {
    if (!input.runScripts) $("script").remove();
    $("head").append(EDIT_CSS);
  } else {
    $("*").each((_, el) => {
      for (const a of Object.keys((el as Element).attribs ?? {})) if (a.startsWith("data-cms")) $(el).removeAttr(a);
    });
    if ($("form[data-nido-form]").length) $("body").append(FORM_SCRIPT);
    if (input.headCode) $("body").append(input.headCode);
  }
  return $.html();
}
