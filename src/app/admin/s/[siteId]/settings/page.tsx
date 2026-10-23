import Link from "next/link";
import { db } from "@/lib/db";
import { requireSite } from "@/lib/auth";
import { parseSettings, SOCIAL_LABELS } from "@/lib/settings";
import { publicSiteUrl } from "@/lib/site";
import { ROLE_DESCRIPTIONS, ROLE_LABELS } from "@/lib/permissions";
import { appUrl, cn, formatDate, timeAgo } from "@/lib/utils";
import { Card, PageHeader, Avatar } from "@/components/admin/ui";
import { ActionForm, ConfirmButton, Submit, Switch, CopyButton } from "@/components/admin/client";
import { addMember, deleteApiKey, deleteSite, removeMember, updateSiteGeneral, updateSiteSettings, createApiKey } from "@/app/actions/sites";
import { ApiKeyCreator } from "./api-key";
import { RoleSelect } from "./role-select";

export const metadata = { title: "Ajustes" };

const TABS = [
  { id: "general", label: "General" },
  { id: "contact", label: "Contacto y redes" },
  { id: "seo", label: "SEO" },
  { id: "blog", label: "Blog" },
  { id: "team", label: "Equipo" },
  { id: "api", label: "API headless" },
  { id: "advanced", label: "Avanzado" },
];

