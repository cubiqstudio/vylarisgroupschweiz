import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, BadgeCheck, CalendarDays, FolderOpen, Gavel, IdCard, Receipt, UserPlus } from "lucide-react";
import { MemberStatusPill } from "@/components/admin/members/status-pill";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { getMessages } from "@/i18n/server";
import { verein } from "@/i18n/verein";
import { vereinUebersicht } from "@/i18n/verein-uebersicht";
import { getViewer } from "@/lib/auth";
import { formatDateCh, formatDateTimeCh } from "@/lib/verein/dates";
import { listEventsForMember } from "@/lib/verein/events-data";
import { listInvoicesForMember } from "@/lib/verein/fees-data";
import { getCurrentMember } from "@/lib/verein/guard";
import { formatChf } from "@/lib/verein/money";
import { getPortalMember, linkAccountByVerifiedEmail } from "@/lib/verein/members-data";
import { listPortalMeetings } from "@/lib/verein/meetings-data";
import { summarizeInvoices } from "@/lib/verein/overview-lib";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const m = (await getMessages(verein)).portal;
  return { title: m.meta.overview, robots: { index: false, follow: false } };
}

/** Lädt eine Angabe; fällt sie aus (z. B. Modul noch leer oder Fehler), bleibt der Rest der Seite erhalten. */
async function safe<T>(run: () => Promise<T>): Promise<T | null> {
  try {
    return await run();
  } catch (e) {
    console.error("[portal-uebersicht]", e instanceof Error ? e.name : "unbekannt");
    return null;
  }
}

function Tile({ icon: Icon, title, children, href, linkLabel }: { icon: typeof Receipt; title: string; children: React.ReactNode; href: string; linkLabel: string }) {
  return (
    <Card className="flex h-full flex-col p-5">
      <div className="flex items-center gap-2.5">
        <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-400/10 text-emerald-400 ring-1 ring-inset ring-emerald-400/20">
          <Icon className="h-4.5 w-4.5" aria-hidden />
        </span>
        <h3 className="text-base font-semibold text-white">{title}</h3>
      </div>
      <div className="mt-3 flex-1 text-sm text-zinc-300">{children}</div>
      <Link href={href} className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-emerald-400 hover:underline">
        {linkLabel} <ArrowRight className="h-4 w-4" aria-hidden />
      </Link>
    </Card>
  );
}

/**
 * Übersicht des Mitgliederportals. Offen für jedes angemeldete Konto: Ohne verknüpftes Mitglied steht hier, wie man Mitglied wird.
 * Alle Abfragen laufen über die Mitglieds-ID aus der Sitzung (nie aus der URL).
 */
