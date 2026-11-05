import type { Metadata } from "next";
import { Hero } from "@/components/home/hero";
import { ValueGrid } from "@/components/home/value-grid";
import { Alliance } from "@/components/home/alliance";
import { ServicesPreview } from "@/components/home/services-preview";
import { Volunteer } from "@/components/home/volunteer";
import { CtaBand } from "@/components/home/cta-band";
import { UpcomingEvents } from "@/components/events/upcoming";
import { site } from "@/lib/site";

export const dynamic = "force-dynamic";

export function generateMetadata(): Metadata {
  return {
    title: { absolute: `${site.name} – ${site.tagline}` },
    description: site.description,
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
      <Volunteer />
      <UpcomingEvents limit={3} />
      <CtaBand />
    </>
  );
}