export default async function SettingsPage({ params, searchParams }: { params: Promise<{ siteId: string }>; searchParams: Promise<{ tab?: string }> }) {
  const { siteId } = await params;
  const { tab = "general" } = await searchParams;
  const { role, user } = await requireSite(siteId, "settings");
  const site = await db.site.findUniqueOrThrow({ where: { id: siteId } });
  const s = parseSettings(site.settings);
  const saveSettings = updateSiteSettings.bind(null, siteId);
  const isSuper = role === "SUPERADMIN";

  return (
    <>
      <PageHeader title="Ajustes" description={site.name} />
      <div className="mb-6 flex gap-1 overflow-x-auto border-b border-zinc-200">
        {TABS.map((t) => (
          <Link key={t.id} href={`?tab=${t.id}`} className={cn("-mb-px whitespace-nowrap border-b-2 px-3 py-2.5 text-[13px] font-medium transition", tab === t.id ? "border-brand-600 text-brand-700" : "border-transparent text-zinc-500 hover:text-zinc-800")}>
            {t.label}
          </Link>
        ))}
      </div>

      <div className="max-w-3xl space-y-6">
        {tab === "general" && <General siteId={siteId} isSuper={isSuper} />}

        {tab === "contact" && (
          <ActionForm action={saveSettings}>
            <Card title="Datos de contacto" description="Se muestran en el pie de la web.">
              <div className="grid gap-4 p-5 sm:grid-cols-2">
                <div><label className="label">Email</label><input name="contactEmail" type="email" className="input" defaultValue={s.contactEmail} /></div>
                <div><label className="label">Teléfono</label><input name="phone" className="input" defaultValue={s.phone} /></div>
                <div className="sm:col-span-2"><label className="label">Dirección</label><input name="address" className="input" defaultValue={s.address} /></div>
                <div className="sm:col-span-2"><label className="label">Texto del pie</label><textarea name="footerText" className="input" defaultValue={s.footerText} placeholder={site.tagline} /></div>
              </div>
            </Card>
            <Card title="Redes sociales" className="mt-6">
              <div className="grid gap-4 p-5 sm:grid-cols-2">
                {Object.entries(SOCIAL_LABELS).map(([k, label]) => (
                  <div key={k}><label className="label">{label}</label><input name={`social.${k}`} className="input" defaultValue={s.social[k as keyof typeof s.social]} placeholder="https://" /></div>
                ))}
              </div>
              <div className="flex justify-end border-t border-zinc-100 px-5 py-3"><Submit>Guardar</Submit></div>
            </Card>
          </ActionForm>
        )}

        {tab === "seo" && (
          <ActionForm action={saveSettings}>
            <Card title="SEO por defecto" description="Se usa cuando una página no tiene sus propios datos SEO.">
              <div className="space-y-4 p-5">
                <div>
                  <label className="label">Plantilla del título</label>
                  <input name="seoTitleTemplate" className="input font-mono text-[13px]" defaultValue={s.seoTitleTemplate} />
                  <p className="help"><code>%s</code> es el título de la página y <code>{"{site}"}</code> el nombre del sitio. Ej.: «Servicios | {site.name}».</p>
                </div>
                <div><label className="label">Descripción del sitio</label><textarea name="seoDescription" className="input" defaultValue={s.seoDescription} placeholder="Describe el negocio en una o dos frases (máx. 160 caracteres)." /></div>
                <div><label className="label">Imagen para redes sociales (URL)</label><input name="ogImage" className="input" defaultValue={s.ogImage} placeholder="/uploads/…" /><p className="help">Copia la URL de una imagen desde Medios. Tamaño ideal: 1200×630 px.</p></div>
                <div className="rounded-lg bg-zinc-50 p-3 text-xs text-zinc-600">
                  Sitemap: <a className="font-mono text-brand-600" href={`${publicSiteUrl(site)}/sitemap.xml`} target="_blank" rel="noreferrer">{publicSiteUrl(site)}/sitemap.xml</a><br />
                  Robots: <a className="font-mono text-brand-600" href={`${publicSiteUrl(site)}/robots.txt`} target="_blank" rel="noreferrer">{publicSiteUrl(site)}/robots.txt</a>
                </div>
              </div>
              <div className="flex justify-end border-t border-zinc-100 px-5 py-3"><Submit>Guardar</Submit></div>
            </Card>
          </ActionForm>
        )}

        {tab === "blog" && (
          <ActionForm action={saveSettings}>
            <Card title="Blog">
              <div className="space-y-4 p-5">
                <Switch name="blogEnabled" checked={s.blogEnabled} label="Activar blog" description="Si lo desactivas, las entradas dejarán de mostrarse en la web." />
                <div className="grid gap-4 sm:grid-cols-3">
                  <div><label className="label">Título</label><input name="blogTitle" className="input" defaultValue={s.blogTitle} /></div>
                  <div><label className="label">URL</label><input name="blogSlug" className="input" defaultValue={s.blogSlug} /></div>
                  <div><label className="label">Entradas por página</label><input name="postsPerPage" type="number" min={1} max={48} className="input" defaultValue={s.postsPerPage} /></div>
                </div>
              </div>
              <div className="flex justify-end border-t border-zinc-100 px-5 py-3"><Submit>Guardar</Submit></div>
            </Card>
          </ActionForm>
        )}

        {tab === "team" && <Team siteId={siteId} meId={user.id} />}

        {tab === "api" && <Api siteId={siteId} />}

        {tab === "advanced" && (
          <>
            <ActionForm action={saveSettings}>
              <Card title="Aviso de cookies">
                <div className="space-y-4 p-5">
                  <Switch name="cookieNotice" checked={s.cookieNotice} label="Mostrar aviso de cookies" />
                  <div><label className="label">Texto del aviso</label><textarea name="cookieText" className="input" defaultValue={s.cookieText} /></div>
                </div>
              </Card>
              <Card title="Código personalizado" description="Google Analytics, píxel de Meta, chat… Se inserta en todas las páginas." className="mt-6">
                <div className="p-5"><textarea name="headCode" className="input min-h-[160px] font-mono text-xs" spellCheck={false} defaultValue={s.headCode} placeholder="<script>…</script>" /></div>
                <div className="flex justify-end border-t border-zinc-100 px-5 py-3"><Submit>Guardar</Submit></div>
              </Card>
            </ActionForm>
            {isSuper && (
              <Card title="Zona peligrosa" className="border-red-200">
                <ActionForm action={deleteSite.bind(null, siteId)} success={null} className="space-y-3 p-5">
                  <p className="text-sm text-zinc-600">Eliminar el sitio borra para siempre sus páginas, entradas, mensajes y configuración. Los archivos subidos se conservan en el servidor.</p>
                  <div><label className="label">Escribe «{site.name}» para confirmar</label><input name="confirm" className="input" autoComplete="off" /></div>
                  <Submit className="btn-danger">Eliminar sitio</Submit>
                </ActionForm>
              </Card>
            )}
          </>
        )}
      </div>
    </>
  );
}

