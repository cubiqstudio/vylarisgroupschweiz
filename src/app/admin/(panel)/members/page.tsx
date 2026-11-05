import type { Metadata } from "next";
import { Users } from "lucide-react";
import { AdminInProgress } from "@/components/admin/verein/in-progress";
import { requireModulePage } from "@/lib/verein/guard";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Mitglieder" };

// Platzhalter (Besitzer: mitglieder). Ersetzen: echte Seite, erste Anweisung bleibt der Rechte-Wächter.
export default async function Page() {
  await requireModulePage("members");
  return <AdminInProgress title="Mitglieder" description="Mitgliederverwaltung: Anträge, Stammdaten, Mitgliedschaftsarten und Ämter." icon={Users} />;
}
