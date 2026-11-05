import type { Metadata } from "next";
import { ListChecks } from "lucide-react";
import { AdminInProgress } from "@/components/admin/verein/in-progress";
import { requireModulePage } from "@/lib/verein/guard";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Aufgaben" };

// Platzhalter (Besitzer: dokumente-aufgaben). Ersetzen: echte Seite, erste Anweisung bleibt der Rechte-Wächter.
export default async function Page() {
  await requireModulePage("tasks");
  return <AdminInProgress title="Aufgaben" description="Aufgaben des Vorstands mit Verantwortlichen und Fristen." icon={ListChecks} />;
}
