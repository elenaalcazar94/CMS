import { requireSite } from "@/lib/auth";

export default async function SiteLayout({ children, params }: { children: React.ReactNode; params: Promise<{ siteId: string }> }) {
  await requireSite((await params).siteId);
  return children;
}
