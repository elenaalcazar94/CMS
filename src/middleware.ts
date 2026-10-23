import { NextResponse, type NextRequest } from "next/server";

const PASSTHROUGH = [/^\/_next\//, /^\/uploads\//, /^\/api\/public\//, /^\/api\/v1\//];

function adminHosts() {
  const hosts = new Set(["localhost", "127.0.0.1", "0.0.0.0"]);
  try {
    hosts.add(new URL(process.env.APP_URL || "http://localhost:3000").hostname);
  } catch {}
  return hosts;
}

// Tipo de web por dominio (bloques o a medida), con caché de 60 s por instancia
const kinds = new Map<string, { kind: string; exp: number }>();

async function siteKind(req: NextRequest, host: string) {
  const hit = kinds.get(host);
  if (hit && hit.exp > Date.now()) return hit.kind;
  let kind = "blocks";
  try {
    const res = await fetch(new URL(`/api/public/site-mode?host=${encodeURIComponent(host)}`, req.url), { headers: { "x-nido-internal": "1" } });
    if (res.ok) kind = (await res.json()).kind;
  } catch {}
  kinds.set(host, { kind, exp: Date.now() + 60_000 });
  return kind;
}

export async function middleware(req: NextRequest) {
  const host = (req.headers.get("host") || "").toLowerCase();
  const hostname = host.replace(/:\d+$/, "");
  const { pathname } = req.nextUrl;

  // Panel de administración y vistas previas /s/slug y /c/slug
  if (adminHosts().has(hostname) || hostname.endsWith(".netlify.app")) return NextResponse.next();

  // Dominios de clientes: todo se sirve desde /s/<dominio>/... o /c/<dominio>/...
  if (PASSTHROUGH.some((r) => r.test(pathname))) return NextResponse.next();

  const prefix = (await siteKind(req, hostname)) === "custom" ? "c" : "s";
  const url = req.nextUrl.clone();
  url.pathname = `/${prefix}/${encodeURIComponent(hostname)}${pathname === "/" ? "" : pathname}`;
  const headers = new Headers(req.headers);
  headers.set("x-nido-domain", "1");
  return NextResponse.rewrite(url, { request: { headers } });
}

export const config = {
  matcher: ["/((?!_next/static|_next/image).*)"],
};
