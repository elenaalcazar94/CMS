/* Convenciones de las webs a medida, compartidas por servidor y editor. */

/** Atributo de un campo editable: data-cms="clave" */
export const FIELD_ATTR = "data-cms";
/** Tipo del campo: text | html | link | image */
export const TYPE_ATTR = "data-cms-type";
/** Imagen de fondo editable: data-cms-bg="clave" */
export const BG_ATTR = "data-cms-bg";
/** Elemento repetible de una lista: data-cms-repeat="clave" */
export const REPEAT_ATTR = "data-cms-repeat";
/** Marca interna: el campo es común a todas las páginas */
export const GLOBAL_MARK = "data-cms-g";
/** Zona común indicada por el desarrollador */
export const GLOBAL_ATTR = "data-cms-global";
/** Listado automático de páginas creadas con una plantilla */
export const COLLECTION_ATTR = "data-cms-collection";
export const COLLECTION_FIELD_ATTR = "data-cms-field";
/** Formulario conectado al CMS */
export const FORM_ATTR = "data-cms-form";

export type FieldType = "text" | "html" | "link" | "image";
export type LinkValue = { text: string; href: string; target?: string };
export type ImageValue = { src: string; alt: string };
export type FieldValue = string | LinkValue | ImageValue | Record<string, unknown>[];
export type FieldMap = Record<string, FieldValue>;

/** Las imágenes de fondo se guardan con este prefijo para no chocar con data-cms. */
export const bgKey = (key: string) => `bg:${key}`;

/** Ruta de un HTML → slug de página ("index.html" → "", "proyectos/a.html" → "proyectos/a") */
export function htmlPathToSlug(path: string) {
  return path.replace(/\.html?$/i, "").replace(/(^|\/)index$/i, "").replace(/\/$/, "");
}

export function isHtmlPath(path: string) {
  return /\.html?$/i.test(path);
}
