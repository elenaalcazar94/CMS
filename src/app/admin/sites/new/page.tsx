import { requireSuperadmin } from "@/lib/auth";
import { PageHeader } from "@/components/admin/ui";
import { NewSiteForm } from "./form";

export const metadata = { title: "Nuevo sitio" };

export default async function NewSitePage() {
  await requireSuperadmin();
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Nuevo sitio" description="Crea la web de un cliente. Podrás cambiarlo todo más adelante." back={{ href: "/admin", label: "Sitios" }} />
      <NewSiteForm rootDomain={process.env.ROOT_DOMAIN || ""} />
    </div>
  );
}
