/* Definición de los bloques del editor visual. Compartido entre panel y web pública. */

export type Option = { value: string; label: string };

export type FieldDef =
  | {
      key: string;
      label: string;
      type: "text" | "textarea" | "url" | "richtext" | "image" | "color" | "number" | "toggle" | "gallery" | "form" | "code" | "icon";
      placeholder?: string;
      help?: string;
      min?: number;
      max?: number;
    }
  | { key: string; label: string; type: "select"; options: Option[]; help?: string }
  | {
      key: string;
      label: string;
      type: "list";
      fields: FieldDef[];
      itemLabel: string;
      titleKey?: string;
      newItem: Record<string, unknown>;
      help?: string;
    };

export type BlockCategory = "basic" | "media" | "sections" | "dynamic";

export type BlockDef = {
  type: string;
  name: string;
  description: string;
  icon: string;
  category: BlockCategory;
  fields: FieldDef[];
  defaults: Record<string, unknown>;
  /** Permiso especial necesario para usar el bloque */
  cap?: "html";
  /** Si admite fondo y espaciado */
  section?: boolean;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Block = { id: string; type: string; data: Record<string, any> };

export const CATEGORY_LABELS: Record<BlockCategory, string> = {
  basic: "Básicos",
  media: "Multimedia",
  sections: "Secciones",
  dynamic: "Dinámicos",
};

export const ICON_OPTIONS = [
  "sparkles", "star", "zap", "shield", "heart", "clock", "phone", "mail", "map-pin", "check",
  "award", "users", "leaf", "truck", "coffee", "camera", "code", "briefcase", "smile", "globe",
  "rocket", "target", "gift", "home", "settings", "trending-up", "lock", "wrench", "palette", "calendar",
];

const align: FieldDef = {
  key: "align",
  label: "Alineación",
  type: "select",
  options: [
    { value: "left", label: "Izquierda" },
    { value: "center", label: "Centro" },
  ],
};

export const SECTION_FIELDS: FieldDef[] = [
  {
    key: "_bg",
    label: "Fondo de la sección",
    type: "select",
    options: [
      { value: "none", label: "Sin fondo" },
      { value: "surface", label: "Suave" },
      { value: "primary", label: "Color principal" },
      { value: "dark", label: "Oscuro" },
    ],
  },
  {
    key: "_spacing",
    label: "Espaciado vertical",
    type: "select",
    options: [
      { value: "none", label: "Ninguno" },
      { value: "sm", label: "Pequeño" },
      { value: "md", label: "Mediano" },
      { value: "lg", label: "Grande" },
    ],
  },
  { key: "_anchor", label: "Ancla (id)", type: "text", placeholder: "contacto", help: "Para enlazar con #contacto" },
];

export const BLOCKS: BlockDef[] = [
  {
    type: "hero",
    name: "Portada",
    description: "Gran cabecera con título, texto, botones e imagen.",
    icon: "layout-template",
    category: "sections",
    section: true,
    fields: [
      { key: "eyebrow", label: "Antetítulo", type: "text", placeholder: "Nuevo" },
      { key: "title", label: "Título", type: "textarea" },
      { key: "subtitle", label: "Subtítulo", type: "textarea" },
      { key: "primaryText", label: "Botón principal", type: "text" },
      { key: "primaryUrl", label: "Enlace del botón principal", type: "url" },
      { key: "secondaryText", label: "Botón secundario", type: "text" },
      { key: "secondaryUrl", label: "Enlace del botón secundario", type: "url" },
      { key: "image", label: "Imagen", type: "image" },
      {
        key: "layout",
        label: "Diseño",
        type: "select",
        options: [
          { value: "split", label: "Texto + imagen" },
          { value: "center", label: "Centrado" },
          { value: "background", label: "Imagen de fondo" },
        ],
      },
    ],
    defaults: {
      eyebrow: "Bienvenidos",
      title: "Un titular claro que explique lo que haces",
      subtitle: "Una frase breve que convenza a tus visitantes de seguir leyendo.",
      primaryText: "Contactar",
      primaryUrl: "#contacto",
      secondaryText: "",
      secondaryUrl: "",
      image: "",
      layout: "split",
      _bg: "none",
      _spacing: "lg",
    },
  },
  {
    type: "heading",
    name: "Título",
    description: "Encabezado de sección con subtítulo opcional.",
    icon: "heading",
    category: "basic",
    section: true,
    fields: [
      { key: "text", label: "Texto", type: "text" },
      { key: "subtitle", label: "Subtítulo", type: "textarea" },
      {
        key: "level",
        label: "Tamaño",
        type: "select",
        options: [
          { value: "h1", label: "Muy grande (H1)" },
          { value: "h2", label: "Grande (H2)" },
          { value: "h3", label: "Mediano (H3)" },
        ],
      },
      align,
    ],
    defaults: { text: "Título de sección", subtitle: "", level: "h2", align: "left", _bg: "none", _spacing: "sm" },
  },
  {
    type: "text",
    name: "Texto",
    description: "Párrafos con formato: negrita, listas, enlaces…",
    icon: "pilcrow",
    category: "basic",
    section: true,
    fields: [
      { key: "html", label: "Contenido", type: "richtext" },
      {
        key: "width",
        label: "Ancho",
        type: "select",
        options: [
          { value: "narrow", label: "Estrecho (lectura)" },
          { value: "wide", label: "Ancho completo" },
        ],
      },
    ],
    defaults: {
      html: "<p>Escribe aquí tu texto. Puedes usar <strong>negrita</strong>, listas y enlaces.</p>",
      width: "narrow",
      _bg: "none",
      _spacing: "sm",
    },
  },
  {
    type: "buttons",
    name: "Botones",
    description: "Uno o varios botones de llamada a la acción.",
    icon: "mouse-pointer-click",
    category: "basic",
    section: true,
    fields: [
      {
        key: "items",
        label: "Botones",
        type: "list",
        itemLabel: "Botón",
        titleKey: "text",
        newItem: { text: "Botón", url: "#", style: "primary" },
        fields: [
          { key: "text", label: "Texto", type: "text" },
          { key: "url", label: "Enlace", type: "url" },
          {
            key: "style",
            label: "Estilo",
            type: "select",
            options: [
              { value: "primary", label: "Principal" },
              { value: "secondary", label: "Secundario" },
            ],
          },
        ],
      },
      align,
    ],
    defaults: { items: [{ text: "Saber más", url: "#", style: "primary" }], align: "left", _bg: "none", _spacing: "sm" },
  },
  {
    type: "spacer",
    name: "Separador",
    description: "Espacio en blanco o línea divisoria.",
    icon: "separator-horizontal",
    category: "basic",
    fields: [
      {
        key: "size",
        label: "Tamaño",
        type: "select",
        options: [
          { value: "sm", label: "Pequeño" },
          { value: "md", label: "Mediano" },
          { value: "lg", label: "Grande" },
        ],
      },
      { key: "line", label: "Mostrar línea", type: "toggle" },
    ],
    defaults: { size: "md", line: false },
  },
  {
    type: "image",
    name: "Imagen",
    description: "Una imagen con pie de foto.",
    icon: "image",
    category: "media",
    section: true,
    fields: [
      { key: "src", label: "Imagen", type: "image" },
      { key: "alt", label: "Texto alternativo", type: "text", help: "Describe la imagen (accesibilidad y SEO)." },
      { key: "caption", label: "Pie de foto", type: "text" },
      { key: "link", label: "Enlace al pulsar", type: "url" },
      {
        key: "size",
        label: "Tamaño",
        type: "select",
        options: [
          { value: "narrow", label: "Estrecha" },
          { value: "wide", label: "Ancha" },
          { value: "full", label: "Pantalla completa" },
        ],
      },
    ],
    defaults: { src: "", alt: "", caption: "", link: "", size: "wide", _bg: "none", _spacing: "sm" },
  },
  {
    type: "imageText",
    name: "Imagen + texto",
    description: "Imagen a un lado y texto al otro.",
    icon: "columns-2",
    category: "sections",
    section: true,
    fields: [
      { key: "image", label: "Imagen", type: "image" },
      { key: "title", label: "Título", type: "text" },
      { key: "html", label: "Texto", type: "richtext" },
      { key: "buttonText", label: "Texto del botón", type: "text" },
      { key: "buttonUrl", label: "Enlace del botón", type: "url" },
      {
        key: "imagePosition",
        label: "Posición de la imagen",
        type: "select",
        options: [
          { value: "left", label: "Izquierda" },
          { value: "right", label: "Derecha" },
        ],
      },
    ],
    defaults: {
      image: "",
      title: "Sobre nosotros",
      html: "<p>Cuenta tu historia, tus valores y qué te hace diferente.</p>",
      buttonText: "",
      buttonUrl: "",
      imagePosition: "left",
      _bg: "none",
      _spacing: "md",
    },
  },
  {
    type: "gallery",
    name: "Galería",
    description: "Cuadrícula de imágenes con ampliación.",
    icon: "images",
    category: "media",
    section: true,
    fields: [
      { key: "title", label: "Título", type: "text" },
      { key: "images", label: "Imágenes", type: "gallery" },
      {
        key: "columns",
        label: "Columnas",
        type: "select",
        options: [
          { value: "2", label: "2" },
          { value: "3", label: "3" },
          { value: "4", label: "4" },
        ],
      },
    ],
    defaults: { title: "", images: [], columns: "3", _bg: "none", _spacing: "md" },
  },
  {
    type: "video",
    name: "Vídeo",
    description: "Vídeo de YouTube o Vimeo.",
    icon: "play",
    category: "media",
    section: true,
    fields: [
      { key: "url", label: "URL del vídeo", type: "url", placeholder: "https://www.youtube.com/watch?v=…" },
      { key: "caption", label: "Pie", type: "text" },
    ],
    defaults: { url: "", caption: "", _bg: "none", _spacing: "md" },
  },
  {
    type: "logos",
    name: "Logotipos",
    description: "Clientes, partners o certificaciones.",
    icon: "badge-check",
    category: "media",
    section: true,
    fields: [
      { key: "title", label: "Título", type: "text" },
      { key: "images", label: "Logotipos", type: "gallery" },
    ],
    defaults: { title: "Confían en nosotros", images: [], _bg: "none", _spacing: "md" },
  },
  {
    type: "features",
    name: "Características",
    description: "Servicios o ventajas en columnas con iconos.",
    icon: "layout-grid",
    category: "sections",
    section: true,
    fields: [
      { key: "title", label: "Título", type: "text" },
      { key: "subtitle", label: "Subtítulo", type: "textarea" },
      {
        key: "columns",
        label: "Columnas",
        type: "select",
        options: [
          { value: "2", label: "2" },
          { value: "3", label: "3" },
          { value: "4", label: "4" },
        ],
      },
      {
        key: "items",
        label: "Elementos",
        type: "list",
        itemLabel: "Elemento",
        titleKey: "title",
        newItem: { icon: "star", title: "Nuevo elemento", text: "Descripción breve." },
        fields: [
          { key: "icon", label: "Icono", type: "icon" },
          { key: "title", label: "Título", type: "text" },
          { key: "text", label: "Texto", type: "textarea" },
          { key: "url", label: "Enlace (opcional)", type: "url" },
        ],
      },
    ],
    defaults: {
      title: "Nuestros servicios",
      subtitle: "",
      columns: "3",
      items: [
        { icon: "sparkles", title: "Servicio uno", text: "Explica en una o dos frases qué ofreces." },
        { icon: "shield", title: "Servicio dos", text: "Destaca un beneficio concreto para tu cliente." },
        { icon: "heart", title: "Servicio tres", text: "Añade un detalle que genere confianza." },
      ],
      _bg: "surface",
      _spacing: "md",
    },
  },
  {
    type: "stats",
    name: "Cifras",
    description: "Números destacados: años, clientes, proyectos…",
    icon: "bar-chart-3",
    category: "sections",
    section: true,
    fields: [
      {
        key: "items",
        label: "Cifras",
        type: "list",
        itemLabel: "Cifra",
        titleKey: "label",
        newItem: { value: "100+", label: "Descripción" },
        fields: [
          { key: "value", label: "Valor", type: "text" },
          { key: "label", label: "Descripción", type: "text" },
        ],
      },
    ],
    defaults: {
      items: [
        { value: "15", label: "años de experiencia" },
        { value: "+500", label: "clientes satisfechos" },
        { value: "24h", label: "tiempo de respuesta" },
      ],
      _bg: "none",
      _spacing: "md",
    },
  },
  {
    type: "testimonials",
    name: "Testimonios",
    description: "Opiniones de clientes.",
    icon: "quote",
    category: "sections",
    section: true,
    fields: [
      { key: "title", label: "Título", type: "text" },
      {
        key: "items",
        label: "Testimonios",
        type: "list",
        itemLabel: "Testimonio",
        titleKey: "author",
        newItem: { quote: "Una experiencia excelente.", author: "Nombre", role: "", avatar: "" },
        fields: [
          { key: "quote", label: "Cita", type: "textarea" },
          { key: "author", label: "Autor", type: "text" },
          { key: "role", label: "Cargo / empresa", type: "text" },
          { key: "avatar", label: "Foto", type: "image" },
        ],
      },
    ],
    defaults: {
      title: "Lo que dicen nuestros clientes",
      items: [
        { quote: "Profesionales, rápidos y muy cercanos. Repetiremos sin duda.", author: "Laura G.", role: "Directora, Estudio Norte", avatar: "" },
        { quote: "Superaron todas nuestras expectativas.", author: "Carlos M.", role: "CEO, Grupo Sur", avatar: "" },
      ],
      _bg: "surface",
      _spacing: "md",
    },
  },
  {
    type: "team",
    name: "Equipo",
    description: "Fotos y cargos de las personas del equipo.",
    icon: "users",
    category: "sections",
    section: true,
    fields: [
      { key: "title", label: "Título", type: "text" },
      {
        key: "items",
        label: "Personas",
        type: "list",
        itemLabel: "Persona",
        titleKey: "name",
        newItem: { photo: "", name: "Nombre", role: "Cargo" },
        fields: [
          { key: "photo", label: "Foto", type: "image" },
          { key: "name", label: "Nombre", type: "text" },
          { key: "role", label: "Cargo", type: "text" },
        ],
      },
    ],
    defaults: {
      title: "Nuestro equipo",
      items: [
        { photo: "", name: "Ana López", role: "Fundadora" },
        { photo: "", name: "Javier Ruiz", role: "Director técnico" },
        { photo: "", name: "Marta Sanz", role: "Atención al cliente" },
      ],
      _bg: "none",
      _spacing: "md",
    },
  },
  {
    type: "pricing",
    name: "Precios",
    description: "Tabla de planes o tarifas.",
    icon: "badge-euro",
    category: "sections",
    section: true,
    fields: [
      { key: "title", label: "Título", type: "text" },
      { key: "subtitle", label: "Subtítulo", type: "textarea" },
      {
        key: "items",
        label: "Planes",
        type: "list",
        itemLabel: "Plan",
        titleKey: "name",
        newItem: { name: "Plan", price: "29 €", period: "/mes", features: "Ventaja 1\nVentaja 2", buttonText: "Elegir", buttonUrl: "#", highlighted: false },
        fields: [
          { key: "name", label: "Nombre", type: "text" },
          { key: "price", label: "Precio", type: "text" },
          { key: "period", label: "Periodo", type: "text", placeholder: "/mes" },
          { key: "features", label: "Ventajas (una por línea)", type: "textarea" },
          { key: "buttonText", label: "Texto del botón", type: "text" },
          { key: "buttonUrl", label: "Enlace del botón", type: "url" },
          { key: "highlighted", label: "Destacado", type: "toggle" },
        ],
      },
    ],
    defaults: {
      title: "Tarifas",
      subtitle: "",
      items: [
        { name: "Básico", price: "29 €", period: "/mes", features: "Ventaja 1\nVentaja 2", buttonText: "Empezar", buttonUrl: "#", highlighted: false },
        { name: "Profesional", price: "59 €", period: "/mes", features: "Todo lo del Básico\nVentaja 3\nVentaja 4", buttonText: "Empezar", buttonUrl: "#", highlighted: true },
        { name: "Empresa", price: "A medida", period: "", features: "Todo lo anterior\nSoporte prioritario", buttonText: "Contactar", buttonUrl: "#contacto", highlighted: false },
      ],
      _bg: "none",
      _spacing: "md",
    },
  },
  {
    type: "faq",
    name: "Preguntas frecuentes",
    description: "Acordeón de preguntas y respuestas.",
    icon: "circle-help",
    category: "sections",
    section: true,
    fields: [
      { key: "title", label: "Título", type: "text" },
      {
        key: "items",
        label: "Preguntas",
        type: "list",
        itemLabel: "Pregunta",
        titleKey: "question",
        newItem: { question: "¿Nueva pregunta?", answer: "Respuesta." },
        fields: [
          { key: "question", label: "Pregunta", type: "text" },
          { key: "answer", label: "Respuesta", type: "textarea" },
        ],
      },
    ],
    defaults: {
      title: "Preguntas frecuentes",
      items: [
        { question: "¿Cuánto tarda el servicio?", answer: "Depende del proyecto, pero normalmente entre 1 y 3 semanas." },
        { question: "¿Cómo puedo pagar?", answer: "Aceptamos transferencia, tarjeta y Bizum." },
      ],
      _bg: "none",
      _spacing: "md",
    },
  },
  {
    type: "cta",
    name: "Llamada a la acción",
    description: "Banda destacada con título y botón.",
    icon: "megaphone",
    category: "sections",
    section: true,
    fields: [
      { key: "title", label: "Título", type: "text" },
      { key: "text", label: "Texto", type: "textarea" },
      { key: "buttonText", label: "Texto del botón", type: "text" },
      { key: "buttonUrl", label: "Enlace del botón", type: "url" },
    ],
    defaults: {
      title: "¿Hablamos de tu proyecto?",
      text: "Cuéntanos qué necesitas y te respondemos en menos de 24 horas.",
      buttonText: "Pedir presupuesto",
      buttonUrl: "#contacto",
      _bg: "primary",
      _spacing: "md",
    },
  },
  {
    type: "form",
    name: "Formulario",
    description: "Inserta uno de tus formularios de contacto.",
    icon: "send",
    category: "dynamic",
    section: true,
    fields: [
      { key: "formId", label: "Formulario", type: "form" },
      { key: "title", label: "Título", type: "text" },
      { key: "text", label: "Texto", type: "textarea" },
    ],
    defaults: { formId: "", title: "Contacto", text: "Escríbenos y te responderemos lo antes posible.", _bg: "none", _spacing: "md", _anchor: "contacto" },
  },
  {
    type: "latestPosts",
    name: "Últimas entradas",
    description: "Muestra automáticamente las últimas entradas del blog.",
    icon: "newspaper",
    category: "dynamic",
    section: true,
    fields: [
      { key: "title", label: "Título", type: "text" },
      { key: "count", label: "Número de entradas", type: "number", min: 1, max: 12 },
      { key: "showExcerpt", label: "Mostrar resumen", type: "toggle" },
    ],
    defaults: { title: "Últimas noticias", count: 3, showExcerpt: true, _bg: "none", _spacing: "md" },
  },
  {
    type: "map",
    name: "Mapa",
    description: "Mapa de Google con tu dirección.",
    icon: "map",
    category: "dynamic",
    section: true,
    fields: [
      { key: "address", label: "Dirección", type: "text", placeholder: "Calle Mayor 1, Madrid" },
      { key: "height", label: "Altura (px)", type: "number", min: 200, max: 800 },
    ],
    defaults: { address: "Puerta del Sol, Madrid", height: 380, _bg: "none", _spacing: "md" },
  },
  {
    type: "html",
    name: "HTML personalizado",
    description: "Código HTML a medida (solo administradores).",
    icon: "code",
    category: "dynamic",
    cap: "html",
    section: true,
    fields: [{ key: "code", label: "Código HTML", type: "code" }],
    defaults: { code: "<div>Tu código aquí</div>", _bg: "none", _spacing: "sm" },
  },
];

export const BLOCK_MAP = Object.fromEntries(BLOCKS.map((b) => [b.type, b]));

export function getBlockDef(type: string): BlockDef | undefined {
  return BLOCK_MAP[type];
}

export function blockFields(def: BlockDef) {
  return def.section ? [...def.fields, ...SECTION_FIELDS] : def.fields;
}

export function createBlock(type: string, id: string): Block {
  const def = getBlockDef(type);
  return { id, type, data: structuredClone(def?.defaults ?? {}) };
}

export function parseBlocks(value: unknown): Block[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (b): b is Block => !!b && typeof b === "object" && typeof b.id === "string" && typeof b.type === "string" && !!BLOCK_MAP[b.type],
  ).map((b) => ({ ...b, data: b.data ?? {} }));
}

/** Convierte una URL de YouTube/Vimeo en URL de inserción. */
export function videoEmbedUrl(url: string) {
  if (!url) return null;
  const yt = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([\w-]{6,})/);
  if (yt) return `https://www.youtube-nocookie.com/embed/${yt[1]}`;
  const vm = url.match(/vimeo\.com\/(?:video\/)?(\d+)/);
  if (vm) return `https://player.vimeo.com/video/${vm[1]}`;
  return null;
}
