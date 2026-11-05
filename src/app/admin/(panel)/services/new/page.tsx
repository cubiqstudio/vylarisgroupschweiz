import type { Metadata } from "next";
import { PageTitle } from "@/components/admin/core/page-title";
import { ServiceForm } from "@/components/admin/core/service-form";
import { requireModulePage } from "@/lib/verein/guard";

export const metadata: Metadata = { title: "Neuer Service" };

export default async function NewServicePage() {
  await requireModulePage("website", "write");
  return (
    <>
      <PageTitle title="Neuer Service" description="Lege ein neues SaaS-Angebot an. Es erscheint nach dem Speichern auf der öffentlichen Website." />
      <ServiceForm />
    </>
  );
}
