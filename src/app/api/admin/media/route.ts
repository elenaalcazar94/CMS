import { imageSize } from "image-size";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { getSiteAccess } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { saveUpload } from "@/lib/storage";

async function access(siteId: string | null) {
  if (!siteId) return null;
  const a = await getSiteAccess(siteId);
  return a && can(a.role, "media") ? a : null;
}

export async function GET(req: Request) {
  const sp = new URL(req.url).searchParams;
  const siteId = sp.get("siteId");
  if (!(await access(siteId))) return Response.json({ error: "Sin acceso" }, { status: 403 });
  const q = sp.get("q")?.trim();
  const type = sp.get("type");
  const where: Prisma.MediaWhereInput = {
    siteId: siteId!,
    ...(q ? { OR: [{ originalName: { contains: q, mode: "insensitive" } }, { alt: { contains: q, mode: "insensitive" } }] } : {}),
    ...(type === "image" ? { mimeType: { startsWith: "image/" } } : type === "document" ? { NOT: { mimeType: { startsWith: "image/" } } } : {}),
  };
  const take = 60;
  const cursor = sp.get("cursor");
  const items = await db.media.findMany({
    where, orderBy: { createdAt: "desc" }, take: take + 1, ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  });
  return Response.json({ items: items.slice(0, take), next: items.length > take ? items[take - 1].id : null });
}

export async function POST(req: Request) {
  const fd = await req.formData();
  const siteId = String(fd.get("siteId") ?? "");
  const a = await access(siteId);
  if (!a) return Response.json({ error: "Sin acceso" }, { status: 403 });
  const files = fd.getAll("files").filter((f): f is File => f instanceof File && f.size > 0);
  if (!files.length) return Response.json({ error: "No se ha enviado ningún archivo" }, { status: 400 });

  const created = [];
  const errors: string[] = [];
  for (const file of files) {
    try {
      const { rel, buf } = await saveUpload(siteId, file);
      let width: number | null = null;
      let height: number | null = null;
      if (file.type.startsWith("image/")) {
        try {
          const dim = imageSize(new Uint8Array(buf));
          width = dim.width ?? null;
          height = dim.height ?? null;
        } catch {}
      }
      created.push(
        await db.media.create({
          data: {
            siteId, path: rel, url: `/uploads/${rel}`, originalName: file.name.slice(0, 200), mimeType: file.type, size: file.size,
            width, height, alt: file.name.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " ").slice(0, 120), uploadedById: a.user.id,
          },
        }),
      );
    } catch (e) {
      errors.push(`${file.name}: ${(e as Error).message}`);
    }
  }
  return Response.json({ items: created, errors }, { status: created.length ? 200 : 400 });
}
