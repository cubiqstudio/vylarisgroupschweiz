import type { Metadata } from "next";
import { Gavel } from "lucide-react";
import { AdminInProgress } from "@/components/admin/verein/in-progress";
import { requireModulePage } from "@/lib/verein/guard";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Versammlungen" };

// Platzhalter (Besitzer: versammlungen). Ersetzen: echte Seite, erste Anweisung bleibt der Rechte-Wächter.
export default async function Page() {
  await requireModulePage("meetings");
  return <AdminInProgress title="Versammlungen" description="Mitgliederversammlungen und Vorstandssitzungen: Einladung, Traktanden, Protokoll und Beschlüsse." icon={Gavel} />;
}