async function General({ siteId, isSuper }: { siteId: string; isSuper: boolean }) {
  const site = await db.site.findUniqueOrThrow({ where: { id: siteId } });
  const pages = await db.page.findMany({ where: { siteId, status: "PUBLISHED" }, select: { id: true, title: true }, orderBy: { title: "asc" } });
  const root = process.env.ROOT_DOMAIN;
  let serverHost = "tu servidor";
  try { serverHost = new URL(appUrl()).hostname; } catch {}
  return (
    <ActionForm action={updateSiteGeneral.bind(null, siteId)} className="space-y-6">
      <Card title="Información del sitio">
        <div className="grid gap-4 p-5 sm:grid-cols-2">
          <div><label className="label">Nombre</label><input name="name" required className="input" defaultValue={site.name} /></div>
          <div>
            <label className="label">Idioma</label>
            <select name="language" className="input" defaultValue={site.language}>
              <option value="es">Español</option><option value="ca">Català</option><option value="eu">Euskara</option><option value="gl">Galego</option><option value="en">English</option><option value="fr">Français</option><option value="pt">Português</option><option value="de">Deutsch</option><option value="it">Italiano</option>
            </select>
          </div>
          <div className="sm:col-span-2"><label className="label">Eslogan</label><input name="tagline" className="input" defaultValue={site.tagline} /></div>
          <div className="sm:col-span-2">
            <label className="label">Tipo de web</label>
            <select name="kind" className="input" defaultValue={site.kind}>
              <option value="blocks">Editor de bloques (temas de Nido)</option>
              <option value="custom">Web a medida (HTML subido)</option>
            </select>
            <p className="help">Las páginas de cada tipo se conservan si cambias de uno a otro.</p>
          </div>
          <div className="sm:col-span-2">
            <label className="label">Página de portada</label>
            <select name="homePageId" className="input" defaultValue={site.homePageId ?? ""}>
              <option value="">— Automática (página «inicio») —</option>
              {pages.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
            </select>
          </div>
        </div>
      </Card>
      <Card title="Dominio">
        <div className="space-y-4 p-5">
          {isSuper && (
            <div>
              <label className="label">Identificador</label>
              <input name="slug" className="input font-mono text-[13px]" defaultValue={site.slug} />
              <p className="help">{root ? `Subdominio: ${site.slug}.${root}` : `Vista previa: /s/${site.slug}`}</p>
            </div>
          )}
          <div>
            <label className="label">Dominio propio</label>
            <input name="domain" className="input" defaultValue={site.domain ?? ""} placeholder="www.cliente.com" />
          </div>
          <div className="rounded-lg border border-sky-100 bg-sky-50 p-4 text-[13px] text-sky-900">
            <p className="font-semibold">Cómo conectar el dominio</p>
            <ol className="mt-1.5 list-decimal space-y-1 pl-5">
              <li>En el proveedor del dominio, crea un registro <strong>A</strong> (o <strong>CNAME</strong>) que apunte a <code className="rounded bg-white px-1">{serverHost}</code>.</li>
              <li>Escribe el dominio aquí y guarda.</li>
              <li>El certificado HTTPS se genera solo en la primera visita (con el Caddy incluido).</li>
            </ol>
          </div>
        </div>
      </Card>
      <Card title="Modo mantenimiento">
        <div className="p-5"><Switch name="maintenance" checked={site.maintenance} label="Activar modo mantenimiento" description="Los visitantes verán un aviso de «volvemos pronto». Tú y tu equipo seguiréis viendo la web con la sesión iniciada." /></div>
        <div className="flex justify-end border-t border-zinc-100 px-5 py-3"><Submit>Guardar cambios</Submit></div>
      </Card>
    </ActionForm>
  );
}

async function Team({ siteId, meId }: { siteId: string; meId: string }) {
  const members = await db.membership.findMany({ where: { siteId }, include: { user: true }, orderBy: { createdAt: "asc" } });
  return (
    <>
      <Card title="Personas con acceso" description="Superadministradores tienen acceso a todos los sitios y no aparecen aquí.">
        {members.length ? (
          <ul className="divide-y divide-zinc-100">
            {members.map((m) => (
              <li key={m.userId} className="flex flex-wrap items-center gap-3 px-5 py-3">
                <Avatar name={m.user.name} size={36} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{m.user.name} {m.userId === meId && <span className="text-xs text-zinc-400">(tú)</span>}</p>
                  <p className="truncate text-xs text-zinc-500">{m.user.email} · {m.user.lastLoginAt ? `último acceso ${timeAgo(m.user.lastLoginAt)}` : "nunca ha entrado"}</p>
                </div>
                <RoleSelect siteId={siteId} userId={m.userId} role={m.role} disabled={m.userId === meId} />
                {m.userId !== meId && (
                  <ConfirmButton action={removeMember.bind(null, siteId, m.userId)} title="¿Quitar acceso?" description={`${m.user.name} ya no podrá editar este sitio. Su cuenta no se elimina.`} confirmText="Quitar acceso" className="btn-ghost btn-sm text-zinc-400 hover:text-red-600" success="Acceso retirado">Quitar</ConfirmButton>
                )}
              </li>
            ))}
          </ul>
        ) : <p className="p-6 text-center text-sm text-zinc-500">Todavía no has invitado a nadie.</p>}
      </Card>
      <Card title="Invitar a una persona" description="Si no tiene cuenta, se creará y recibirá sus datos de acceso por email.">
        <ActionForm action={addMember.bind(null, siteId)} resetOnSuccess success={null} className="space-y-4 p-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <div><label className="label">Email</label><input name="email" type="email" required className="input" placeholder="cliente@empresa.com" /></div>
            <div><label className="label">Nombre</label><input name="name" className="input" placeholder="Nombre y apellidos" /></div>
            <div><label className="label">Contraseña <span className="font-normal text-zinc-400">(opcional)</span></label><input name="password" type="text" minLength={8} className="input" placeholder="Se genera automáticamente" /></div>
            <div>
              <label className="label">Rol</label>
              <select name="role" className="input" defaultValue="CLIENT">
                {(["CLIENT", "EDITOR", "ADMIN"] as const).map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
              </select>
            </div>
          </div>
          <ul className="space-y-1 rounded-lg bg-zinc-50 p-3 text-xs text-zinc-600">
            {(["CLIENT", "EDITOR", "ADMIN"] as const).map((r) => <li key={r}><strong className="text-zinc-800">{ROLE_LABELS[r]}:</strong> {ROLE_DESCRIPTIONS[r]}</li>)}
          </ul>
          <Submit>Dar acceso</Submit>
        </ActionForm>
      </Card>
    </>
  );
}

async function Api({ siteId }: { siteId: string }) {
  const keys = await db.apiKey.findMany({ where: { siteId }, orderBy: { createdAt: "desc" } });
  const base = `${appUrl()}/api/v1`;
  const endpoints = [
    ["GET", "/site", "Datos del sitio, tema y contacto"],
    ["GET", "/pages", "Listado de páginas publicadas"],
    ["GET", "/pages/{slug}", "Página con sus bloques"],
    ["GET", "/posts?page=1&limit=10&category=&tag=", "Entradas del blog paginadas"],
    ["GET", "/posts/{slug}", "Entrada con su contenido HTML"],
    ["GET", "/categories · /tags", "Taxonomías"],
    ["GET", "/menus", "Menús principal y del pie"],
    ["GET", "/media", "Biblioteca de medios"],
    ["GET", "/forms/{slug}", "Definición de un formulario"],
    ["POST", "/forms/{slug}", "Enviar un formulario (JSON)"],
  ];
  return (
    <>
      <Card title="Claves API" description="Úsalas para consumir el contenido desde una web a medida (Next.js, Astro, apps…).">
        {keys.length > 0 && (
          <ul className="divide-y divide-zinc-100 border-b border-zinc-100">
            {keys.map((k) => (
              <li key={k.id} className="flex items-center gap-3 px-5 py-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{k.name}</p>
                  <p className="font-mono text-xs text-zinc-500">{k.prefix}•••••••• · creada {formatDate(k.createdAt)} · {k.lastUsedAt ? `usada ${timeAgo(k.lastUsedAt)}` : "sin usar"}</p>
                </div>
                <ConfirmButton action={deleteApiKey.bind(null, siteId, k.id)} title="¿Revocar clave?" description="Las aplicaciones que la usen dejarán de funcionar." confirmText="Revocar" success="Clave revocada">Revocar</ConfirmButton>
              </li>
            ))}
          </ul>
        )}
        <div className="p-5"><ApiKeyCreator action={createApiKey.bind(null, siteId)} /></div>
      </Card>
      <Card title="Referencia rápida">
        <div className="space-y-4 p-5 text-sm">
          <div className="flex items-center gap-2">
            <code className="flex-1 truncate rounded-lg bg-zinc-100 px-3 py-2 font-mono text-xs">{base}</code>
            <CopyButton value={base} />
          </div>
          <table className="table-base">
            <tbody>
              {endpoints.map(([m, p, d]) => (
                <tr key={p}>
                  <td className="w-14"><span className={m === "GET" ? "badge-green" : "badge-blue"}>{m}</span></td>
                  <td className="font-mono text-xs">{p}</td>
                  <td className="text-xs text-zinc-500">{d}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <pre className="overflow-x-auto rounded-lg bg-zinc-950 p-4 text-xs leading-relaxed text-zinc-100">{`const res = await fetch("${base}/posts", {
  headers: { Authorization: "Bearer TU_CLAVE" },
});
const { data, meta } = await res.json();`}</pre>
        </div>
      </Card>
    </>
  );
}
