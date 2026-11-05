import type { Metadata } from "next";
import { Datenschutz } from "@/components/legal/datenschutz";
import { legalUi } from "@/i18n/legal";
import { getMessages, getSite } from "@/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const site = await getSite();
  const m = (await getMessages(legalUi)).privacy;
  return {
    title: m.title,
    alternates: { canonical: m.canonical },
    description: m.description(site.name),
  };
}

// Der Verantwortliche kommt aus den Admin-Einstellungen und soll nach dem Speichern sofort sichtbar sein.
export const dynamic = "force-dynamic";

export default function DatenschutzPage() {
  return <Datenschutz />;
}
