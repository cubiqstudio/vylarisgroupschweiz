// Fachlogik der Anlässe: Plätze und Warteliste, Anmeldefrist, Erinnerung, Kopie, Kalendereintrag (ICS), schema.org und CSV.
// Reine Funktionen ohne Seiteneffekte (kein Zugriff auf Datenbank oder Umgebung); getestet in scripts/test/events.test.mts.
import type { CsvCell } from "./csv";
import { formatDateCh, formatDateTimeCh, zurichOffsetMinutes, zurichParts } from "./dates";
import type { IcsEvent } from "./ics";

// ---- Grenzen -------------------------------------------------------------------------------------------------------

/** Höchstzahl Personen (inkl. Begleitung) pro Anmeldung. */
export const MAX_SEATS_MEMBER = 10;
export const MAX_SEATS_GUEST = 5;
/** Erinnerungen gehen an Anlässe, die innerhalb dieser Stunden beginnen (siehe isReminderDue). */
export const REMINDER_WINDOW_HOURS = 36;

/** Gäste müssen ihre E-Mail-Adresse bestätigen: Der Link gilt so viele Stunden; danach wird die unbestätigte Anmeldung gelöscht. */
export const CONFIRM_TTL_HOURS = 48;
/** Frühestens nach so vielen Minuten geht für dieselbe Anmeldung erneut eine Bestätigungsmail hinaus (Drosselung). */
export const CONFIRM_RESEND_MINUTES = 5;

export const EVENT_VIEWS = ["kommend", "vergangen", "entwurf", "abgesagt", "alle"] as const;
export type EventView = (typeof EVENT_VIEWS)[number];
export const EVENT_VIEW_LABEL: Record<EventView, string> = { kommend: "Kommende", vergangen: "Vergangene", entwurf: "Entwürfe", abgesagt: "Abgesagte", alle: "Alle" };

// ---- Plätze und Warteliste -----------------------------------------------------------------------------------------

// ---- Bestätigung der E-Mail-Adresse (Gäste) ------------------------------------------------------------------------------

/** Bis wann eine unbestätigte Anmeldung gilt (ab Eingang). */
export function confirmExpiresAt(createdAt: Date): Date {
  return new Date(createdAt.getTime() + CONFIRM_TTL_HOURS * 3_600_000);
}

/** Ist die Frist zur Bestätigung abgelaufen? Genau zum Ablaufzeitpunkt gilt sie bereits als abgelaufen. */
export function isConfirmationExpired(createdAt: Date, now: Date = new Date()): boolean {
  return now.getTime() >= confirmExpiresAt(createdAt).getTime();
}

/** Darf die Bestätigungsmail schon wieder verschickt werden? (Drosselung; `null` = noch nie verschickt.) */
export function canResendConfirmation(lastSentAt: Date | null, now: Date = new Date()): boolean {
  return lastSentAt === null || now.getTime() - lastSentAt.getTime() >= CONFIRM_RESEND_MINUTES * 60_000;
}

/** Stichtag für das Aufräumen: Unbestätigte Anmeldungen, die vor diesem Zeitpunkt eingegangen sind, sind abgelaufen. */
export function confirmPurgeCutoff(now: Date = new Date()): Date {
  return new Date(now.getTime() - CONFIRM_TTL_HOURS * 3_600_000);
}

export type SeatRow = { status: string; seats: number };

/** Belegte Plätze: Summe der Personen aller Anmeldungen mit Status «Angemeldet». */
export function seatsTaken(rows: readonly SeatRow[]): number {
  return rows.reduce((sum, r) => (r.status === "ANGEMELDET" ? sum + r.seats : sum), 0);
}

/** Personen auf der Warteliste. */
export function seatsWaiting(rows: readonly SeatRow[]): number {
  return rows.reduce((sum, r) => (r.status === "WARTELISTE" ? sum + r.seats : sum), 0);
}

/** Freie Plätze (null = unbegrenzt). Nie negativ, auch wenn die Kapazität nachträglich gesenkt wurde. */
export function seatsLeft(capacity: number | null, taken: number): number | null {
  return capacity === null ? null : Math.max(0, capacity - taken);
}

export type Decision = { ok: true; status: "ANGEMELDET" | "WARTELISTE" } | { ok: false; reason: "TOO_LARGE" };

/**
 * Entscheidet über eine neue Anmeldung: Platz frei → angemeldet, sonst Warteliste.
 * Eine Anmeldung, die grösser ist als die ganze Kapazität, wird abgelehnt (sie könnte nie nachrücken).
 */
