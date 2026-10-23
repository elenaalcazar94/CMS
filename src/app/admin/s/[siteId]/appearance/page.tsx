import { db } from "@/lib/db";
import { requireSite } from "@/lib/auth";
import { PageHeader } from "@/components/admin/ui";
import { ThemeEditor } from "@/components/admin/ThemeEditor";
import type { ThemeSettings } from "@/lib/themes";

export const metadata = { title: "Apariencia" };

export default async function AppearancePage({ params }: { params: Promise<{ siteId: string }> }) {
  const { siteId } = await params;
  await requireSite(siteId, "appearance");
  const site = await db.site.findUniqueOrThrow({ where: { id: siteId } });
  return (
    <>
      <PageHeader title="Apariencia" description="Logotipo, colores y tipografías. Los cambios se ven al instante en la vista previa." />
      <ThemeEditor
        siteId={siteId}
        siteName={site.name}
        initial={{ theme: site.theme, overrides: (site.themeSettings ?? {}) as Partial<ThemeSettings>, logoUrl: site.logoUrl, faviconUrl: site.faviconUrl }}
      />
    </>
  );
}
