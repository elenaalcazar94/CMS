"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  LayoutDashboard, FileText, Newspaper, Tags, ImageIcon, Inbox, ClipboardList, Menu as MenuIcon, Palette, Settings,
  ExternalLink, ChevronsUpDown, Check, Plus, Globe, Users, LogOut, UserCircle, Sparkles, X, Menu,
} from "lucide-react";
import type { SiteRole } from "@prisma/client";
import { can, type Capability } from "@/lib/permissions";
import { cn } from "@/lib/utils";
import { Avatar } from "./ui";
import { logout } from "@/app/actions/auth";

export type SidebarSite = { id: string; name: string; slug: string; role: SiteRole | "SUPERADMIN"; url: string; unread: number };
type Props = { user: { name: string; email: string; role: string }; sites: SidebarSite[] };

const SITE_NAV: { href: string; label: string; icon: React.ElementType; cap?: Capability; exact?: boolean; badge?: boolean }[] = [
  { href: "", label: "Escritorio", icon: LayoutDashboard, exact: true },
  { href: "/pages", label: "Páginas", icon: FileText, cap: "pages.edit" },
  { href: "/posts", label: "Blog", icon: Newspaper, cap: "posts" },
  { href: "/taxonomies", label: "Categorías y etiquetas", icon: Tags, cap: "posts" },
  { href: "/media", label: "Medios", icon: ImageIcon, cap: "media" },
  { href: "/messages", label: "Mensajes", icon: Inbox, cap: "messages", badge: true },
  { href: "/forms", label: "Formularios", icon: ClipboardList, cap: "forms" },
  { href: "/menus", label: "Menús", icon: MenuIcon, cap: "menus" },
  { href: "/appearance", label: "Apariencia", icon: Palette, cap: "appearance" },
  { href: "/settings", label: "Ajustes", icon: Settings, cap: "settings" },
];

function SiteLogo({ name, className }: { name: string; className?: string }) {
  const hue = [...name].reduce((a, c) => a + c.charCodeAt(0), 0) % 360;
  return (
    <span className={cn("grid h-7 w-7 shrink-0 place-items-center rounded-md text-xs font-bold text-white", className)} style={{ background: `hsl(${hue} 55% 50%)` }}>
      {name[0]?.toUpperCase()}
    </span>
  );
}

