"use client";
import { useState } from "react";
import { Check, LayoutTemplate, FileCode2 } from "lucide-react";
import { THEMES } from "@/lib/themes";
import { slugify, cn } from "@/lib/utils";
import { createSite } from "@/app/actions/sites";
import { ActionForm, Submit, Switch } from "@/components/admin/client";

export function NewSiteForm({ rootDomain }: { rootDomain: string }) {
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [theme, setTheme] = useState("aurora");
  const [kind, setKind] = useState<"blocks" | "custom">("blocks");
  const finalSlug = slugTouched ? slug : slugify(name).replace(/\//g, "-");

  return (
    <ActionForm action={createSite} success={null} className="space-y-6">
      <section className="card card-pad">
        <h2 className="font-semibold">¿Cómo vas a hacer esta web?</h2>
        <input type="hidden" name="kind" value={kind} />
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {([
            { id: "blocks", icon: LayoutTemplate, title: "Con el editor de bloques", text: "Diseñas la web dentro del CMS con temas y bloques. Incluye blog y menús." },
            { id: "custom", icon: FileCode2, title: "Subiendo mi web (HTML)", text: "Subes tu web hecha a medida con HTML, CSS y JS. El cliente edita sus textos e imágenes y crea páginas nuevas." },
          ] as const).map((o) => (
            <button type="button" key={o.id} onClick={() => setKind(o.id)} className={cn("relative flex gap-3 rounded-xl border-2 p-4 text-left transition", kind === o.id ? "border-brand-500 bg-brand-50/40" : "border-zinc-200 hover:border-zinc-300")}>
              <span className={cn("grid h-10 w-10 shrink-0 place-items-center rounded-lg", kind === o.id ? "bg-brand-600 text-white" : "bg-zinc-100 text-zinc-600")}><o.icon className="h-5 w-5" /></span>
              <span><span className="block text-sm font-semibold">{o.title}</span><span className="mt-0.5 block text-xs leading-snug text-zinc-500">{o.text}</span></span>
              {kind === o.id && <Check className="absolute right-3 top-3 h-4 w-4 text-brand-600" />}
            </button>
          ))}
        </div>
      </section>
      <section className="card card-pad space-y-5">
        <h2 className="font-semibold">Datos básicos</h2>
        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <label className="label">Nombre del sitio</label>
            <input name="name" className="input" required placeholder="Panadería La Espiga" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
          </div>
          <div>
            <label className="label">Identificador</label>
            <input name="slug" className="input font-mono text-[13px]" value={finalSlug} onChange={(e) => { setSlugTouched(true); setSlug(e.target.value); }} placeholder="la-espiga" />
            <p className="help">{rootDomain ? `Disponible en ${finalSlug || "…"}.${rootDomain}` : `Vista previa en /s/${finalSlug || "…"}`}</p>
          </div>
          <div className="sm:col-span-2">
            <label className="label">Eslogan <span className="font-normal text-zinc-400">(opcional)</span></label>
            <input name="tagline" className="input" placeholder="Pan artesano desde 1985" />
          </div>
          <div>
            <label className="label">Dominio propio <span className="font-normal text-zinc-400">(opcional)</span></label>
            <input name="domain" className="input" placeholder="www.laespiga.com" />
            <p className="help">Apunta el DNS del dominio a tu servidor.</p>
          </div>
          <div>
            <label className="label">Email de contacto</label>
            <input name="contactEmail" type="email" className="input" placeholder="hola@laespiga.com" />
            <p className="help">Recibirá los mensajes de los formularios.</p>
          </div>
        </div>
      </section>

      {kind === "blocks" && <section className="card card-pad">
        <h2 className="font-semibold">Elige un tema</h2>
        <p className="mb-4 mt-1 text-sm text-zinc-500">Define el estilo visual. Podrás personalizar colores y tipografías después.</p>
        <input type="hidden" name="theme" value={theme} />
        <div className="grid gap-3 sm:grid-cols-3">
          {THEMES.map((t) => {
            const d = t.defaults;
            const on = theme === t.id;
            return (
              <button type="button" key={t.id} onClick={() => setTheme(t.id)} className={cn("relative overflow-hidden rounded-xl border-2 text-left transition", on ? "border-brand-500 ring-4 ring-brand-500/15" : "border-zinc-200 hover:border-zinc-300")}>
                <link rel="stylesheet" href={`https://fonts.googleapis.com/css2?family=${d.headingFont.replace(/ /g, "+")}:wght@700&display=swap`} />
                <div className="h-28 p-4" style={{ background: d.background, color: d.text }}>
                  <div className="text-lg font-bold leading-tight" style={{ fontFamily: d.headingFont }}>Hola, mundo</div>
                  <div className="mt-1.5 h-1.5 w-2/3 rounded-full opacity-25" style={{ background: d.text }} />
                  <div className="mt-1 h-1.5 w-1/2 rounded-full opacity-25" style={{ background: d.text }} />
                  <div className="mt-3 inline-block px-3 py-1 text-[10px] font-semibold" style={{ background: d.buttonStyle === "outline" ? "transparent" : d.primary, color: d.buttonStyle === "outline" ? d.primary : "#fff", border: `1.5px solid ${d.primary}`, borderRadius: d.buttonStyle === "pill" ? 99 : d.radius }}>Botón</div>
                </div>
                <div className="border-t border-zinc-100 bg-white p-3">
                  <p className="text-sm font-semibold">{t.name}</p>
                  <p className="mt-0.5 text-xs leading-snug text-zinc-500">{t.description}</p>
                </div>
                {on && <span className="absolute right-2 top-2 grid h-6 w-6 place-items-center rounded-full bg-brand-600 text-white"><Check className="h-3.5 w-3.5" strokeWidth={3} /></span>}
              </button>
            );
          })}
        </div>
      </section>}

      {kind === "blocks" && <section className="card card-pad">
        <Switch name="starter" checked label="Crear contenido de ejemplo" description="Incluye páginas de Inicio, Sobre nosotros, Servicios, Contacto y Privacidad, menús, un formulario y una entrada de blog. Muy recomendable para empezar." />
      </section>}

      <div className="flex justify-end">
        <Submit pendingText="Creando sitio…">{kind === "custom" ? "Crear y subir la web" : "Crear sitio"}</Submit>
      </div>
    </ActionForm>
  );
}
