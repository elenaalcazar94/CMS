"use client";
/* eslint-disable @next/next/no-img-element */
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, RotateCcw, Monitor, Smartphone } from "lucide-react";
import { THEMES, FONTS, getTheme, themeCssVars, googleFontsHref, type ThemeSettings } from "@/lib/themes";
import { createBlock } from "@/lib/blocks";
import { cn } from "@/lib/utils";
import { updateAppearance } from "@/app/actions/sites";
import { RenderBlock } from "@/components/site/Blocks";
import { toast } from "./toast";
import { Card } from "./ui";
import { ImageField } from "./MediaLibrary";
import { CanvasFrame } from "./editor/CanvasFrame";

type Init = { theme: string; overrides: Partial<ThemeSettings>; logoUrl: string | null; faviconUrl: string | null };

const COLORS: { key: keyof ThemeSettings; label: string }[] = [
  { key: "primary", label: "Principal" },
  { key: "accent", label: "Acento" },
  { key: "background", label: "Fondo" },
  { key: "surface", label: "Fondo suave" },
  { key: "text", label: "Texto" },
  { key: "muted", label: "Texto secundario" },
];

const PRESETS = ["#5b3df5", "#2563eb", "#0891b2", "#059669", "#65a30d", "#ca8a04", "#ea580c", "#dc2626", "#db2777", "#7c3aed", "#7a4b2a", "#111111"];

const sampleBlocks = [
  { ...createBlock("hero", "p1"), data: { ...createBlock("hero", "p1").data, image: "", layout: "split" } },
  { ...createBlock("features", "p2") },
  { ...createBlock("cta", "p3") },
];

