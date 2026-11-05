import type { Metadata } from "next";
import { Globe2, LockKeyhole, Unlock, type LucideIcon } from "lucide-react";
import { AllianceStructure } from "@/components/allianz/structure";
import { OverviewTable } from "@/components/allianz/overview-table";
import { DataCenter } from "@/components/allianz/data-center";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Container, PageHeader, SectionHeading } from "@/components/ui/section";
import { allianz } from "@/i18n/allianz";
import { getMessages, getSite } from "@/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const site = await getSite();
  const m = await getMessages(allianz);
  return {
    title: m.meta.title,
    alternates: { canonical: "/allianz" },
    description: m.meta.description(site.name),
  };
}

const icons: LucideIcon[] = [LockKeyhole, Unlock, Globe2];

export default async function AllianzPage() {
  const site = await getSite();
  const m = await getMessages(allianz);

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
        description={m.hero.description(site.name)}
      />

      <AllianceStructure />
      <DataCenter />
      <OverviewTable />

      <section className="py-16 sm:py-24" aria-labelledby="gemeinsam-heading">
        <Container>
          <SectionHeading
            align="center"
            eyebrow={m.shared.eyebrow}
            title={<span id="gemeinsam-heading">{m.shared.title}</span>}
            description={m.shared.description}
          />
          <ul className="mt-12 grid gap-5 md:grid-cols-3">
            {m.shared.items.map((s, i) => {
              const Icon = icons[i]!;
              return (
                <li key={s.title}>
                  <Card className="h-full p-6">
                    <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-400/10 text-emerald-400 ring-1 ring-inset ring-emerald-400/20">
                      <Icon className="h-5 w-5" aria-hidden />
                    </span>
                    <h3 className="mt-4 text-base font-semibold text-white">
                      {s.title}
                    </h3>
                    <p className="mt-1.5 text-sm leading-relaxed text-zinc-400">
                      {s.text}
                    </p>
                  </Card>
                </li>
              );
            })}
          </ul>
          <div className="mt-12 flex flex-wrap justify-center gap-3">
            <ButtonLink href="/contact">{m.shared.contact}</ButtonLink>
            <ButtonLink href="/about" variant="secondary">
              {m.shared.about}
            </ButtonLink>
          </div>
        </Container>
      </section>
    </>
  );
}
