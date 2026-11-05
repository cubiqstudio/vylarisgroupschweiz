import type { Metadata } from "next";
import { UserCog } from "lucide-react";
import { AdminInProgress } from "@/components/admin/verein/in-progress";
import { requireModulePage } from "@/lib/verein/guard";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Zugänge und Rollen" };

// Platzhalter (Besitzer: uebersicht-einstellungen). Ersetzen: echte Seite, erste Anweisung bleibt der Rechte-Wächter.
export default async function Page() {
  await requireModulePage("system");
  return <AdminInProgress title="Zugänge und Rollen" description="Admin-Konten, Rollen (Präsident, Vize, Kassier, Aktuar, Revisor, Administrator) und Verknüpfung mit Mitgliedern." icon={UserCog} />;
}
