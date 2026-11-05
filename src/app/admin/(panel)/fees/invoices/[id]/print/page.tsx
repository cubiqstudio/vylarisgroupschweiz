import type { Metadata } from "next";
import { Printer } from "lucide-react";
import { AdminInProgress } from "@/components/admin/verein/in-progress";
import { requireModulePage } from "@/lib/verein/guard";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Rechnung drucken" };

// Platzhalter (Besitzer: beitraege): Druckansicht der Rechnung inkl. QR-Rechnung.
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  await requireModulePage("fees");
  await params;
  return <AdminInProgress title="Rechnung drucken" description="Druckansicht der Rechnung." icon={Printer} />;
}