export function ThemeEditor({ siteId, siteName, initial }: { siteId: string; siteName: string; initial: Init }) {
  const [theme, setTheme] = useState(initial.theme);
  const [ov, setOv] = useState<Partial<ThemeSettings>>(initial.overrides);
  const [logo, setLogo] = useState(initial.logoUrl ?? "");
  const [favicon, setFavicon] = useState(initial.faviconUrl ?? "");
  const [device, setDevice] = useState<"desktop" | "mobile">("desktop");
  const [saving, start] = useTransition();
  const router = useRouter();

  const resolved: ThemeSettings = useMemo(() => ({ ...getTheme(theme).defaults, ...Object.fromEntries(Object.entries(ov).filter(([, v]) => v !== "" && v != null)) }), [theme, ov]);
  const set = <K extends keyof ThemeSettings>(k: K, v: ThemeSettings[K]) => setOv((o) => ({ ...o, [k]: v }));

  return (
    <div className="grid gap-6 xl:grid-cols-[400px_1fr]">
      <div className="space-y-5">
        <Card title="Tema">
          <div className="grid grid-cols-3 gap-2 p-4">
            {THEMES.map((t) => (
              <button key={t.id} onClick={() => { setTheme(t.id); setOv({}); }} className={cn("relative overflow-hidden rounded-lg border-2 text-left transition", theme === t.id ? "border-brand-500" : "border-zinc-200 hover:border-zinc-300")}>
                <div className="flex h-14 items-end gap-1 p-2" style={{ background: t.defaults.background }}>
                  {[t.defaults.primary, t.defaults.accent, t.defaults.text].map((c, i) => <span key={i} className="h-4 w-4 rounded-full ring-1 ring-black/5" style={{ background: c }} />)}
                </div>
                <p className="border-t border-zinc-100 bg-white px-2 py-1.5 text-xs font-semibold">{t.name}</p>
                {theme === t.id && <Check className="absolute right-1.5 top-1.5 h-4 w-4 rounded-full bg-brand-600 p-0.5 text-white" strokeWidth={3} />}
              </button>
            ))}
          </div>
        </Card>

        <Card title="Identidad">
          <div className="grid grid-cols-[1fr_120px] gap-4 p-4">
            <div><label className="label">Logotipo</label><ImageField siteId={siteId} value={logo} onChange={setLogo} compact /></div>
            <div><label className="label">Favicon</label><ImageField siteId={siteId} value={favicon} onChange={setFavicon} compact /></div>
          </div>
        </Card>

        <Card title="Colores" actions={Object.keys(ov).length > 0 && <button className="btn-ghost btn-sm" onClick={() => setOv({})}><RotateCcw className="h-3.5 w-3.5" /> Restablecer</button>}>
          <div className="space-y-4 p-4">
            <div>
              <label className="label">Color principal</label>
              <div className="flex flex-wrap gap-1.5">
                {PRESETS.map((c) => (
                  <button key={c} title={c} onClick={() => set("primary", c)} className={cn("h-7 w-7 rounded-full ring-offset-2 transition hover:scale-110", resolved.primary === c && "ring-2 ring-zinc-900")} style={{ background: c }} />
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {COLORS.map((c) => (
                <div key={c.key}>
                  <label className="mb-1 block text-xs font-medium text-zinc-600">{c.label}</label>
                  <div className="flex items-center gap-2 rounded-lg border border-zinc-200 bg-white p-1 pr-2 shadow-sm">
                    <input type="color" value={resolved[c.key] as string} onChange={(e) => set(c.key, e.target.value as never)} className="h-7 w-8 cursor-pointer rounded border-0 bg-transparent p-0" />
                    <input value={resolved[c.key] as string} onChange={(e) => set(c.key, e.target.value as never)} className="w-full bg-transparent font-mono text-xs uppercase outline-none" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Card>

        <Card title="Tipografía y estilo">
          <div className="space-y-4 p-4">
            <div className="grid grid-cols-2 gap-3">
              <div><label className="label">Títulos</label><select className="input" value={resolved.headingFont} onChange={(e) => set("headingFont", e.target.value)}>{FONTS.map((f) => <option key={f}>{f}</option>)}</select></div>
              <div><label className="label">Texto</label><select className="input" value={resolved.bodyFont} onChange={(e) => set("bodyFont", e.target.value)}>{FONTS.map((f) => <option key={f}>{f}</option>)}</select></div>
            </div>
            <div>
              <label className="label">Redondeo de esquinas: {resolved.radius}px</label>
              <input type="range" min={0} max={28} value={resolved.radius} onChange={(e) => set("radius", Number(e.target.value))} className="w-full accent-brand-600" />
            </div>
            <div>
              <label className="label">Botones</label>
              <Seg value={resolved.buttonStyle} onChange={(v) => set("buttonStyle", v as ThemeSettings["buttonStyle"])} options={[["solid", "Relleno"], ["outline", "Contorno"], ["pill", "Píldora"]]} />
            </div>
            <div>
              <label className="label">Cabecera</label>
              <Seg value={resolved.headerStyle} onChange={(v) => set("headerStyle", v as ThemeSettings["headerStyle"])} options={[["classic", "Clásica"], ["centered", "Centrada"], ["transparent", "Transparente"]]} />
            </div>
            <div>
              <label className="label">Ancho del contenido: {resolved.container}px</label>
              <input type="range" min={960} max={1440} step={20} value={resolved.container} onChange={(e) => set("container", Number(e.target.value))} className="w-full accent-brand-600" />
            </div>
          </div>
        </Card>

        <button
          className="btn-primary w-full py-2.5"
          disabled={saving}
          onClick={() => start(async () => {
            const r = await updateAppearance(siteId, { theme, themeSettings: ov, logoUrl: logo, faviconUrl: favicon });
            if (r.error) toast.error(r.error); else { toast(r.message!); router.refresh(); }
          })}
        >
          {saving && <Loader2 className="h-4 w-4 animate-spin" />} Guardar apariencia
        </button>
      </div>

      <div className="xl:sticky xl:top-6 xl:h-[calc(100vh-3rem)]">
        <div className="mb-2 flex items-center justify-between">
          <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">Vista previa</p>
          <div className="flex rounded-lg bg-zinc-200/60 p-0.5">
            <button onClick={() => setDevice("desktop")} className={cn("grid h-7 w-8 place-items-center rounded-md", device === "desktop" ? "bg-white shadow-sm" : "text-zinc-500")}><Monitor className="h-4 w-4" /></button>
            <button onClick={() => setDevice("mobile")} className={cn("grid h-7 w-8 place-items-center rounded-md", device === "mobile" ? "bg-white shadow-sm" : "text-zinc-500")}><Smartphone className="h-4 w-4" /></button>
          </div>
        </div>
        <div className="mx-auto h-[640px] overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-pop transition-all xl:h-[calc(100%-2rem)]" style={{ maxWidth: device === "mobile" ? 390 : "100%" }}>
          <CanvasFrame className="h-full w-full border-0">
            <div className="nx" data-theme={theme} data-header={resolved.headerStyle} data-btn={resolved.buttonStyle} style={themeCssVars(resolved) as React.CSSProperties}>
              <link rel="stylesheet" href={googleFontsHref(resolved)} />
              <header className="nx-header" style={resolved.headerStyle === "transparent" ? { position: "relative" } : undefined}>
                <div className="nx-container nx-header-inner">
                  <span className="nx-logo">{logo ? <img src={logo} alt="" /> : siteName}</span>
                  <nav className="nx-nav" style={{ display: device === "mobile" ? "none" : undefined }}>
                    <a>Inicio</a><a>Servicios</a><a>Blog</a><a className="nx-btn">Contacto</a>
                  </nav>
                </div>
              </header>
              {sampleBlocks.map((b) => <RenderBlock key={b.id} block={b} ctx={{ base: "", blogPath: "/blog", forms: {}, posts: [], editing: true }} />)}
            </div>
          </CanvasFrame>
        </div>
      </div>
    </div>
  );
}

function Seg({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: [string, string][] }) {
  return (
    <div className="flex rounded-lg bg-zinc-100 p-0.5">
      {options.map(([v, l]) => (
        <button key={v} onClick={() => onChange(v)} className={cn("flex-1 rounded-md py-1.5 text-xs font-medium transition", value === v ? "bg-white shadow-sm" : "text-zinc-500 hover:text-zinc-800")}>{l}</button>
      ))}
    </div>
  );
}