export function Sidebar({ user, sites }: Props) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [switcher, setSwitcher] = useState(false);
  const [userMenu, setUserMenu] = useState(false);
  const switcherRef = useRef<HTMLDivElement>(null);
  const userRef = useRef<HTMLDivElement>(null);

  const match = pathname.match(/^\/admin\/s\/([^/]+)/);
  const current = match ? sites.find((s) => s.id === match[1]) : undefined;
  const isSuper = user.role === "SUPERADMIN";

  useEffect(() => setMobileOpen(false), [pathname]);
  useEffect(() => {
    const on = (e: MouseEvent) => {
      if (!switcherRef.current?.contains(e.target as Node)) setSwitcher(false);
      if (!userRef.current?.contains(e.target as Node)) setUserMenu(false);
    };
    document.addEventListener("mousedown", on);
    return () => document.removeEventListener("mousedown", on);
  }, []);

  const nav = (
    <div className="flex h-full flex-col">
      <div className="flex h-14 items-center justify-between px-4">
        <Link href="/admin" className="flex items-center gap-2 text-[15px] font-semibold tracking-tight">
          <span className="grid h-7 w-7 place-items-center rounded-lg bg-brand-600 text-white"><Sparkles className="h-3.5 w-3.5" /></span>
          Nido
        </Link>
        <button className="btn-icon btn-ghost lg:hidden" onClick={() => setMobileOpen(false)}><X className="h-4 w-4" /></button>
      </div>

      {/* Selector de sitio */}
      <div className="relative px-3" ref={switcherRef}>
        <button
          onClick={() => setSwitcher(!switcher)}
          className="flex w-full items-center gap-2.5 rounded-lg border border-zinc-200 bg-white px-2.5 py-2 text-left shadow-sm transition hover:border-zinc-300"
        >
          {current ? <SiteLogo name={current.name} /> : <span className="grid h-7 w-7 place-items-center rounded-md bg-zinc-100 text-zinc-500"><Globe className="h-4 w-4" /></span>}
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[13px] font-semibold">{current ? current.name : "Todos los sitios"}</span>
            <span className="block truncate text-[11px] text-zinc-500">{current ? current.slug : `${sites.length} sitio${sites.length === 1 ? "" : "s"}`}</span>
          </span>
          <ChevronsUpDown className="h-4 w-4 text-zinc-400" />
        </button>
        {switcher && (
          <div className="animate-pop absolute left-3 right-3 top-full z-50 mt-1.5 rounded-xl border border-zinc-200 bg-white p-1.5 shadow-pop">
            <Link href="/admin" onClick={() => setSwitcher(false)} className="flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-[13px] hover:bg-zinc-100">
              <Globe className="h-4 w-4 text-zinc-500" /> Todos los sitios
            </Link>
            <div className="my-1 border-t border-zinc-100" />
            <div className="scrollbar-thin max-h-72 overflow-y-auto">
              {sites.map((s) => (
                <Link key={s.id} href={`/admin/s/${s.id}`} onClick={() => setSwitcher(false)} className="flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-[13px] hover:bg-zinc-100">
                  <SiteLogo name={s.name} className="h-6 w-6" />
                  <span className="flex-1 truncate">{s.name}</span>
                  {current?.id === s.id && <Check className="h-4 w-4 text-brand-600" />}
                </Link>
              ))}
            </div>
            {isSuper && (
              <>
                <div className="my-1 border-t border-zinc-100" />
                <Link href="/admin/sites/new" onClick={() => setSwitcher(false)} className="flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-[13px] font-medium text-brand-700 hover:bg-brand-50">
                  <Plus className="h-4 w-4" /> Nuevo sitio
                </Link>
              </>
            )}
          </div>
        )}
      </div>

      <nav className="scrollbar-thin mt-4 flex-1 space-y-0.5 overflow-y-auto px-3">
        {current ? (
          <>
            {SITE_NAV.filter((n) => !n.cap || can(current.role, n.cap)).map((n) => {
              const href = `/admin/s/${current.id}${n.href}`;
              const active = n.exact ? pathname === href : pathname.startsWith(href);
              return (
                <Link key={n.href} href={href} className={cn("nav-link", active && "active")}>
                  <n.icon className="h-[17px] w-[17px]" />
                  <span className="flex-1">{n.label}</span>
                  {n.badge && current.unread > 0 && <span className="rounded-full bg-brand-600 px-1.5 py-px text-[10px] font-bold text-white">{current.unread}</span>}
                </Link>
              );
            })}
            <div className="!mt-4 border-t border-zinc-200/70 pt-3">
              <a href={current.url} target="_blank" rel="noreferrer" className="nav-link">
                <ExternalLink className="h-[17px] w-[17px]" /> Ver la web
              </a>
            </div>
          </>
        ) : (
          <>
            <Link href="/admin" className={cn("nav-link", pathname === "/admin" && "active")}><Globe className="h-[17px] w-[17px]" /> Sitios</Link>
            {isSuper && <Link href="/admin/users" className={cn("nav-link", pathname.startsWith("/admin/users") && "active")}><Users className="h-[17px] w-[17px]" /> Usuarios</Link>}
          </>
        )}
      </nav>

      <div className="relative border-t border-zinc-200/70 p-3" ref={userRef}>
        <button onClick={() => setUserMenu(!userMenu)} className="flex w-full items-center gap-2.5 rounded-lg p-1.5 text-left hover:bg-zinc-100">
          <Avatar name={user.name} size={30} />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[13px] font-semibold">{user.name}</span>
            <span className="block truncate text-[11px] text-zinc-500">{user.email}</span>
          </span>
          <ChevronsUpDown className="h-4 w-4 text-zinc-400" />
        </button>
        {userMenu && (
          <div className="animate-pop absolute bottom-full left-3 right-3 mb-1.5 rounded-xl border border-zinc-200 bg-white p-1.5 shadow-pop">
            <Link href="/admin/account" onClick={() => setUserMenu(false)} className="flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-[13px] hover:bg-zinc-100">
              <UserCircle className="h-4 w-4 text-zinc-500" /> Mi cuenta
            </Link>
            {isSuper && (
              <Link href="/admin/users" onClick={() => setUserMenu(false)} className="flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-[13px] hover:bg-zinc-100">
                <Users className="h-4 w-4 text-zinc-500" /> Usuarios
              </Link>
            )}
            <form action={logout}>
              <button className="flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-[13px] text-red-600 hover:bg-red-50">
                <LogOut className="h-4 w-4" /> Cerrar sesión
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <>
      <div className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-zinc-200 bg-white/90 px-4 backdrop-blur lg:hidden">
        <button className="btn-icon btn-ghost -ml-2" onClick={() => setMobileOpen(true)} aria-label="Menú"><Menu className="h-5 w-5" /></button>
        <span className="truncate text-sm font-semibold">{current?.name ?? "Nido CMS"}</span>
      </div>
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-[248px] border-r border-zinc-200/80 bg-zinc-50/80 backdrop-blur lg:block">{nav}</aside>
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="animate-fade absolute inset-0 bg-zinc-950/40" onClick={() => setMobileOpen(false)} />
          <aside className="animate-pop absolute inset-y-0 left-0 w-[272px] bg-white shadow-pop">{nav}</aside>
        </div>
      )}
    </>
  );
}
