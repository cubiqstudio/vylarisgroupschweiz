import type { Metadata } from "next";
import { Lock } from "lucide-react";
import { JoinForm, type JoinType } from "@/components/verein/members/join-form";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Container, PageHeader } from "@/components/ui/section";
import { getMessages } from "@/i18n/server";
import { verein } from "@/i18n/verein";
import { vereinMitglieder } from "@/i18n/verein-mitglieder";
import { db } from "@/lib/db";
import { formatChf } from "@/lib/verein/money";
import { getVereinSettings } from "@/lib/verein/settings";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const m = (await getMessages(verein)).public.join;
  return { title: m.metaTitle, description: m.metaDescription, alternates: { canonical: "/mitglied-werden" } };
}

/** Öffentliches Beitrittsformular. Nur sichtbar, wenn der Verein es in den Vereinseinstellungen freigeschaltet hat. */
export default async function JoinPage() {
  const head = (await getMessages(verein)).public.join;
  const m = (await getMessages(vereinMitglieder)).join;
  const settings = await getVereinSettings();

  if (!settings.applyEnabled) {
    return (
      <>
        <PageHeader eyebrow={head.eyebrow} title={head.heading} />
        <Container className="py-12">
          <Card className="mx-auto flex max-w-xl flex-col items-center px-6 py-14 text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-zinc-800/80 text-zinc-400 ring-1 ring-inset ring-zinc-700">
              <Lock className="h-5 w-5" aria-hidden />
            </span>
            <h2 className="mt-4 text-lg font-semibold text-white">{m.closedTitle}</h2>
            <p className="mt-1.5 max-w-sm text-sm text-zinc-400">{m.closedText}</p>
            <div className="mt-6 flex flex-wrap justify-center gap-2">
              <ButtonLink href="/contact">{m.contact}</ButtonLink>
              <ButtonLink href="/verein/statuten" variant="secondary">
                {m.statutes}
              </ButtonLink>
            </div>
          </Card>
        </Container>
      </>
    );
  }

  const rows = await db.membershipType.findMany({
    where: { active: true, selectable: true },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: { id: true, name: true, description: true, annualFeeRappen: true },
  });
  const types: JoinType[] = rows.map((t) => ({ id: t.id, name: t.name, description: t.description, fee: t.annualFeeRappen > 0 ? formatChf(t.annualFeeRappen) : null }));

  return (
    <>
      <PageHeader eyebrow={head.eyebrow} title={head.heading} description={m.intro} />
      <Container className="py-12">
        <div className="mx-auto max-w-2xl">
          <JoinForm types={types} />
        </div>
      </Container>
    </>
  );
}
