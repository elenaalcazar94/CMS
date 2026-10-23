import { createBlock, type Block } from "./blocks";
import { uid } from "./utils";

export type PageTemplate = { id: string; name: string; description: string; build: (opts: { formId?: string }) => Block[] };

function b(type: string, data: Record<string, unknown> = {}): Block {
  const block = createBlock(type, uid());
  block.data = { ...block.data, ...data };
  return block;
}

export const PAGE_TEMPLATES: PageTemplate[] = [
  { id: "blank", name: "En blanco", description: "Empieza desde cero.", build: () => [] },
  {
    id: "home",
    name: "Inicio",
    description: "Portada, servicios, cifras, testimonios y llamada a la acción.",
    build: () => [
      b("hero"),
      b("logos", { images: [] }),
      b("features"),
      b("imageText", { imagePosition: "right" }),
      b("stats", { _bg: "surface" }),
      b("testimonials", { _bg: "none" }),
      b("latestPosts"),
      b("cta"),
    ],
  },
  {
    id: "about",
    name: "Sobre nosotros",
    description: "Historia, valores y equipo.",
    build: () => [
      b("hero", { layout: "center", eyebrow: "Quiénes somos", title: "Personas que aman lo que hacen", subtitle: "Conoce nuestra historia y el equipo que hay detrás.", primaryText: "", image: "" }),
      b("imageText", { title: "Nuestra historia", html: "<p>Cuenta cómo empezó todo, qué os mueve y hacia dónde vais.</p><p>Un texto cercano genera confianza.</p>" }),
      b("features", { title: "Nuestros valores", items: [
        { icon: "heart", title: "Cercanía", text: "Tratamos cada proyecto como si fuera nuestro." },
        { icon: "award", title: "Calidad", text: "Cuidamos cada detalle del principio al fin." },
        { icon: "leaf", title: "Compromiso", text: "Trabajamos de forma responsable y sostenible." },
      ] }),
      b("team"),
      b("cta"),
    ],
  },
  {
    id: "services",
    name: "Servicios",
    description: "Lista de servicios, tarifas y preguntas frecuentes.",
    build: () => [
      b("hero", { layout: "center", eyebrow: "Servicios", title: "Todo lo que podemos hacer por ti", subtitle: "Soluciones a medida para cada necesidad.", primaryText: "Pedir presupuesto", image: "" }),
      b("features", { _bg: "none", columns: "3" }),
      b("pricing", { _bg: "surface" }),
      b("faq"),
      b("cta"),
    ],
  },
  {
    id: "contact",
    name: "Contacto",
    description: "Formulario, datos de contacto y mapa.",
    build: ({ formId }) => [
      b("heading", { text: "Contacto", subtitle: "¿Tienes alguna pregunta? Escríbenos y te responderemos lo antes posible.", level: "h1", align: "center", _spacing: "md" }),
      b("form", { formId: formId ?? "", title: "", text: "", _spacing: "sm" }),
      b("map"),
    ],
  },
  {
    id: "landing",
    name: "Landing de producto",
    description: "Página de venta con beneficios, precios y FAQ.",
    build: () => [
      b("hero", { layout: "center", eyebrow: "Nuevo", title: "Presenta tu producto en una frase", subtitle: "Explica el beneficio principal y por qué es diferente.", primaryText: "Empezar ahora", secondaryText: "Ver precios", secondaryUrl: "#precios" }),
      b("features", { title: "Por qué elegirnos", columns: "3" }),
      b("video"),
      b("testimonials"),
      b("pricing", { _anchor: "precios" }),
      b("faq", { _bg: "surface" }),
      b("cta"),
    ],
  },
  {
    id: "legal",
    name: "Texto legal",
    description: "Aviso legal, privacidad o cookies.",
    build: () => [
      b("heading", { text: "Política de privacidad", level: "h1", _spacing: "md" }),
      b("text", { html: "<p>Última actualización: …</p><h2>1. Responsable del tratamiento</h2><p>…</p><h2>2. Finalidad</h2><p>…</p><h2>3. Derechos</h2><p>…</p>", _spacing: "sm" }),
    ],
  },
];

export function getTemplate(id: string) {
  return PAGE_TEMPLATES.find((t) => t.id === id) ?? PAGE_TEMPLATES[0];
}
