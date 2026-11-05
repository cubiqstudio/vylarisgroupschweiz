import type { Metadata } from "next";
import { Impressum } from "@/components/legal/impressum";
import { legalUi } from "@/i18n/legal";
import { getMessages, getSite } from "@/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const site = await getSite();
  const m = (await getMessages(legalUi)).imprint;
  return {
    title: m.title,
    alternates: { canonical: m.canonical },
    description: m.description(site.name),
  };
}

// Die Angaben kommen aus den Admin-Einstellungen und sollen nach dem Speichern sofort sichtbar sein.
export const dynamic = "force-dynamic";

export default function ImpressumPage() {
  return <Impressum />;
}
