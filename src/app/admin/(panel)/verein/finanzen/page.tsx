import type { Metadata } from "next";
import { Building2 } from "lucide-react";
import { AdminInProgress } from "@/components/admin/verein/in-progress";
import { requireModulePage } from "@/lib/verein/guard";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Finanzeinstellungen" };

// Platzhalter (Besitzer: uebersicht-einstellungen). Ersetzen: echte Seite, erste Anweisung bleibt der Rechte-Wächter.
export default async function Page() {
  await requireModulePage("finance_settings");
  return <AdminInProgress title="Finanzeinstellungen" description="Kontoinhaber, IBAN, Zahlungsfrist und Mahnfristen." icon={Building2} />;
}
