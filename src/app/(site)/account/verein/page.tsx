import type { Metadata } from "next";
import { PortalInProgress } from "@/components/verein/in-progress";
import { getMessages } from "@/i18n/server";
import { verein } from "@/i18n/verein";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const m = (await getMessages(verein)).portal;
  return { title: m.meta.overview, robots: { index: false, follow: false } };
}

// Platzhalter (Besitzer: uebersicht-einstellungen). Durch die echte Seite ersetzen; Mitglieder-Seiten beginnen mit requireMemberPage().
export default async function Page() {
  const m = (await getMessages(verein)).portal;
  return <PortalInProgress heading={m.tabs.overview} />;
}
