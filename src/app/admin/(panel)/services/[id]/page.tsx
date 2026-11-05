import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireModulePage } from "@/lib/verein/guard";
import { PageTitle } from "@/components/admin/core/page-title";
import { ServiceForm } from "@/components/admin/core/service-form";
import { toServiceDTO } from "@/components/admin/core/serialize";

export const metadata: Metadata = { title: "Service bearbeiten" };
export const dynamic = "force-dynamic";

export default async function EditServicePage({ params }: { params: Promise<{ id: string }> }) {
  await requireModulePage("website");
  const { id } = await params;
  const service = await db.saasService.findUnique({ where: { id } });
  if (!service) notFound();

  return (
    <>
      <PageTitle title={service.name} description="Service bearbeiten. Änderungen sind nach dem Speichern sofort öffentlich sichtbar." />
      <ServiceForm key={service.updatedAt.toISOString()} service={toServiceDTO(service)} />
    </>
  );
}