export function decideRegistration(opts: { capacity: number | null; taken: number; seats: number }): Decision {
  const { capacity, taken, seats } = opts;
  if (capacity === null) return { ok: true, status: "ANGEMELDET" };
  if (seats > capacity) return { ok: false, reason: "TOO_LARGE" };
  return { ok: true, status: taken + seats <= capacity ? "ANGEMELDET" : "WARTELISTE" };
}

export type WaitingRow = { id: string; seats: number };

/**
 * Wer von der Warteliste nachrückt. `waiting` ist nach Anmeldezeit geordnet (die Älteste zuerst).
 * Es rückt nach, wer noch in die freien Plätze passt; passt eine grössere Gruppe nicht, bleibt sie in der Reihenfolge vorn
 * und kleinere Gruppen dahinter dürfen die Plätze füllen – so bleiben keine Plätze leer.
 */
export function planPromotions(opts: { capacity: number | null; taken: number; waiting: readonly WaitingRow[] }): string[] {
  const { capacity, waiting } = opts;
  let taken = opts.taken;
  const promoted: string[] = [];
  for (const w of waiting) {
    if (capacity === null || taken + w.seats <= capacity) {
      promoted.push(w.id);
      taken += w.seats;
    }
  }
  return promoted;
}

// ---- Anmeldefrist --------------------------------------------------------------------------------------------------

export type RegistrationBlock = "DRAFT" | "CANCELLED" | "PAST" | "DEADLINE";

export const REGISTRATION_BLOCK_MESSAGE: Record<RegistrationBlock, string> = {
  DRAFT: "Dieser Anlass ist noch nicht veröffentlicht.",
  CANCELLED: "Dieser Anlass wurde abgesagt.",
  PAST: "Dieser Anlass hat bereits begonnen.",
  DEADLINE: "Der Anmeldeschluss ist vorbei.",
};

type EventTiming = { status: string; startsAt: Date; registrationDeadline: Date | null };

/** Warum man sich (noch) nicht anmelden kann; null = Anmeldung möglich. */
export function registrationBlock(e: EventTiming, now: Date = new Date()): RegistrationBlock | null {
  if (e.status === "ENTWURF") return "DRAFT";
  if (e.status === "ABGESAGT") return "CANCELLED";
  if (now.getTime() >= e.startsAt.getTime()) return "PAST";
  if (e.registrationDeadline && now.getTime() > e.registrationDeadline.getTime()) return "DEADLINE";
  return null;
}

/** Abmelden ist bis zum Beginn des Anlasses möglich (bei einer Absage jederzeit). */
export function canCancelRegistration(e: Pick<EventTiming, "status" | "startsAt">, now: Date = new Date()): boolean {
  return e.status === "ABGESAGT" || now.getTime() < e.startsAt.getTime();
}

/** Liegt der Anlass noch vor uns oder läuft er? Auch ein Anlass ohne Ende gilt am Tag seines Beginns noch als kommend. */
export function isUpcoming(e: { startsAt: Date; endsAt: Date | null }, now: Date = new Date()): boolean {
  const end = e.endsAt && e.endsAt.getTime() > e.startsAt.getTime() ? e.endsAt : e.startsAt;
  if (end.getTime() >= now.getTime()) return true;
  const a = zurichParts(e.startsAt);
  const b = zurichParts(now);
  return a.year === b.year && a.month === b.month && a.day === b.day;
}

// ---- Erinnerung ----------------------------------------------------------------------------------------------------

/** Ist der Anlass nah genug (Beginn in der Zukunft, höchstens REMINDER_WINDOW_HOURS), dass die Erinnerung fällig ist? */
export function isReminderDue(startsAt: Date, now: Date = new Date()): boolean {
  const diff = startsAt.getTime() - now.getTime();
  return diff > 0 && diff <= REMINDER_WINDOW_HOURS * 3_600_000;
}

// ---- Kopie ---------------------------------------------------------------------------------------------------------

export type CopyableEvent = {
  title: string;
  description: string;
  location: string;
  startsAt: Date;
  endsAt: Date | null;
  capacity: number | null;
  registrationDeadline: Date | null;
  isPublic: boolean;
  membersOnly: boolean;
};

/** Kopie eines Anlasses auf einen neuen Beginn: Dauer und Abstand des Anmeldeschlusses bleiben erhalten; die Kopie ist ein Entwurf. */
export function planCopy(src: CopyableEvent, newStart: Date): CopyableEvent & { status: "ENTWURF" } {
  const shift = (d: Date | null) => (d ? new Date(newStart.getTime() + (d.getTime() - src.startsAt.getTime())) : null);
  return {
    title: src.title,
    description: src.description,
    location: src.location,
    startsAt: newStart,
    endsAt: shift(src.endsAt),
    capacity: src.capacity,
    registrationDeadline: shift(src.registrationDeadline),
    isPublic: src.isPublic,
    membersOnly: src.membersOnly,
    status: "ENTWURF",
  };
}

