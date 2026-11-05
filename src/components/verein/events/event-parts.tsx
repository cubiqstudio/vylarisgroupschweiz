import Link from "next/link";
import { ArrowRight, Clock, MapPin, Users } from "lucide-react";
import { Card } from "@/components/ui/card";
import { PILL } from "@/components/admin/core/styles";
import { TONE_CLASS, type Tone } from "@/lib/verein/constants";
import { calendarBadge, formatEventWhen } from "@/lib/verein/events-lib";
import type { SeatInfo } from "@/lib/verein/events-data";
import { cn } from "@/lib/utils";
import type { vereinAnlaesse } from "@/i18n/verein-anlaesse";

export type EventMessages = (typeof vereinAnlaesse)["de"];

export type CardEvent = {
  id: string;
  title: string;
  location: string;
  startsAt: Date;
  endsAt: Date | null;
  capacity: number | null;
  status: string;
  isPublic: boolean;
  membersOnly: boolean;
};

/** Kalenderblatt mit Tag, Monat und Wochentag (Zürcher Zeit). */
export function DateBadge({ date, muted = false }: { date: Date; muted?: boolean }) {
  const b = calendarBadge(date);
  return (
    <div
      aria-hidden="true"
      className={cn("flex h-16 w-14 shrink-0 flex-col items-center justify-center rounded-xl border text-center", muted ? "border-zinc-800 bg-zinc-900/40 text-zinc-500" : "border-emerald-500/30 bg-emerald-500/10 text-emerald-300")}
    >
      <span className="text-[0.65rem] font-semibold uppercase tracking-wide">{b.weekday}</span>
      <span className="text-xl font-semibold leading-none tabular-nums">{b.day}</span>
      <span className="text-[0.65rem] font-medium uppercase tracking-wide">{b.month}</span>
    </div>
  );
}

function Pill({ tone, children }: { tone: Tone; children: React.ReactNode }) {
  return <span className={cn(PILL, TONE_CLASS[tone])}>{children}</span>;
}

/** Hinweis zu den Plätzen: «Noch 5 Plätze frei», «Ausgebucht …», «Keine Platzbeschränkung». */
export function seatText(m: EventMessages, event: Pick<CardEvent, "capacity">, seats: SeatInfo): string {
  if (event.capacity === null) return m.seats.unlimited;
  if (seats.left !== null && seats.left > 0) return m.seats.left(seats.left);
  return m.seats.fullWaitlist;
}

export function EventBadges({ m, event, seats, registered }: { m: EventMessages; event: CardEvent; seats: SeatInfo; registered?: "ANGEMELDET" | "WARTELISTE" | null }) {
  const full = event.capacity !== null && seats.left === 0;
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {event.status === "ABGESAGT" && <Pill tone="rose">{m.badge.cancelled}</Pill>}
      {registered === "ANGEMELDET" && <Pill tone="green">{m.badge.registered}</Pill>}
      {registered === "WARTELISTE" && <Pill tone="amber">{m.badge.waitlist}</Pill>}
      {event.status !== "ABGESAGT" && full && !registered && <Pill tone="amber">{m.badge.full}</Pill>}
      {event.status !== "ABGESAGT" && event.membersOnly && <Pill tone="indigo">{m.badge.membersOnly}</Pill>}
      {event.status !== "ABGESAGT" && !event.membersOnly && event.isPublic && <Pill tone="sky">{m.badge.guests}</Pill>}
    </div>
  );
}

/** Karte in der öffentlichen Liste. */
export function EventSummaryCard({ m, event, seats, href }: { m: EventMessages; event: CardEvent; seats: SeatInfo; href: string }) {
  const cancelled = event.status === "ABGESAGT";
  return (
    <Card className="relative p-5 transition-colors focus-within:border-zinc-600 hover:border-zinc-700">
      <div className="flex items-start gap-4">
        <DateBadge date={event.startsAt} muted={cancelled} />
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1.5">
            <h2 className={cn("text-lg font-semibold tracking-tight [overflow-wrap:anywhere]", cancelled ? "text-zinc-400 line-through decoration-zinc-600" : "text-white")}>
              <Link href={href} className="after:absolute after:inset-0 hover:text-emerald-300 focus-visible:outline-none">
                {event.title}
              </Link>
            </h2>
            <EventBadges m={m} event={event} seats={seats} />
          </div>
          <ul className="space-y-1 text-sm text-zinc-400">
            <li className="flex items-start gap-2">
              <Clock className="mt-0.5 size-4 shrink-0 text-zinc-500" aria-hidden />
              <span>{formatEventWhen(event.startsAt, event.endsAt)}</span>
            </li>
            {event.location && (
              <li className="flex items-start gap-2">
                <MapPin className="mt-0.5 size-4 shrink-0 text-zinc-500" aria-hidden />
                <span className="[overflow-wrap:anywhere]">{event.location}</span>
              </li>
            )}
            {!cancelled && (
              <li className="flex items-start gap-2">
                <Users className="mt-0.5 size-4 shrink-0 text-zinc-500" aria-hidden />
                <span>{seatText(m, event, seats)}</span>
              </li>
            )}
          </ul>
          <p className="inline-flex items-center gap-1 text-sm font-medium text-emerald-400" aria-hidden="true">
            {m.list.details}
            <ArrowRight className="size-4" />
          </p>
        </div>
      </div>
    </Card>
  );
}
