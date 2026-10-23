export type ThemeSettings = {
  primary: string;
  accent: string;
  background: string;
  surface: string;
  text: string;
  muted: string;
  headingFont: string;
  bodyFont: string;
  radius: number;
  headerStyle: "classic" | "centered" | "transparent";
  container: number;
  buttonStyle: "solid" | "outline" | "pill";
};

export type ThemePreset = {
  id: string;
  name: string;
  description: string;
  defaults: ThemeSettings;
};

export const THEMES: ThemePreset[] = [
  {
    id: "aurora",
    name: "Aurora",
    description: "Moderno y luminoso, con bordes suaves. Ideal para empresas y startups.",
    defaults: {
      primary: "#5b3df5",
      accent: "#f59e0b",
      background: "#ffffff",
      surface: "#f6f5fb",
      text: "#15131f",
      muted: "#5f5b70",
      headingFont: "Plus Jakarta Sans",
      bodyFont: "Inter",
      radius: 14,
      headerStyle: "classic",
      container: 1180,
      buttonStyle: "solid",
    },
  },
  {
    id: "clasico",
    name: "Clásico",
    description: "Elegante y editorial, con tipografía serif. Para despachos, hoteles y restaurantes.",
    defaults: {
      primary: "#7a4b2a",
      accent: "#b08d57",
      background: "#fbf8f3",
      surface: "#f1ebe1",
      text: "#2a211b",
      muted: "#6e6259",
      headingFont: "Playfair Display",
      bodyFont: "Lora",
      radius: 4,
      headerStyle: "centered",
      container: 1120,
      buttonStyle: "outline",
    },
  },
  {
    id: "minimal",
    name: "Minimal",
    description: "Blanco y negro, mucho aire y foco en el contenido. Para portfolios y estudios.",
    defaults: {
      primary: "#111111",
      accent: "#ff4d2e",
      background: "#ffffff",
      surface: "#f4f4f4",
      text: "#111111",
      muted: "#666666",
      headingFont: "Space Grotesk",
      bodyFont: "Inter",
      radius: 0,
      headerStyle: "classic",
      container: 1240,
      buttonStyle: "pill",
    },
  },
];

export const FONTS = [
  "Inter",
  "Plus Jakarta Sans",
  "DM Sans",
  "Manrope",
  "Poppins",
  "Montserrat",
  "Work Sans",
  "Space Grotesk",
  "Outfit",
  "Nunito",
  "Raleway",
  "Playfair Display",
  "Lora",
  "Merriweather",
  "Cormorant Garamond",
  "Libre Baskerville",
  "Fraunces",
  "DM Serif Display",
];

export function getTheme(id: string) {
  return THEMES.find((t) => t.id === id) ?? THEMES[0];
}

export function resolveTheme(themeId: string, overrides: unknown): ThemeSettings {
  const base = getTheme(themeId).defaults;
  const o = (overrides && typeof overrides === "object" ? overrides : {}) as Partial<ThemeSettings>;
  return { ...base, ...Object.fromEntries(Object.entries(o).filter(([, v]) => v !== "" && v != null)) };
}

function hexToRgb(hex: string) {
  const h = hex.replace("#", "");
  const n = parseInt(h.length === 3 ? h.split("").map((c) => c + c).join("") : h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** Texto legible (blanco o negro) sobre un color dado. */
export function contrastOn(hex: string) {
  const [r, g, b] = hexToRgb(hex);
  return (r * 299 + g * 587 + b * 114) / 1000 > 150 ? "#111111" : "#ffffff";
}

export function themeCssVars(t: ThemeSettings): Record<string, string> {
  return {
    "--c-primary": t.primary,
    "--c-on-primary": contrastOn(t.primary),
    "--c-accent": t.accent,
    "--c-bg": t.background,
    "--c-surface": t.surface,
    "--c-text": t.text,
    "--c-muted": t.muted,
    "--f-heading": `"${t.headingFont}", ui-serif, Georgia, serif`,
    "--f-body": `"${t.bodyFont}", ui-sans-serif, system-ui, sans-serif`,
    "--radius": `${t.radius}px`,
    "--container": `${t.container}px`,
    "--btn-radius": t.buttonStyle === "pill" ? "999px" : `${t.radius}px`,
  };
}

export function googleFontsHref(t: ThemeSettings) {
  const fams = Array.from(new Set([t.headingFont, t.bodyFont]))
    .map((f) => `family=${encodeURIComponent(f).replace(/%20/g, "+")}:wght@400;500;600;700`)
    .join("&");
  return `https://fonts.googleapis.com/css2?${fams}&display=swap`;
}
