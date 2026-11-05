import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CalendarPlus, Clock, Info, MapPin, Users } from "lucide-react";
import { EventBadges, seatText } from "@/components/verein/events/event-parts";
import { GuestRegistrationCard } from "@/components/verein/events/guest-registration-form";
import { MemberRegistration } from "@/components/verein/events/member-registration";
import { ButtonLink, buttonClass } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Markdown } from "@/components/ui/markdown";
import { Container, PageHeader } from "@/components/ui/section";
import { getMessages } from "@/i18n/server";
import { vereinAnlaesse } from "@/i18n/verein-anlaesse";
import { site } from "@/lib/site";
import { formatDateTimeCh } from "@/lib/verein/dates";
import { getPublicEvent, getEventForMember } from "@/lib/verein/events-data";
import { eventJsonLd, formatEventWhen, jsonLdString, MAX_SEATS_GUEST, MAX_SEATS_MEMBER, registrationBlock, stripMarkdown } from "@/lib/verein/events-lib";
import { getCurrentMember } from "@/lib/verein/guard";
import { eventUrl, publicUrl } from "@/lib/verein/links";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

const ID = /^[A-Za-z0-9_-]{1,40}$/;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const event = ID.test(id) ? await getPublicEvent(id) : null;
  if (!event) return { title: "Anlass", robots: { index: false } };
  const description = stripMarkdown(event.description, 160) || formatEventWhen(event.startsAt, event.endsAt);
  return { title: event.title, description, alternates: { canonical: `/anlaesse/${event.id}` } };
}

function Row({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3">
      <span className="mt-0.5 text-zinc-500">{icon}</span>
      <div className="min-w-0">
        <dt className="text-xs font-medium uppercase tracking-wide text-zinc-500">{label}</dt>
        <dd className="mt-0.5 text-sm text-zinc-200 [overflow-wrap:anywhere]">{children}</dd>
      </div>
    </div>
  );
}

/** Detailseite eines öffentlichen Anlasses mit Anmeldung (Gast oder aktuelles Mitglied), Kalendereintrag und schema.org-Daten. */
export default async function EventDetailPage({ params }: Props) {
  const { id } = await params;
  const event = ID.test(id) ? await getPublicEvent(id) : null;
  if (!event) notFound();
  const m = await getMessages(vereinAnlaesse);
  const d = m.detail;

  const now = new Date();
  const block = registrationBlock(event, now);
  const member = await getCurrentMember();
  const activeMember = member && member.status === "AKTIV" ? member : null;
  const own = activeMember ? (await getEventForMember(event.id, activeMember.id))?.own ?? null : null;
  const cancelled = event.status === "ABGESAGT";
  const ld = eventJsonLd(event, { url: eventUrl(event.id), organizerName: site.legalName, organizerUrl: publicUrl("/") });

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdString(ld) }} />
      <PageHeader eyebrow={d.eyebrow} title={event.title}>
        <div className="mt-5">
          <EventBadges m={m} event={event} seats={event.seats} registered={own?.status === "ANGEMELDET" || own?.status === "WARTELISTE" ? own.status : null} />
        </div>
      </PageHeader>
      <Container className="py-12">
        <Link href="/anlaesse" className="mb-8 inline-flex items-center gap-1.5 text-sm font-medium text-zinc-400 hover:text-white">
          <ArrowLeft className="size-4" aria-hidden />
          {d.back}
        </Link>

        <div className="grid gap-8 lg:grid-cols-[1fr_24rem]">
          <div className="space-y-8">
            {cancelled && (
              <div role="status" className="flex items-start gap-3 rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-200">
                <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
                <div>
                  <p className="font-medium">{d.cancelledTitle}</p>
                  <p className="mt-1">{d.cancelledText}</p>
                </div>
              </div>
            )}
            <section aria-labelledby="about-heading">
              <h2 id="about-heading" className="text-xl font-semibold tracking-tight text-white">
                {d.about}
              </h2>
              <div className="mt-4">{event.description.trim() ? <Markdown>{event.description}</Markdown> : <p className="text-sm text-zinc-500">{d.noDescription}</p>}</div>
            </section>
          </div>

          <aside className="space-y-6" aria-label={d.registrationTitle}>
            <Card className="p-5">
              <dl className="space-y-4">
                <Row icon={<Clock className="size-4" aria-hidden />} label={d.when}>
                  {formatEventWhen(event.startsAt, event.endsAt)}
                </Row>
                {event.location && (
                  <Row icon={<MapPin className="size-4" aria-hidden />} label={d.where}>
                    {event.location}
                  </Row>
                )}
                {!cancelled && (
                  <Row icon={<Users className="size-4" aria-hidden />} label={d.places}>
                    {seatText(m, event, event.seats)}
                    {event.capacity !== null && <span className="block text-xs text-zinc-500">{m.seats.total(event.capacity)}</span>}
                  </Row>
                )}
                {!cancelled && event.registrationDeadline && (
                  <Row icon={<Clock className="size-4" aria-hidden />} label={d.deadline}>
                    {formatDateTimeCh(event.registrationDeadline)}
                  </Row>
                )}
              </dl>
              {!cancelled && (
                <a href={`/anlaesse/${encodeURIComponent(event.id)}/termin.ics`} className={buttonClass("secondary", "md", "mt-5 w-full")}>
                  <CalendarPlus className="size-4" aria-hidden />
                  {d.calendar}
                </a>
              )}
            </Card>

            {!cancelled && (
              <Card className="p-5 sm:p-6">
                <h2 className="sr-only">{d.registrationTitle}</h2>
                {block ? (
                  <p className="text-sm text-zinc-300" role="status">
                    {d.closed[block]}
                  </p>
                ) : activeMember ? (
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold text-white">{d.registrationTitle}</h3>
                    <MemberRegistration
                      eventId={event.id}
                      eventTitle={event.title}
                      own={own ? { status: own.status as "ANGEMELDET" | "WARTELISTE" | "ABGESAGT", seats: own.seats } : null}
                      maxSeats={MAX_SEATS_MEMBER}
                      seatsLeft={event.seats.left}
                      canRegister
                      canCancel
                    />
                    <Link href="/account/verein/anlaesse" className="inline-block text-sm text-emerald-400 underline underline-offset-4 hover:text-emerald-300">
                      {d.portalLink}
                    </Link>
                  </div>
                ) : event.membersOnly ? (
                  <div className="space-y-3">
                    <h3 className="text-lg font-semibold text-white">{d.membersOnlyTitle}</h3>
                    <p className="text-sm leading-relaxed text-zinc-400">{member ? d.notActiveMember : d.membersOnlyText}</p>
                    {!member && (
                      <div className="flex flex-wrap gap-2 pt-1">
                        <ButtonLink href={`/login?next=${encodeURIComponent(`/anlaesse/${event.id}`)}`}>{d.login}</ButtonLink>
                        <ButtonLink href="/mitglied-werden" variant="secondary">
                          {d.becomeMember}
                        </ButtonLink>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="space-y-5">
                    {!member && (
                      <p className="text-sm leading-relaxed text-zinc-400">
                        {d.guestOrMember}{" "}
                        <Link href={`/login?next=${encodeURIComponent(`/anlaesse/${event.id}`)}`} className="text-emerald-400 underline underline-offset-4 hover:text-emerald-300">
                          {d.login}
                        </Link>
                      </p>
                    )}
                    <GuestRegistrationCard eventId={event.id} maxSeats={MAX_SEATS_GUEST} seatsLeft={event.seats.left} />
                  </div>
                )}
              </Card>
            )}
          </aside>
        </div>
      </Container>
    </>
  );
}
