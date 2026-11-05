import type { Metadata } from "next";
import { DatenschutzDe } from "@/components/legal/datenschutz-de";
import { DatenschutzNet } from "@/components/legal/datenschutz-net";
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

export const dynamic = "force-dynamic";

/** Datenschutzerklärung bzw. Privacy Policy: Fassung und Sprache hängen von der Domain ab (site.legal). */
export default async function DatenschutzPage() {
  const site = await getSite();
  return site.legal === "net" ? <DatenschutzNet /> : <DatenschutzDe />;
}
