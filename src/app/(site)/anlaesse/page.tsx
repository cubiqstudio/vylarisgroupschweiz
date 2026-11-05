import type { Metadata } from "next";
import { PublicInProgress } from "@/components/verein/in-progress";
import { getMessages } from "@/i18n/server";
import { verein } from "@/i18n/verein";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const m = (await getMessages(verein)).public.events;
  return { title: m.metaTitle, description: m.metaDescription, alternates: { canonical: "/anlaesse" } };
}

// Platzhalter (Besitzer: anlaesse). Durch die echte Seite ersetzen.
export default async function Page() {
  const m = (await getMessages(verein)).public.events;
  return <PublicInProgress eyebrow={m.eyebrow} heading={m.heading} />;
}
