"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { unzipSync } from "fflate";
import { FolderUp, FileArchive, Loader2, CheckCircle2, AlertCircle, UploadCloud } from "lucide-react";
import { toast } from "@/components/admin/toast";
import { cn } from "@/lib/utils";

type Item = { path: string; file: File };

const IGNORE = /(^|\/)(\.|__MACOSX|node_modules|Thumbs\.db)/;

/** Quita la carpeta común de primer nivel (mi-web/index.html → index.html). */
function normalize(items: Item[]) {
  const clean = items.filter((i) => !IGNORE.test(i.path) && i.file.size > 0);
  const firsts = new Set(clean.map((i) => i.path.split("/")[0]));
  const strip = firsts.size === 1 && clean.every((i) => i.path.includes("/")) && !clean.some((i) => i.path.split("/")[0].endsWith(".html"));
  return clean.map((i) => ({ ...i, path: strip ? i.path.split("/").slice(1).join("/") : i.path }));
}

const MIME: Record<string, string> = { html: "text/html", css: "text/css", js: "text/javascript", svg: "image/svg+xml", png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", webp: "image/webp", gif: "image/gif", json: "application/json" };

export function Uploader({ siteId, hasFiles }: { siteId: string; hasFiles: boolean }) {
  const folderRef = useRef<HTMLInputElement>(null);
  const zipRef = useRef<HTMLInputElement>(null);
  const [progress, setProgress] = useState<{ done: number; total: number; current: string } | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [summary, setSummary] = useState<string | null>(null);
  const [drag, setDrag] = useState(false);
  const router = useRouter();

  async function upload(raw: Item[]) {
    const items = normalize(raw);
    if (!items.length) return toast.error("No se han encontrado archivos");
    if (!items.some((i) => /\.html?$/i.test(i.path))) return toast.error("No hay ningún archivo .html en lo que has subido");
    setErrors([]);
    setSummary(null);
    // Primero los recursos y al final los HTML
    items.sort((a, b) => Number(/\.html?$/i.test(a.path)) - Number(/\.html?$/i.test(b.path)));
    const errs: string[] = [];
    let done = 0;
    let editable = 0;
    setProgress({ done, total: items.length, current: "" });
    const queue = [...items];
    const worker = async () => {
      while (queue.length) {
        const it = queue.shift()!;
        setProgress({ done, total: items.length, current: it.path });
        const fd = new FormData();
        fd.set("siteId", siteId);
        fd.set("path", it.path);
        fd.set("file", it.file);
        try {
          const res = await fetch("/api/admin/template", { method: "POST", body: fd });
          const json = await res.json().catch(() => ({ error: `Error ${res.status}` }));
          if (!res.ok) errs.push(json.error || `${it.path}: error ${res.status}`);
          else if (json.html) editable += json.fields ?? 0;
        } catch {
          errs.push(`${it.path}: no se pudo subir`);
        }
        done++;
        setProgress({ done, total: items.length, current: it.path });
      }
    };
    await Promise.all([worker(), worker(), worker()]);
    const r: { error?: string; message?: string } = await fetch("/api/admin/template/finalize", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ siteId }),
    }).then((res) => res.json()).catch(() => ({ error: "No se han podido crear las páginas. Recarga e inténtalo de nuevo." }));
    setProgress(null);
    setErrors(errs);
    if (r.error) toast.error(r.error);
    else {
      setSummary(`${items.length - errs.length} archivos subidos · ${editable} zonas editables detectadas. ${r.message ?? ""}`);
      toast(r.message || "Web subida");
    }
    router.refresh();
  }

  function fromFileList(list: FileList) {
    upload(Array.from(list).map((f) => ({ path: (f as File & { webkitRelativePath?: string }).webkitRelativePath || f.name, file: f })));
  }

  async function fromZip(file: File) {
    try {
      const entries = unzipSync(new Uint8Array(await file.arrayBuffer()));
      const items = Object.entries(entries)
        .filter(([name]) => !name.endsWith("/"))
        .map(([name, data]) => {
          const ext = name.split(".").pop()?.toLowerCase() ?? "";
          return { path: name, file: new File([new Uint8Array(data)], name.split("/").pop()!, { type: MIME[ext] ?? "application/octet-stream" }) };
        });
      upload(items);
    } catch {
      toast.error("No se ha podido abrir el .zip");
    }
  }

  async function fromDrop(e: React.DragEvent) {
    e.preventDefault();
    setDrag(false);
    const dt = e.dataTransfer;
    if (dt.files.length === 1 && dt.files[0].name.toLowerCase().endsWith(".zip")) return fromZip(dt.files[0]);
    // Carpetas arrastradas: se recorren con la API de entradas
    const entries = Array.from(dt.items).map((i) => i.webkitGetAsEntry?.()).filter(Boolean) as FileSystemEntry[];
    if (!entries.length) return fromFileList(dt.files);
    const out: Item[] = [];
    const walk = async (entry: FileSystemEntry, prefix: string): Promise<void> => {
      if (entry.isFile) {
        const file = await new Promise<File>((res, rej) => (entry as FileSystemFileEntry).file(res, rej));
        out.push({ path: `${prefix}${file.name}`, file });
      } else if (entry.isDirectory) {
        const reader = (entry as FileSystemDirectoryEntry).createReader();
        let batch: FileSystemEntry[] = [];
        do {
          batch = await new Promise<FileSystemEntry[]>((res, rej) => reader.readEntries(res, rej));
          for (const child of batch) await walk(child, `${prefix}${entry.name}/`);
        } while (batch.length);
      }
    };
    for (const entry of entries) await walk(entry, "");
    upload(out);
  }

  const busy = !!progress;
  return (
    <div className="space-y-3">
      <div
        onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        onDrop={fromDrop}
        className={cn("card flex flex-col items-center justify-center border-2 border-dashed px-6 py-12 text-center transition", drag ? "border-brand-500 bg-brand-50/60" : "border-zinc-200")}
      >
        {busy ? (
          <div className="w-full max-w-md">
            <Loader2 className="mx-auto mb-3 h-8 w-8 animate-spin text-brand-600" />
            <p className="font-semibold">Subiendo {progress.done} de {progress.total}…</p>
            <p className="mt-1 truncate font-mono text-xs text-zinc-500">{progress.current}</p>
            <div className="mt-4 h-2 overflow-hidden rounded-full bg-zinc-100"><div className="h-full rounded-full bg-brand-600 transition-all" style={{ width: `${(progress.done / progress.total) * 100}%` }} /></div>
          </div>
        ) : (
          <>
            <div className="mb-3 grid h-12 w-12 place-items-center rounded-2xl bg-brand-50 text-brand-600"><UploadCloud className="h-6 w-6" /></div>
            <p className="font-semibold text-zinc-900">{hasFiles ? "Sube una nueva versión de tu web" : "Sube tu web"}</p>
            <p className="mt-1 max-w-md text-sm text-zinc-500">Arrastra aquí la carpeta del proyecto o un .zip. Debe incluir al menos un <code>index.html</code>.</p>
            <div className="mt-5 flex flex-wrap justify-center gap-2">
              <button className="btn-primary" onClick={() => folderRef.current?.click()}><FolderUp className="h-4 w-4" /> Elegir carpeta</button>
              <button className="btn-secondary" onClick={() => zipRef.current?.click()}><FileArchive className="h-4 w-4" /> Subir .zip</button>
            </div>
          </>
        )}
        <input ref={folderRef} type="file" hidden multiple {...({ webkitdirectory: "", directory: "" } as Record<string, string>)} onChange={(e) => e.target.files && fromFileList(e.target.files)} />
        <input ref={zipRef} type="file" hidden accept=".zip,application/zip" onChange={(e) => e.target.files?.[0] && fromZip(e.target.files[0])} />
      </div>
      {summary && <p className="flex items-center gap-2 rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-800"><CheckCircle2 className="h-4 w-4" /> {summary}</p>}
      {errors.length > 0 && (
        <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-800">
          <p className="flex items-center gap-2 font-semibold"><AlertCircle className="h-4 w-4" /> {errors.length} archivos no se han podido subir</p>
          <ul className="mt-1 list-disc pl-6 text-xs">{errors.slice(0, 20).map((e) => <li key={e}>{e}</li>)}</ul>
        </div>
      )}
    </div>
  );
}
