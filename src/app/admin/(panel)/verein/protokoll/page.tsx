import type { Metadata } from "next";
import { ScrollText } from "lucide-react";
import { AdminInProgress } from "@/components/admin/verein/in-progress";
import { requireModulePage } from "@/lib/verein/guard";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Änderungsprotokoll" };

// Platzhalter (Besitzer: uebersicht-einstellungen). Ersetzen: echte Seite, erste Anweisung bleibt der Rechte-Wächter.
export default async function Page() {
  await requireModulePage("audit");
  return <AdminInProgress title="Änderungsprotokoll" description="Nachvollziehbarkeit sensibler Änderungen: wer hat wann was geändert." icon={ScrollText} />;
}
