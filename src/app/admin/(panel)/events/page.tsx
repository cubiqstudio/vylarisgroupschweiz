import type { Metadata } from "next";
import { CalendarDays } from "lucide-react";
import { AdminInProgress } from "@/components/admin/verein/in-progress";
import { requireModulePage } from "@/lib/verein/guard";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Anlässe" };

// Platzhalter (Besitzer: anlaesse). Ersetzen: echte Seite, erste Anweisung bleibt der Rechte-Wächter.
export default async function Page() {
  await requireModulePage("events");
  return <AdminInProgress title="Anlässe" description="Anlässe planen, Anmeldungen verwalten und Teilnehmerlisten exportieren." icon={CalendarDays} />;
}
