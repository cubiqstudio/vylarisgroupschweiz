import type { Metadata } from "next";
import { ImpressumDe } from "@/components/legal/impressum-de";
import { ImpressumNet } from "@/components/legal/impressum-net";
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

export const dynamic = "force-dynamic";

/** Impressum bzw. Legal Notice: Fassung und Sprache hängen von der Domain ab (site.legal). */
export default async function ImpressumPage() {
  const site = await getSite();
  return site.legal === "net" ? <ImpressumNet /> : <ImpressumDe />;
}