export default async function Page() {
  const viewer = await getViewer();
  if (!viewer) redirect("/login?next=/account/verein");
  const m = (await getMessages(vereinUebersicht)).overview;
  const portal = (await getMessages(verein)).portal;
  const current = await getCurrentMember();

  // Bestätigte E-Mail-Adresse gleich der eines Mitglieds: Konto jetzt verknüpfen (best effort), dann Seite neu laden.
  if (!current && viewer.kind === "user") {
    const linked = await safe(() => linkAccountByVerifiedEmail(viewer.id));
    if (linked) redirect("/account/verein");
  }

  if (!current) {
    return (
      <section aria-labelledby="portal-heading" className="mx-auto max-w-2xl">
        <h2 id="portal-heading" className="text-xl font-semibold tracking-tight text-white">
          {portal.tabs.overview}
        </h2>
        <Card className="mt-6 flex flex-col items-center px-6 py-12 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-zinc-800/80 text-zinc-400 ring-1 ring-inset ring-zinc-700">
            <UserPlus className="h-5 w-5" aria-hidden />
          </span>
          <h3 className="mt-4 text-lg font-semibold text-white">{m.notMember.title}</h3>
          <p className="mt-2 max-w-md text-sm leading-relaxed text-zinc-400">{m.notMember.text}</p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <ButtonLink href="/mitglied-werden">{m.notMember.apply}</ButtonLink>
            <ButtonLink href="/contact" variant="secondary">
              {m.notMember.contact}
            </ButtonLink>
          </div>
        </Card>
      </section>
    );
  }

  const member = await getPortalMember(current.id);
  if (!member) redirect("/account");
  const active = member.status === "AKTIV";
  const [invoices, events, meetings] = await Promise.all([
    safe(() => listInvoicesForMember(current.id)),
    active ? safe(() => listEventsForMember(current.id)) : null,
    active ? safe(() => listPortalMeetings(current.id)) : null,
  ]);
  const summary = invoices ? summarizeInvoices(invoices) : null;
  const nextEvent = events?.[0] ?? null;
  const nextMeeting = meetings?.upcoming[0] ?? null;
  const statusText = m.statusText[member.status];

  return (
    <section aria-labelledby="portal-heading" className="space-y-6">
      <div>
        <h2 id="portal-heading" className="text-xl font-semibold tracking-tight text-white">
          {m.greeting(member.firstName)}
        </h2>
        <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-zinc-400">{m.intro}</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <Card className="p-5 md:col-span-2 xl:col-span-1">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-base font-semibold text-white">{m.status.title}</h3>
            <MemberStatusPill status={member.status} />
          </div>
          <dl className="mt-4 space-y-2.5 text-sm">
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-zinc-500">{m.status.number}</dt>
              <dd className="mt-0.5 tabular-nums text-zinc-200">{member.memberNumber}</dd>
            </div>
            {member.membershipType && (
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-zinc-500">{m.status.type}</dt>
                <dd className="mt-0.5 text-zinc-200">{member.membershipType.name}</dd>
              </div>
            )}
            {member.joinedAt && (
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-zinc-500">{m.status.since}</dt>
                <dd className="mt-0.5 text-zinc-200">{formatDateCh(member.joinedAt)}</dd>
              </div>
            )}
          </dl>
          {active && member.exitNoticeAt && member.leftAt && <p className="mt-3 rounded-lg bg-amber-500/10 px-3 py-2 text-sm text-amber-300">{m.status.exit(formatDateCh(member.leftAt))}</p>}
          {!active && statusText && <p className="mt-3 text-sm text-zinc-400">{statusText}</p>}
          <Link href="/account/verein/mitgliedschaft" className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-emerald-400 hover:underline">
            {m.status.manage} <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
        </Card>

        {active && (
          <Tile icon={IdCard} title={m.cardTitle} href="/account/verein/ausweis" linkLabel={m.cardOpen}>
            <p>{m.cardText}</p>
          </Tile>
        )}

        <Tile icon={Receipt} title={m.invoices.title} href="/account/verein/beitraege" linkLabel={m.invoices.view}>
          {summary === null ? (
            <p className="text-zinc-500">{m.unavailable}</p>
          ) : summary.openCount === 0 ? (
            <p className="flex items-center gap-1.5">
              <BadgeCheck className="h-4 w-4 text-green-700" aria-hidden /> {m.invoices.none}
            </p>
          ) : (
            <>
              <p className="font-medium text-white">{m.invoices.open(summary.openCount, formatChf(summary.openRappen))}</p>
              {summary.overdueCount > 0 && <p className="mt-1 text-rose-400">{m.invoices.overdue(summary.overdueCount)}</p>}
            </>
          )}
        </Tile>

        {active && (
          <Tile icon={CalendarDays} title={m.event.title} href="/account/verein/anlaesse" linkLabel={m.event.view}>
            {events === null ? (
              <p className="text-zinc-500">{m.unavailable}</p>
            ) : nextEvent ? (
              <>
                <p className="font-medium text-white">{nextEvent.title}</p>
                <p className="text-zinc-400">
                  <time dateTime={nextEvent.startsAt.toISOString()}>{formatDateTimeCh(nextEvent.startsAt)}</time>
                  {nextEvent.location ? ` · ${nextEvent.location}` : ""}
                </p>
                <p className="mt-1 text-xs text-zinc-500">{nextEvent.own?.status === "ANGEMELDET" ? m.event.registered : nextEvent.own?.status === "WARTELISTE" ? m.event.waiting : m.event.open}</p>
              </>
            ) : (
              <p className="text-zinc-500">{m.event.none}</p>
            )}
          </Tile>
        )}

        {active && (
          <Tile icon={Gavel} title={m.meeting.title} href="/account/verein/versammlungen" linkLabel={m.meeting.view}>
            {meetings === null ? (
              <p className="text-zinc-500">{m.unavailable}</p>
            ) : nextMeeting ? (
              <>
                <p className="font-medium text-white">{nextMeeting.title}</p>
                <p className="text-zinc-400">
                  <time dateTime={nextMeeting.startsAt.toISOString()}>{formatDateTimeCh(nextMeeting.startsAt)}</time>
                  {nextMeeting.location ? ` · ${nextMeeting.location}` : ""}
                </p>
                <p className="mt-1 text-xs text-zinc-500">
                  {nextMeeting.attendances[0]?.rsvp === "ZUSAGE" ? m.meeting.yes : nextMeeting.attendances[0]?.rsvp === "ABSAGE" ? m.meeting.no : m.meeting.pending}
                </p>
              </>
            ) : (
              <p className="text-zinc-500">{m.meeting.none}</p>
            )}
          </Tile>
        )}

        {active && (
          <Tile icon={FolderOpen} title={m.documents.title} href="/account/verein/dokumente" linkLabel={m.documents.view}>
            <p>{m.documents.text}</p>
          </Tile>
        )}
      </div>
    </section>
  );
}
