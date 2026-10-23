import "server-only";
import sanitizeHtml from "sanitize-html";

/** Limpia HTML de texto enriquecido (editor), sin scripts ni atributos peligrosos. */
export function cleanRichText(html: string) {
  return sanitizeHtml(html ?? "", {
    allowedTags: [
      "p", "br", "strong", "b", "em", "i", "u", "s", "a", "ul", "ol", "li", "h2", "h3", "h4",
      "blockquote", "code", "pre", "hr", "img", "figure", "figcaption", "span", "mark", "table",
      "thead", "tbody", "tr", "th", "td",
    ],
    allowedAttributes: {
      a: ["href", "target", "rel"],
      img: ["src", "alt", "width", "height", "loading"],
      "*": ["style", "class"],
    },
    allowedStyles: { "*": { "text-align": [/^(left|right|center|justify)$/] } },
    allowedSchemes: ["http", "https", "mailto", "tel"],
    transformTags: {
      a: (tagName, attribs) => ({
        tagName,
        attribs: attribs.target === "_blank" ? { ...attribs, rel: "noopener noreferrer" } : attribs,
      }),
    },
  });
}

const RICH_KEYS = new Set(["html", "answer"]);

/** Recorre los datos de los bloques y limpia los campos de HTML enriquecido. */
export function cleanBlockData<T>(value: T): T {
  if (Array.isArray(value)) return value.map(cleanBlockData) as T;
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) {
      out[k] = RICH_KEYS.has(k) && typeof v === "string" ? cleanRichText(v) : cleanBlockData(v);
    }
    return out as T;
  }
  return value;
}
