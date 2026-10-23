import { db } from "@/lib/db";

/** Usado por Caddy (on_demand_tls) para decidir si emite un certificado HTTPS para un dominio. */
export async function GET(req: Request) {
  const domain = new URL(req.url).searchParams.get("domain")?.toLowerCase().replace(/^www\./, "");
  if (!domain) return new Response("missing", { status: 400 });
  const root = process.env.ROOT_DOMAIN?.toLowerCase();
  if (root && domain.endsWith(`.${root}`)) {
    const ok = await db.site.count({ where: { slug: domain.slice(0, -root.length - 1) } });
    return new Response(ok ? "ok" : "unknown", { status: ok ? 200 : 404 });
  }
  const ok = await db.site.count({ where: { OR: [{ domain }, { domain: `www.${domain}` }] } });
  return new Response(ok ? "ok" : "unknown", { status: ok ? 200 : 404 });
}
