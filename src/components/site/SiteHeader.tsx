"use client";
import { useState } from "react";
import { Menu, X } from "lucide-react";

export type NavItem = { id: string; label: string; url: string; button?: boolean; newTab?: boolean; children?: NavItem[] };

function link(base: string, url: string) {
  if (url.startsWith("/") && !url.startsWith("//")) return `${base}${url}` || "/";
  return url;
}

export function SiteHeader({ name, logo, items, base }: { name: string; logo: string | null; items: NavItem[]; base: string }) {
  const [open, setOpen] = useState(false);
  return (
    <header className="nx-header">
      <div className="nx-container nx-header-inner">
        <a href={base || "/"} className="nx-logo" aria-label={name}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {logo ? <img src={logo} alt={name} /> : name}
        </a>
        <button className="nx-burger" aria-label="Abrir menú" aria-expanded={open} onClick={() => setOpen(!open)}>
          {open ? <X /> : <Menu />}
        </button>
        <nav className={`nx-nav ${open ? "open" : ""}`}>
          {items.map((it) =>
            it.children?.length ? (
              <div key={it.id} className="nx-nav-item">
                <a href={link(base, it.url)} target={it.newTab ? "_blank" : undefined}>{it.label} ▾</a>
                <div className="nx-nav-sub">
                  {it.children.map((c) => (
                    <a key={c.id} href={link(base, c.url)} target={c.newTab ? "_blank" : undefined}>{c.label}</a>
                  ))}
                </div>
              </div>
            ) : (
              <a key={it.id} href={link(base, it.url)} className={it.button ? "nx-btn" : undefined} target={it.newTab ? "_blank" : undefined} onClick={() => setOpen(false)}>
                {it.label}
              </a>
            ),
          )}
        </nav>
      </div>
    </header>
  );
}
