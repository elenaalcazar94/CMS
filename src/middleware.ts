import { NextResponse, type NextRequest } from "next/server";

const PASSTHROUGH = [/^\/_next\//, /^\/uploads\//, /^\/api\/public\//, /^\/api\/v1\//];

function adminHosts() {
  const hosts = new Set(["localhost", "127.0.0.1", "0.0.0.0"]);
  try {
    hosts.add(new URL(process.env.APP_URL || "http://localhost:3000").hostname);
  } catch {}
  return hosts;
}

export function middleware(req: NextRequest) {
  const host = (req.headers.get("host") || "").toLowerCase();
  const hostname = host.replace(/:\d+$/, "");
  const { pathname } = req.nextUrl;

  // Panel de administración y vistas previas /s/slug
  if (adminHosts().has(hostname) || hostname.endsWith(".netlify.app")) return NextResponse.next();

  // Dominios de clientes: todo se sirve desde /s/<dominio>/...
  if (PASSTHROUGH.some((r) => r.test(pathname))) return NextResponse.next();

  const url = req.nextUrl.clone();
  url.pathname = `/s/${encodeURIComponent(hostname)}${pathname === "/" ? "" : pathname}`;
  const headers = new Headers(req.headers);
  headers.set("x-nido-domain", "1");
  return NextResponse.rewrite(url, { request: { headers } });
}

export const config = {
  matcher: ["/((?!_next/static|_next/image).*)"],
};
