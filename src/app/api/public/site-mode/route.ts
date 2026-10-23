import { resolveSite } from "@/lib/site";

/** Lo consulta el middleware para saber si un dominio es una web de bloques o una web a medida. */
export async function GET(req: Request) {
  const host = new URL(req.url).searchParams.get("host") ?? "";
  const site = host ? await resolveSite(host) : null;
  return Response.json({ kind: site?.kind ?? "blocks" }, { headers: { "Cache-Control": "public, max-age=30" } });
}
