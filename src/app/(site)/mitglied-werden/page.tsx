import type { Metadata } from "next";
import { PublicInProgress } from "@/components/verein/in-progress";
import { getMessages } from "@/i18n/server";
import { verein } from "@/i18n/verein";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const m = (await getMessages(verein)).public.join;
  return { title: m.metaTitle, description: m.metaDescription, alternates: { canonical: "/mitglied-werden" } };
}

// Platzhalter (Besitzer: mitglieder). Durch die echte Seite ersetzen.
export default async function Page() {
  const m = (await getMessages(verein)).public.join;
  return <PublicInProgress eyebrow={m.eyebrow} heading={m.heading} />;
}
