import type { Metadata } from "next";
import { FolderOpen } from "lucide-react";
import { AdminInProgress } from "@/components/admin/verein/in-progress";
import { requireModulePage } from "@/lib/verein/guard";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Dokumente" };

// Platzhalter (Besitzer: dokumente-aufgaben). Ersetzen: echte Seite, erste Anweisung bleibt der Rechte-Wächter.
export default async function Page() {
  await requireModulePage("documents");
  return <AdminInProgress title="Dokumente" description="Statuten, Reglemente, Protokolle und weitere Vereinsdokumente." icon={FolderOpen} />;
}
