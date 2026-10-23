import { requireSite } from "@/lib/auth";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/admin/ui";
import { MediaLibrary } from "@/components/admin/MediaLibrary";
import { formatBytes } from "@/lib/utils";

export const metadata = { title: "Medios" };

export default async function MediaPage({ params }: { params: Promise<{ siteId: string }> }) {
  const { siteId } = await params;
  await requireSite(siteId, "media");
  const agg = await db.media.aggregate({ where: { siteId }, _sum: { size: true }, _count: true });
  return (
    <>
      <PageHeader title="Medios" description={`${agg._count} archivos · ${formatBytes(agg._sum.size ?? 0)} en total. Arrastra archivos a esta página para subirlos.`} />
      <MediaLibrary siteId={siteId} />
    </>
  );
}
