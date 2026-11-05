import type { Metadata } from "next";
import { CalendarDays, CalendarPlus } from "lucide-react";
import { EventSummaryCard } from "@/components/verein/events/event-parts";
import { buttonClass } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Container, PageHeader } from "@/components/ui/section";
import { getMessages } from "@/i18n/server";
import { verein } from "@/i18n/verein";
import { vereinAnlaesse } from "@/i18n/verein-anlaesse";
import { listPublicUpcoming } from "@/lib/verein/events-data";
import { publicUrl } from "@/lib/verein/links";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const m = (await getMessages(verein)).public.events;
  return { title: m.metaTitle, description: m.metaDescription, alternates: { canonical: "/anlaesse" } };
}

/** Öffentliche Liste der kommenden Anlässe (nur veröffentlichte, öffentlich sichtbare). */
export default async function EventsPage() {
  const head = (await getMessages(verein)).public.events;
  const m = (await getMessages(vereinAnlaesse)).list;
  const all = await getMessages(vereinAnlaesse);
  const events = await listPublicUpcoming(100);
  const feed = publicUrl("/anlaesse/kalender.ics");

  return (
    <>
      <PageHeader eyebrow={head.eyebrow} title={head.heading} description={m.intro} />
      <Container className="py-12">
        <div className="mx-auto max-w-3xl space-y-10">
          {events.length === 0 ? (
            <Card className="flex flex-col items-center px-6 py-14 text-center">
              <span className="flex size-12 items-center justify-center rounded-full bg-zinc-800/80 text-zinc-400 ring-1 ring-inset ring-zinc-700">
                <CalendarDays className="size-5" aria-hidden />
              </span>
              <h2 className="mt-4 text-lg font-semibold text-white">{m.emptyTitle}</h2>
              <p className="mt-1.5 max-w-sm text-sm text-zinc-400">{m.emptyText}</p>
            </Card>
          ) : (
            <ul className="space-y-4" aria-label={head.heading}>
              {events.map((e) => (
                <li key={e.id}>
                  <EventSummaryCard m={all} event={e} seats={e.seats} href={`/anlaesse/${encodeURIComponent(e.id)}`} />
                </li>
              ))}
            </ul>
          )}

          <Card className="p-5 sm:p-6">
            <h2 className="flex items-center gap-2 text-base font-semibold text-white">
              <CalendarPlus className="size-5 text-emerald-400" aria-hidden />
              {m.calendarTitle}
            </h2>
            <p className="mt-1.5 text-sm leading-relaxed text-zinc-400">{m.calendarText}</p>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <a href={feed.replace(/^https?:/i, "webcal:")} className={buttonClass("secondary")}>
                {m.calendarButton}
              </a>
              <p className="min-w-0 text-xs text-zinc-500">
                {m.calendarUrlLabel}: <span className="select-all break-all font-mono text-zinc-400">{feed}</span>
              </p>
            </div>
          </Card>
        </div>
      </Container>
    </>
  );
}
