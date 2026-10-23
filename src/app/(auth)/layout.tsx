import { Sparkles } from "lucide-react";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-screen lg:grid-cols-[1fr_1.05fr]">
      <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" precedence="default" />
      <div className="flex flex-col px-6 py-8 sm:px-12">
        <div className="flex items-center gap-2 text-[15px] font-semibold">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-brand-600 text-white"><Sparkles className="h-4 w-4" /></span>
          Nido CMS
        </div>
        <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center py-12">{children}</div>
        <p className="text-xs text-zinc-400">© {new Date().getFullYear()} Nido CMS</p>
      </div>
      <div className="relative hidden overflow-hidden bg-zinc-950 lg:block">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,#7047ff_0%,transparent_55%),radial-gradient(ellipse_at_bottom_left,#f59e0b33_0%,transparent_50%)]" />
        <div className="absolute inset-0 opacity-[.07] [background-image:linear-gradient(#fff_1px,transparent_1px),linear-gradient(90deg,#fff_1px,transparent_1px)] [background-size:44px_44px]" />
        <div className="relative flex h-full flex-col justify-end p-14 text-white">
          <div className="mb-10 max-w-md space-y-3">
            {["Todas las webs de tus clientes en un solo panel", "Editor visual por bloques, sin tocar código", "Blog, formularios, SEO y API headless"].map((t) => (
              <div key={t} className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm backdrop-blur">
                <span className="h-2 w-2 rounded-full bg-brand-400" /> {t}
              </div>
            ))}
          </div>
          <h2 className="max-w-md text-3xl font-semibold leading-tight tracking-tight">Gestiona webs bonitas sin complicaciones.</h2>
          <p className="mt-3 max-w-md text-zinc-400">Tú diseñas, tus clientes actualizan su contenido. Todo desde un mismo sitio.</p>
        </div>
      </div>
    </div>
  );
}
