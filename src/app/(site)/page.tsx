import type { Metadata } from "next";
import { Hero } from "@/components/home/hero";
import { ValueGrid } from "@/components/home/value-grid";
import { Alliance } from "@/components/home/alliance";
import { ServicesPreview } from "@/components/home/services-preview";
import { LeadershipQuote } from "@/components/home/leadership-quote";
import { CtaBand } from "@/components/home/cta-band";
import { getMessages, getSite } from "@/i18n/server";
import { siteMeta } from "@/i18n/meta";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const site = await getSite();
  const meta = await getMessages(siteMeta);
  return {
    title: { absolute: `${site.name} – ${meta.tagline}` },
    description: meta.description(site.name),
    alternates: { canonical: "/" },
  };
}

export default async function HomePage() {
  return (
    <>
      <Hero />
      <ValueGrid />
      <Alliance />
      <ServicesPreview />
      <LeadershipQuote />
      <CtaBand />
    </>
  );
}
