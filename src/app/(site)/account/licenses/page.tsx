import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { BusinessBox } from "@/components/licenses/business-box";
import { ProductCard, type ProductView } from "@/components/licenses/product-card";
import { Container } from "@/components/ui/section";
import { getMessages, getSite } from "@/i18n/server";
import { localized } from "@/i18n";
import { licenses } from "@/i18n/licenses";
import { getViewer } from "@/lib/auth";
import { getLicenseOverview } from "@/lib/licenses";
import { formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";
export async function generateMetadata(): Promise<Metadata> {
  const m = await getMessages(licenses);
  return {
    title: m.meta.title,
    robots: { index: false, follow: false },
  };
}

export default async function LicensesPage() {
  const site = await getSite();
  const m = await getMessages(licenses);
  const viewer = await getViewer();
  if (!viewer) redirect("/login?next=/account/licenses");
  // Lizenzen gehören zu Nutzerkonten; Admin-Sitzungen haben hier nichts zu tun.
  if (viewer.kind === "admin") redirect("/account");

  // Direkt aus der Datenbank (Server-Komponente); der Klartext-Schlüssel geht nur an den Besitzer und wird nicht protokolliert.
  const overview = await getLicenseOverview(viewer.id);
  const date = (d: Date) => formatDate(d, site.locale);

  const products: ProductView[] = overview.products.map((p) => ({
    slug: p.slug,
    name: localized(p, "name", site.locale),
    description: localized(p, "description", site.locale),
    comingSoon: p.comingSoon,
    manual: p.approvalMode === "MANUAL",
    mode: p.eligibility.mode,
    noneReason: p.eligibility.mode === "none" ? p.eligibility.reason : null,
    businessStatus: overview.business.status,
    key: p.key
      ? {
          status: p.key.status,
          key: p.key.key,
          bound: p.key.bound,
          adminNote: p.key.adminNote,
          createdAt: date(p.key.createdAt),
        }
      : null,
    webspace: p.webspace
      ? {
          status: p.webspace.status,
          adminNote: p.webspace.adminNote,
          createdAt: date(p.webspace.createdAt),
        }
      : null,
  }));

  return (
    <Container className="py-10 sm:py-14">
      <div className="mx-auto max-w-3xl space-y-6">
        <header>
          <h2 className="text-lg font-semibold tracking-tight text-white">{m.page.title}</h2>
          <p className="mt-1 text-sm leading-relaxed text-zinc-400">{m.page.intro}</p>
        </header>

        <BusinessBox status={overview.business.status} companyName={overview.business.companyName} />

        <section aria-labelledby="license-products" className="space-y-6">
          <h2 id="license-products" className="text-sm font-semibold uppercase tracking-[0.14em] text-zinc-500">
            {m.page.products}
          </h2>
          {products.length === 0 && <p className="text-sm text-zinc-400">{m.page.empty}</p>}
          {products.map((p) => (
            <ProductCard key={p.slug} p={p} />
          ))}
        </section>
      </div>
    </Container>
  );
}
