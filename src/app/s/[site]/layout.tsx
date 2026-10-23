import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { db } from "@/lib/db";
import { resolveSite, siteBase } from "@/lib/site";
import { googleFontsHref, resolveTheme, themeCssVars } from "@/lib/themes";
import { parseSettings, SOCIAL_LABELS } from "@/lib/settings";
import { getSiteAccess } from "@/lib/auth";
import { SiteHeader, type NavItem } from "@/components/site/SiteHeader";
import { CookieNotice } from "@/components/site/CookieNotice";
import { SocialIcon } from "@/components/Icon";

export const dynamic = "force-dynamic";

type Props = { children: React.ReactNode; params: Promise<{ site: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const site = await resolveSite((await params).site);
  if (!site) return {};
  const s = parseSettings(site.settings);
  return {
    title: site.name,
    description: s.seoDescription || site.tagline || undefined,
    icons: site.faviconUrl ? { icon: site.faviconUrl } : undefined,
    openGraph: { siteName: site.name, images: s.ogImage ? [s.ogImage] : undefined },
  };
}

function asNav(v: unknown): NavItem[] {
  return Array.isArray(v) ? (v as NavItem[]) : [];
}

export default async function SiteLayout({ children, params }: Props) {
  const { site: param } = await params;
  const site = await resolveSite(param);
  if (!site) notFound();

  const base = await siteBase(param);
  const theme = resolveTheme(site.theme, site.themeSettings);
  const settings = parseSettings(site.settings);
  const menus = await db.menu.findMany({ where: { siteId: site.id } });
  const header = asNav(menus.find((m) => m.location === "header")?.items);
  const footer = asNav(menus.find((m) => m.location === "footer")?.items);
  const socials = Object.entries(settings.social).filter(([, v]) => v);
  const link = (u: string) => (u.startsWith("/") && !u.startsWith("//") ? `${base}${u}` || "/" : u);

  const wrapperProps = {
    className: "nx",
    "data-theme": site.theme,
    "data-header": theme.headerStyle,
    "data-btn": theme.buttonStyle,
    style: themeCssVars(theme) as React.CSSProperties,
    lang: site.language,
  };

  if (site.maintenance && !(await getSiteAccess(site.id))) {
    return (
      <div {...wrapperProps}>
        <link rel="stylesheet" href={googleFontsHref(theme)} precedence="default" />
        <main className="nx-notice">
          <div>
            <h1>{site.name}</h1>
            <p className="nx-sub" style={{ margin: "0 auto" }}>Estamos preparando algo nuevo. Vuelve muy pronto.</p>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div {...wrapperProps}>
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
      <link rel="stylesheet" href={googleFontsHref(theme)} precedence="default" />
      <SiteHeader name={site.name} logo={site.logoUrl} items={header} base={base} />
      <main>{children}</main>
      <footer className="nx-footer">
        <div className="nx-container">
          <div className="nx-footer-grid">
            <div>
              <div className="nx-logo" style={{ marginBottom: 12 }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {site.logoUrl ? <img src={site.logoUrl} alt={site.name} /> : site.name}
              </div>
              {(settings.footerText || site.tagline) && <p className="nx-muted" style={{ maxWidth: 360 }}>{settings.footerText || site.tagline}</p>}
              {socials.length > 0 && (
                <div className="nx-social">
                  {socials.map(([k, v]) => (
                    <a key={k} href={v} target="_blank" rel="noopener noreferrer" aria-label={SOCIAL_LABELS[k as keyof typeof SOCIAL_LABELS]}>
                      <SocialIcon name={k} />
                    </a>
                  ))}
                </div>
              )}
            </div>
            <div>
              {footer.length > 0 && (
                <>
                  <h4>Enlaces</h4>
                  <ul>
                    {footer.map((it) => (
                      <li key={it.id}><a href={link(it.url)} target={it.newTab ? "_blank" : undefined}>{it.label}</a></li>
                    ))}
                  </ul>
                </>
              )}
            </div>
            <div>
              {(settings.contactEmail || settings.phone || settings.address) && (
                <>
                  <h4>Contacto</h4>
                  <ul>
                    {settings.contactEmail && <li><a href={`mailto:${settings.contactEmail}`}>{settings.contactEmail}</a></li>}
                    {settings.phone && <li><a href={`tel:${settings.phone.replace(/\s/g, "")}`}>{settings.phone}</a></li>}
                    {settings.address && <li className="nx-muted">{settings.address}</li>}
                  </ul>
                </>
              )}
            </div>
          </div>
          <div className="nx-footer-bottom">
            <span>© {new Date().getFullYear()} {site.name}. Todos los derechos reservados.</span>
          </div>
        </div>
      </footer>
      {settings.cookieNotice && <CookieNotice text={settings.cookieText} />}
      {settings.headCode && <div dangerouslySetInnerHTML={{ __html: settings.headCode }} />}
    </div>
  );
}