// ---- Prüfung der Angaben (Neu und Änderung) --------------------------------------------------------------------------------

export type EventConsistencyInput = {
  startsAt: Date;
  endsAt: Date | null;
  registrationDeadline: Date | null;
  isPublic: boolean;
  membersOnly: boolean;
  capacity: number | null;
};

/** Feldfehler für Angaben, die zusammenpassen müssen. Leeres Objekt = in Ordnung. */
export function eventConsistencyErrors(e: EventConsistencyInput): Record<string, string> {
  const errors: Record<string, string> = {};
  if (e.endsAt && e.endsAt.getTime() <= e.startsAt.getTime()) errors.endsAt = "Das Ende muss nach dem Beginn liegen.";
  if (e.registrationDeadline && e.registrationDeadline.getTime() > e.startsAt.getTime()) errors.registrationDeadline = "Der Anmeldeschluss darf nicht nach dem Beginn liegen.";
  if (!e.isPublic && !e.membersOnly) errors.membersOnly = "Gäste können sich nur anmelden, wenn der Anlass öffentlich sichtbar ist.";
  if (e.capacity !== null && (!Number.isInteger(e.capacity) || e.capacity < 1)) errors.capacity = "Die Kapazität muss mindestens 1 sein (oder leer für unbegrenzt).";
  return errors;
}

// ---- Anzeige -------------------------------------------------------------------------------------------------------

export const WEEKDAY_LONG = ["Sonntag", "Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag"] as const;
export const WEEKDAY_SHORT = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"] as const;
export const MONTH_SHORT = ["Jan.", "Feb.", "März", "Apr.", "Mai", "Juni", "Juli", "Aug.", "Sept.", "Okt.", "Nov.", "Dez."] as const;

const pad = (n: number) => String(n).padStart(2, "0");

/** «Donnerstag, 5.11.2026» */
export function formatEventDay(date: Date): string {
  return `${WEEKDAY_LONG[zurichParts(date).weekday]}, ${formatDateCh(date)}`;
}

/** «19:30» (Zürcher Zeit) */
export function formatEventTime(date: Date): string {
  const p = zurichParts(date);
  return `${pad(p.hour)}:${pad(p.minute)}`;
}

/**
 * Zeitangabe eines Anlasses in Zürcher Zeit:
 * «Donnerstag, 5.11.2026, 19:30 – 21:00 Uhr» bzw. über mehrere Tage «5.11.2026, 19:30 Uhr – 6.11.2026, 02:00 Uhr».
 */
export function formatEventWhen(startsAt: Date, endsAt?: Date | null): string {
  if (!endsAt || endsAt.getTime() <= startsAt.getTime()) return `${formatEventDay(startsAt)}, ${formatEventTime(startsAt)} Uhr`;
  const s = zurichParts(startsAt);
  const e = zurichParts(endsAt);
  if (s.year === e.year && s.month === e.month && s.day === e.day) {
    return `${formatEventDay(startsAt)}, ${formatEventTime(startsAt)} – ${formatEventTime(endsAt)} Uhr`;
  }
  return `${formatDateTimeCh(startsAt)} – ${formatDateTimeCh(endsAt)}`;
}

/** Kalenderblatt: Tag, Monatskürzel, Wochentagskürzel (Zürcher Zeit). */
export function calendarBadge(date: Date): { day: string; month: string; weekday: string } {
  const p = zurichParts(date);
  return { day: String(p.day), month: MONTH_SHORT[p.month - 1] ?? "", weekday: WEEKDAY_SHORT[p.weekday] ?? "" };
}

