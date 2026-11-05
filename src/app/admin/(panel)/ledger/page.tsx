import type { Metadata } from "next";
import { Wallet } from "lucide-react";
import { AdminInProgress } from "@/components/admin/verein/in-progress";
import { requireModulePage } from "@/lib/verein/guard";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Kassa" };

// Platzhalter (Besitzer: kassa). Ersetzen: echte Seite, erste Anweisung bleibt der Rechte-Wächter.
export default async function Page() {
  await requireModulePage("ledger");
  return <AdminInProgress title="Kassa" description="Buchungen, Konten, Budget, Belege und Jahresabschluss." icon={Wallet} />;
}
