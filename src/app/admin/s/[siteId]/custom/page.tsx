import Link from "next/link";
import { FileCode2, FileText, ImageIcon, FileType2, ExternalLink } from "lucide-react";
import { db } from "@/lib/db";
import { requireSite } from "@/lib/auth";
import { publicSiteUrl } from "@/lib/site";
import { Card, PageHeader } from "@/components/admin/ui";
import { ConfirmButton } from "@/components/admin/client";
import { deleteTemplateFiles } from "@/app/actions/custom";
import { formatBytes, timeAgo } from "@/lib/utils";
import { Uploader } from "./uploader";

export const metadata = { title: "Archivos de la web" };

function icon(path: string) {
  if (/\.html?$/.test(path)) return <FileCode2 className="h-4 w-4 text-brand-600" />;
  if (/\.(png|jpe?g|gif|webp|avif|svg|ico)$/.test(path)) return <ImageIcon className="h-4 w-4 text-emerald-600" />;
  if (/\.(woff2?|ttf|otf|eot)$/.test(path)) return <FileType2 className="h-4 w-4 text-amber-600" />;
  return <FileText className="h-4 w-4 text-zinc-500" />;
}

export default async function CustomFilesPage({ params }: { params: Promise<{ siteId: string }> }) {
  const { siteId } = await params;
  await requireSite(siteId, "appearance");
  const [site, files] = await Promise.all([
    db.site.findUniqueOrThrow({ where: { id: siteId } }),
    db.templateFile.findMany({ where: { siteId }, orderBy: { path: "asc" }, select: { id: true, path: true, size: true, title: true, fieldCount: true, updatedAt: true, html: false } }),
  ]);
  const htmlFiles = files.filter((f) => /\.html?$/.test(f.path));
  const total = files.reduce((a, f) => a + f.size, 0);

  return (
    <>
      <PageHeader
        title="Archivos de la web"
        description="Sube tu web hecha a mano (HTML, CSS, JS e imágenes). El CMS detecta qué se puede editar y crea una página por cada HTML."
        actions={files.length > 0 && <a href={publicSiteUrl(site)} target="_blank" rel="noreferrer" className="btn-secondary"><ExternalLink className="h-4 w-4" /> Ver la web</a>}
      />
      <div className="grid gap-6 xl:grid-cols-[1fr_380px]">
        <div className="space-y-6">
          <Uploader siteId={siteId} hasFiles={files.length > 0} />
          {files.length > 0 && (
            <Card
              title={`${files.length} archivos · ${formatBytes(total)}`}
              description={`${htmlFiles.length} páginas HTML. Si vuelves a subir un archivo con la misma ruta, se reemplaza y se conservan los textos ya editados.`}
              actions={<ConfirmButton action={deleteTemplateFiles.bind(null, siteId, "all")} title="¿Eliminar todos los archivos?" description="La web dejará de verse hasta que vuelvas a subirla. Las páginas y sus textos editados se conservan." confirmText="Eliminar todo">Eliminar todo</ConfirmButton>}
            >
              <div className="max-h-[480px] overflow-y-auto">
                <table className="table-base">
                  <tbody>
                    {files.map((f) => (
                      <tr key={f.id}>
                        <td>
                          <div className="flex items-center gap-2.5">
                            {icon(f.path)}
                            <div className="min-w-0">
                              <p className="truncate font-mono text-[13px]">{f.path}</p>
                              {f.title && <p className="truncate text-xs text-zinc-500">{f.title} · {f.fieldCount} zonas editables</p>}
                            </div>
                          </div>
                        </td>
                        <td className="hidden text-right text-xs text-zinc-500 sm:table-cell">{formatBytes(f.size)}</td>
                        <td className="hidden text-right text-xs text-zinc-500 md:table-cell">{timeAgo(f.updatedAt)}</td>
                        <td className="w-10 text-right">
                          <ConfirmButton action={deleteTemplateFiles.bind(null, siteId, [f.id])} title={`¿Eliminar ${f.path}?`} className="btn-ghost btn-sm text-zinc-400 hover:text-red-600">×</ConfirmButton>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </div>

        <Card title="Cómo prepara el CMS tu web" className="h-fit">
          <div className="space-y-4 p-5 text-[13px] leading-relaxed text-zinc-600">
            <p><strong className="text-zinc-900">Automático.</strong> Sin tocar tu código, detecta títulos, párrafos, botones, enlaces, imágenes y fondos. También detecta las listas (varios elementos con la misma clase, como tarjetas de proyectos) para que el cliente pueda añadir, quitar y reordenar elementos.</p>
            <p>La <strong className="text-zinc-900">cabecera, el menú y el pie</strong> se comparten: se editan una vez y cambian en todas las páginas.</p>
            <p>Los <strong className="text-zinc-900">formularios</strong> sin <code>action</code> se conectan solos a «Mensajes».</p>
            <p>Cada HTML puede servir de <strong className="text-zinc-900">plantilla</strong>: desde «Páginas → Nueva página» el cliente crea, por ejemplo, un proyecto nuevo con el diseño de <code>proyecto.html</code>.</p>
            <details className="rounded-lg border border-zinc-200 p-3">
              <summary className="cursor-pointer font-semibold text-zinc-900">Control total con atributos (opcional)</summary>
              <div className="mt-3 space-y-3">
                <p>Si añades al menos uno de estos atributos, el CMS solo hará editable lo que marques:</p>
                <pre className="overflow-x-auto rounded-md bg-zinc-950 p-3 text-[11px] leading-relaxed text-zinc-100">{`<h1 data-cms="titulo">Hola</h1>
<img data-cms="foto" src="a.jpg">
<a data-cms="boton" href="/contacto">Contacto</a>
<div data-cms="texto" data-cms-type="html">
  <p>Texto con párrafos y listas</p>
</div>
<section data-cms-bg="fondo"
  style="background-image:url(b.jpg)">

<!-- Lista editable: marca cada elemento -->
<article data-cms-repeat="servicios">
  <h3 data-cms="nombre">Diseño</h3>
</article>

<!-- Común a todas las páginas -->
<footer data-cms-global>…</footer>

<!-- Listado automático de páginas
     creadas con proyecto.html -->
<div data-cms-collection="proyecto">
  <a data-cms-field="url" href="#">
    <img data-cms-field="image">
    <h3 data-cms-field="title"></h3>
    <p data-cms-field="description"></p>
  </a>
</div>

<form data-cms-form="contacto">…</form>`}</pre>
                <p>En las colecciones puedes usar <code>title</code>, <code>description</code>, <code>image</code>, <code>url</code>, <code>date</code> o la clave de cualquier campo de la página.</p>
              </div>
            </details>
            <p className="text-xs text-zinc-500">Tras subir los archivos, edita los contenidos desde <Link href={`/admin/s/${siteId}/pages`} className="font-medium text-brand-600">Páginas</Link>.</p>
          </div>
        </Card>
      </div>
    </>
  );
}
