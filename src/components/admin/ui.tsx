import Link from "next/link";
import { cn } from "@/lib/utils";

export function PageHeader({ title, description, actions, back }: { title: React.ReactNode; description?: React.ReactNode; actions?: React.ReactNode; back?: { href: string; label: string } }) {
  return (
    <div className="mb-7 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        {back && (
          <Link href={back.href} className="mb-2 inline-flex items-center gap-1 text-[13px] font-medium text-zinc-500 hover:text-zinc-800">
            ← {back.label}
          </Link>
        )}
        <h1 className="text-[22px] font-semibold tracking-tight text-zinc-900">{title}</h1>
        {description && <p className="mt-1 text-sm text-zinc-500">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Field({ label, help, children, className, htmlFor }: { label?: React.ReactNode; help?: React.ReactNode; children: React.ReactNode; className?: string; htmlFor?: string }) {
  return (
    <div className={className}>
      {label && <label className="label" htmlFor={htmlFor}>{label}</label>}
      {children}
      {help && <p className="help">{help}</p>}
    </div>
  );
}

export function Card({ children, className, title, description, actions }: { children: React.ReactNode; className?: string; title?: React.ReactNode; description?: React.ReactNode; actions?: React.ReactNode }) {
  return (
    <section className={cn("card", className)}>
      {(title || actions) && (
        <div className="flex items-start justify-between gap-4 border-b border-zinc-100 px-5 py-4 sm:px-6">
          <div>
            {title && <h2 className="text-[15px] font-semibold text-zinc-900">{title}</h2>}
            {description && <p className="mt-0.5 text-[13px] text-zinc-500">{description}</p>}
          </div>
          {actions}
        </div>
      )}
      {children}
    </section>
  );
}

export function EmptyState({ icon, title, description, action }: { icon: React.ReactNode; title: string; description?: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
      <div className="mb-4 grid h-12 w-12 place-items-center rounded-2xl bg-brand-50 text-brand-600">{icon}</div>
      <h3 className="text-[15px] font-semibold text-zinc-900">{title}</h3>
      {description && <p className="mt-1 max-w-sm text-sm text-zinc-500">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function StatusBadge({ state }: { state: "draft" | "scheduled" | "published" }) {
  if (state === "published") return <span className="badge-green"><span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />Publicado</span>;
  if (state === "scheduled") return <span className="badge-blue"><span className="h-1.5 w-1.5 rounded-full bg-sky-500" />Programado</span>;
  return <span className="badge-gray"><span className="h-1.5 w-1.5 rounded-full bg-zinc-400" />Borrador</span>;
}

export function Avatar({ name, size = 32, className }: { name: string; size?: number; className?: string }) {
  const initials = name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase()).join("") || "?";
  const hue = [...name].reduce((a, c) => a + c.charCodeAt(0), 0) % 360;
  return (
    <span
      className={cn("inline-grid shrink-0 place-items-center rounded-full font-semibold text-white", className)}
      style={{ width: size, height: size, fontSize: size * 0.38, background: `linear-gradient(135deg, hsl(${hue} 70% 58%), hsl(${(hue + 40) % 360} 70% 48%))` }}
    >
      {initials}
    </span>
  );
}
