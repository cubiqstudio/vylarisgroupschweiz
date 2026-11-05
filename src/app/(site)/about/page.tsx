import type { Metadata } from "next";
import { PageHeader, Container, SectionHeading } from "@/components/ui/section";
import { StoryTimeline } from "@/components/about/story-timeline";
import { AllianceRoles } from "@/components/about/alliance-roles";
import { ValuesDetail } from "@/components/about/values-detail";
import { Leadership } from "@/components/about/leadership";
import { FundingPrinciples } from "@/components/about/funding-principles";
import { AboutCta } from "@/components/about/about-cta";
import { about } from "@/i18n/about";
import { getMessages, getSite } from "@/i18n/server";
import { SITES } from "@/lib/sites";

export async function generateMetadata(): Promise<Metadata> {
  const site = await getSite();
  const m = await getMessages(about);
  return {
    title: m.meta.title,
    alternates: { canonical: "/about" },
    description: m.meta.description(site.name, m.partnerName),
  };
}

export default async function AboutPage() {
  const m = await getMessages(about);

  return (
    <>
      <PageHeader
        eyebrow={m.hero.eyebrow}
        title={
          <>
            {m.hero.titlePre}{" "}
            <span className="text-gradient">{m.hero.titleAccent}</span>
          </>
        }
        description={m.hero.description(SITES.eu.name, m.partnerName)}
      />

      <section className="py-20 sm:py-28" aria-labelledby="geschichte-heading">
        <Container>
          <SectionHeading
            align="center"
            eyebrow={m.story.eyebrow}
            title={<span id="geschichte-heading">{m.story.title}</span>}
            description={m.story.description}
          />
          <div className="mt-14">
            <StoryTimeline />
          </div>
        </Container>
      </section>

      <AllianceRoles />
      <ValuesDetail />
      <Leadership />
      <FundingPrinciples />
      <AboutCta />
    </>
  );
}