/** Markdown als schlichter Text (für Kalender, Vorschau und schema.org). Kein HTML, keine Links. */
export function stripMarkdown(md: string, max = 300): string {
  const text = md
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`([^`]*)`/g, "$1")
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/<[^>]*>/g, " ")
    .replace(/^\s{0,3}#{1,6}\s+/gm, "")
    .replace(/^\s{0,3}>\s?/gm, "")
    .replace(/^\s*[-*+]\s+/gm, "")
    .replace(/^\s*\d+\.\s+/gm, "")
    .replace(/(\*\*|__|\*|_|~~)/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (text.length <= max) return text;
  const cut = text.slice(0, max - 1);
  const space = cut.lastIndexOf(" ");
  return `${(space > max * 0.6 ? cut.slice(0, space) : cut).trimEnd()}…`;
}

// ---- Kalender (ICS) ------------------------------------------------------------------------------------------------

export type CalendarEvent = {
  id: string;
  title: string;
  description: string;
  location: string;
  startsAt: Date;
  endsAt: Date | null;
  status: string;
  updatedAt: Date;
  sequence: number;
};

/** Anlass → Kalendereintrag. Die UID ist die Anlass-ID (stabil über Änderungen), die SEQUENCE steigt bei Änderungen. */
export function eventToIcs(e: CalendarEvent, url?: string): IcsEvent {
  return {
    uid: `anlass-${e.id}`,
    title: e.title,
    description: stripMarkdown(e.description, 1000) || undefined,
    location: e.location || undefined,
    start: e.startsAt,
    end: e.endsAt,
    url,
    cancelled: e.status === "ABGESAGT",
    updatedAt: e.updatedAt,
    sequence: e.sequence,
  };
}

// ---- schema.org ----------------------------------------------------------------------------------------------------

/** ISO-8601 mit Zürcher Offset, z. B. «2026-11-05T19:30:00+01:00». */
export function isoZurich(date: Date): string {
  const p = zurichParts(date);
  const off = zurichOffsetMinutes(date);
  const sign = off < 0 ? "-" : "+";
  const abs = Math.abs(off);
  return `${p.year}-${pad(p.month)}-${pad(p.day)}T${pad(p.hour)}:${pad(p.minute)}:${pad(p.second)}${sign}${pad(Math.floor(abs / 60))}:${pad(abs % 60)}`;
}

/** schema.org/Event. Preise werden nicht angegeben (nicht erfinden). */
export function eventJsonLd(e: CalendarEvent & { capacity: number | null }, opts: { url: string; organizerName: string; organizerUrl: string }): Record<string, unknown> {
  const ld: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Event",
    name: e.title,
    startDate: isoZurich(e.startsAt),
    eventStatus: e.status === "ABGESAGT" ? "https://schema.org/EventCancelled" : "https://schema.org/EventScheduled",
    url: opts.url,
    organizer: { "@type": "Organization", name: opts.organizerName, url: opts.organizerUrl },
  };
  if (e.endsAt && e.endsAt.getTime() > e.startsAt.getTime()) ld.endDate = isoZurich(e.endsAt);
  const description = stripMarkdown(e.description, 500);
  if (description) ld.description = description;
  if (e.location.trim()) {
    ld.eventAttendanceMode = "https://schema.org/OfflineEventAttendanceMode";
    ld.location = { "@type": "Place", name: e.location.trim(), address: e.location.trim() };
  }
  if (e.capacity !== null) ld.maximumAttendeeCapacity = e.capacity;
  return ld;
}

/** JSON für ein <script type="application/ld+json">: «<» wird maskiert, damit nichts den Skriptblock beenden kann. */
export function jsonLdString(data: unknown): string {
  return JSON.stringify(data).replace(/</g, "\\u003c").replace(/\u2028/g, "\\u2028").replace(/\u2029/g, "\\u2029");
}

// ---- Teilnehmerliste (CSV) -----------------------------------------------------------------------------------------

export const REGISTRATION_CSV_HEADERS = ["Name", "Art", "Mitgliedernr.", "E-Mail", "Personen", "Status", "Anwesend", "Angemeldet am", "Bemerkung"] as const;

export type RegistrationCsvRow = {
  name: string;
  isMember: boolean;
  memberNumber: number | null;
  email: string;
  seats: number;
  statusLabel: string;
  attended: boolean;
  createdAt: Date;
  note: string;
};

/** Zeilen für csvResponse: Texte werden dort gegen Formel-Injektion neutralisiert. */
export function registrationCsvRows(rows: readonly RegistrationCsvRow[]): CsvCell[][] {
  return rows.map((r) => [r.name, r.isMember ? "Mitglied" : "Gast", r.memberNumber, r.email, r.seats, r.statusLabel, r.attended, r.createdAt, r.note]);
}

// ---- Namen ---------------------------------------------------------------------------------------------------------

type NamedRegistration = { guestName: string; member: { firstName: string; lastName: string; anonymizedAt?: Date | null } | null };

/** Anzeigename einer Anmeldung: Mitgliedsname oder Gastname. */
export function registrantName(r: NamedRegistration): string {
  if (r.member) return r.member.anonymizedAt ? "Anonymisiertes Mitglied" : `${r.member.firstName} ${r.member.lastName}`.trim();
  return r.guestName.trim() || "Gast";
}
