import "server-only";
import path from "node:path";
import fs from "node:fs/promises";
import crypto from "node:crypto";

export const UPLOAD_DIR = path.resolve(process.env.UPLOAD_DIR || "./uploads");
export const MAX_UPLOAD_BYTES = Number(process.env.MAX_UPLOAD_MB || 20) * 1024 * 1024;

export const ALLOWED_MIME: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/avif": "avif",
  "image/svg+xml": "svg",
  "image/x-icon": "ico",
  "image/vnd.microsoft.icon": "ico",
  "application/pdf": "pdf",
  "video/mp4": "mp4",
  "video/webm": "webm",
  "text/plain": "txt",
  "application/zip": "zip",
  "application/msword": "doc",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
  "application/vnd.ms-excel": "xls",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
};

export const MIME_BY_EXT: Record<string, string> = Object.fromEntries(
  Object.entries(ALLOWED_MIME).map(([m, e]) => [e, m]),
);

export function safeBaseName(name: string) {
  return (
    name
      .replace(/\.[^.]+$/, "")
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "")
      .slice(0, 60) || "archivo"
  );
}

/** Netlify no tiene disco persistente: allí los archivos se guardan en Netlify Blobs. */
export function useBlobStorage() {
  if (process.env.STORAGE_DRIVER) return process.env.STORAGE_DRIVER === "netlify";
  return !!(process.env.NETLIFY || process.env.NETLIFY_BLOBS_CONTEXT);
}

async function blobStore() {
  const { getStore } = await import("@netlify/blobs");
  return getStore({ name: "uploads", consistency: "strong" });
}

export async function saveUpload(siteId: string, file: File) {
  const ext = ALLOWED_MIME[file.type];
  if (!ext) throw new Error(`Tipo de archivo no permitido: ${file.type || "desconocido"}`);
  if (file.size > MAX_UPLOAD_BYTES) throw new Error(`El archivo supera el máximo de ${process.env.MAX_UPLOAD_MB || 20} MB`);
  const now = new Date();
  const dir = [siteId, String(now.getFullYear()), String(now.getMonth() + 1).padStart(2, "0")].join("/");
  const rel = `${dir}/${safeBaseName(file.name)}-${crypto.randomBytes(4).toString("hex")}.${ext}`;
  const buf = Buffer.from(await file.arrayBuffer());
  if (useBlobStorage()) {
    const store = await blobStore();
    await store.set(rel, new Uint8Array(buf).buffer as ArrayBuffer, { metadata: { contentType: file.type } });
  } else {
    await fs.mkdir(path.join(UPLOAD_DIR, dir), { recursive: true });
    await fs.writeFile(path.join(UPLOAD_DIR, rel), buf);
  }
  return { rel, buf, ext };
}

/** Devuelve el contenido de un archivo subido, o null si no existe. */
export async function readUpload(rel: string): Promise<Uint8Array | null> {
  if (rel.split("/").some((part) => part === ".." || part === "")) return null;
  if (useBlobStorage()) {
    const data = await (await blobStore()).get(rel, { type: "arrayBuffer" });
    return data ? new Uint8Array(data) : null;
  }
  const full = path.resolve(UPLOAD_DIR, rel);
  if (!full.startsWith(UPLOAD_DIR + path.sep)) return null;
  try {
    return new Uint8Array(await fs.readFile(full));
  } catch {
    return null;
  }
}

export async function deleteUpload(rel: string) {
  if (useBlobStorage()) return (await blobStore()).delete(rel);
  const full = path.join(UPLOAD_DIR, rel);
  if (!full.startsWith(UPLOAD_DIR)) return;
  await fs.rm(full, { force: true });
}
