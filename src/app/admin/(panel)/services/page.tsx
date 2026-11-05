import type { Metadata } from "next";
import { Plus } from "lucide-react";
import { db } from "@/lib/db";
import { requireModulePage } from "@/lib/verein/guard";
import { ButtonLink } from "@/components/ui/button";
import { PageTitle } from "@/components/admin/core/page-title";
import { ServiceManager } from "@/components/admin/core/service-manager";
import { toServiceDTO } from "@/components/admin/core/serialize";

export const metadata: Metadata = { title: "Services" };
export const dynamic = "force-dynamic";

export default async function AdminServicesPage() {
  await requireModulePage("website");
  const services = await db.saasService.findMany({ orderBy: [{ sortOrder: "asc" }, { name: "asc" }] });

  return (
    <>
      <PageTitle
        title="Services"
        description="Verwalte die kostenlosen SaaS-Angebote. Mit dem Status-Umschalter änderst du den öffentlich angezeigten Betriebszustand mit einem Klick."
      >
        <ButtonLink href="/admin/services/new">
          <Plus className="h-4 w-4" aria-hidden="true" /> Neuer Service
        </ButtonLink>
      </PageTitle>
      <ServiceManager initial={services.map(toServiceDTO)} />
    </>
  );
}
