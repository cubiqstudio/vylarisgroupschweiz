import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { buttonClass } from "@/components/ui/button";
import { PageTitle } from "@/components/admin/core/page-title";
import { GuestDataTool } from "@/components/admin/events/guest-data-tool";
import { requireModulePage } from "@/lib/verein/guard";
import { canAccess } from "@/lib/verein/permissions";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Auskunft und Löschung für Gäste" };

/** Auskunft und Löschung für Gäste bei Anlässen (revDSG Art. 25): Suche nach E-Mail-Adresse über alle Anlässe. */
export default async function GuestDataPage() {
  const admin = await requireModulePage("events");
  const canWrite = canAccess(admin.roles, "events", "write");
  const canExport = canAccess(admin.roles, "members", "read");
  return (
    <div>
      <PageTitle title="Auskunft und Löschung für Gäste" description="Alle Anmeldungen zu einer E-Mail-Adresse über alle Anlässe finden, als Auskunft exportieren und auf Anfrage löschen.">
        <Link href="/admin/events" className={buttonClass("ghost", "md")}>
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Zu den Anlässen
        </Link>
      </PageTitle>
      <GuestDataTool canWrite={canWrite} canExport={canExport} />
    </div>
  );
}
