import path from "node:path";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { getSiteAccess } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { MAX_UPLOAD_BYTES, putFile, SITE_FILE_MIME } from "@/lib/storage";
import { parseSettings } from "@/lib/settings";
import { annotateHtml } from "@/lib/custom/annotate";

/** Sube un archivo de una web a medida. Los HTML se analizan para marcar las zonas editables. */
export async function POST(req: Request) {
  const fd = await req.formData();
  const siteId = String(fd.get("siteId") ?? "");
  const access = siteId ? await getSiteAccess(siteId) : null;
  if (!access || !can(access.role, "appearance")) return Response.json({ error: "Sin acceso" }, { status: 403 });

  const file = fd.get("file");
  if (!(file instanceof File)) return Response.json({ error: "Falta el archivo" }, { status: 400 });
  const raw = String(fd.get("path") || file.name).replace(/\\/g, "/").replace(/^\/+/, "");
  const rel = path.posix.normalize(raw);
  if (!rel || rel.startsWith("..") || rel.split("/").some((p) => !p || p.startsWith("."))) {
    return Response.json({ error: `Ruta no válida: ${raw}` }, { status: 400 });
  }
  const ext = rel.split(".").pop()!.toLowerCase();
  const mime = SITE_FILE_MIME[ext];
  if (!mime) return Response.json({ error: `Tipo de archivo no admitido: ${rel}` }, { status: 400 });
  if (file.size > MAX_UPLOAD_BYTES) return Response.json({ error: `${rel} supera el tamaño máximo` }, { status: 400 });

  if (ext === "html" || ext === "htm") {
    const source = await file.text();
    const result = annotateHtml(source, rel);
    const data = { mimeType: mime, size: file.size, html: result.html, storageKey: null, title: result.title, fieldCount: result.fieldCount };
    await db.templateFile.upsert({ where: { siteId_path: { siteId, path: rel } }, create: { siteId, path: rel, ...data }, update: data });

    // Formularios del HTML → formularios del CMS (se conservan los avisos configurados)
    const site = await db.site.findUniqueOrThrow({ where: { id: siteId } });
    for (const f of result.forms) {
      const fields = f.fields as unknown as Prisma.InputJsonValue;
      await db.form.upsert({
        where: { siteId_slug: { siteId, slug: f.slug } },
        create: { siteId, slug: f.slug, name: f.name, fields, notifyEmails: parseSettings(site.settings).contactEmail },
        update: { fields },
      });
    }
    return Response.json({ ok: true, path: rel, html: true, fields: result.fieldCount, manual: result.manual, forms: result.forms.length });
  }

  const storageKey = `sites/${siteId}/${rel}`;
  await putFile(storageKey, new Uint8Array(await file.arrayBuffer()), mime);
  const data = { mimeType: mime, size: file.size, html: null, storageKey, title: null, fieldCount: 0 };
  await db.templateFile.upsert({ where: { siteId_path: { siteId, path: rel } }, create: { siteId, path: rel, ...data }, update: data });
  return Response.json({ ok: true, path: rel, html: false });
}
