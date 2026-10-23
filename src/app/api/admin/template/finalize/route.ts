import { finalizeImport } from "@/app/actions/custom";

/** Crea las páginas tras subir los archivos. Es una ruta (no una server action) para que funcione aunque el panel abierto sea de un despliegue anterior. */
export async function POST(req: Request) {
  const { siteId } = await req.json().catch(() => ({ siteId: "" }));
  if (!siteId) return Response.json({ error: "Falta el sitio" }, { status: 400 });
  const r = await finalizeImport(String(siteId));
  return Response.json(r, { status: r.error ? 400 : 200 });
}
