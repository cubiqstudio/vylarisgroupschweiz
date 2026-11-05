import type { Metadata } from "next";
import { Receipt } from "lucide-react";
import { AdminInProgress } from "@/components/admin/verein/in-progress";
import { requireModulePage } from "@/lib/verein/guard";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Beiträge" };

// Platzhalter (Besitzer: beitraege). Ersetzen: echte Seite, erste Anweisung bleibt der Rechte-Wächter.
export default async function Page() {
  await requireModulePage("fees");
  return <AdminInProgress title="Beiträge" description="Beitragsjahre, Rechnungen, Zahlungseingänge und Mahnungen." icon={Receipt} />;
}
