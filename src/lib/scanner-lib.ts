// Scanner-Schnittstelle v1 (Türkontrolle mit der Android-App «Vylaris Scanner»): reine Teile ohne Datenbank und ohne Seiteneffekte.
// Eingabeprüfung (Zod), Grenzen, Aufbereitung der Antworten und Suchbegriff. Datenbankzugriff: scanner-data.ts, Anmeldung: scanner.ts.
// Beschreibung der Schnittstelle: docs/verein-scanner.md.
import type { Prisma } from "@prisma/client";
import { z } from "zod";
import { containsCI } from "@/lib/search";
import { officeTitle } from "@/lib/verein/members-lib";
import { toDateOnly } from "@/lib/verein/dates";
import type { CardInspectMember } from "@/lib/verein/membership-card-data";

// ---- Grenzen ------------------------------------------------------------------------------------------------------

/** Rate-Limits laut Vertrag (Anfragen je Zeitfenster). */
export const SCANNER_LIMITS = {
  ip: { limit: 120, windowMs: 60_000 },
  /** Ungültige Tokens je IP */
  badToken: { limit: 20, windowMs: 10 * 60_000 },
  device: { limit: 600, windowMs: 60_000 },
  /** Zusätzlich für /scan und /members je Gerät */
  deviceHeavy: { limit: 300, windowMs: 60_000 },
} as const;

/** `lastUsedAt` eines Geräts wird höchstens so oft nachgeführt. */
export const LAST_USED_INTERVAL_MS = 60_000;

export const EVENT_LIST_MAX = 20;
export const MEMBER_SEARCH_MAX = 20;
export const BODY_MAX_BYTES = 4096;

const HOUR = 3_600_000;
/** Anlässe ab hier gehören zur Tür: Beginn höchstens 14 Tage in der Zukunft. */
export const EVENT_AHEAD_MS = 14 * 24 * HOUR;
/** … und das Ende (oder Beginn + 6 Stunden, wenn kein Ende erfasst ist) liegt noch nicht länger als 6 Stunden zurück. */
export const EVENT_GRACE_MS = 6 * HOUR;
export const EVENT_DEFAULT_DURATION_MS = 6 * HOUR;

/** Filter der Anlässe für `GET /events`: veröffentlicht, im Zeitfenster der Tür. */
export function eventWindowWhere(now: Date): Prisma.EventWhereInput {
  const t = now.getTime();
  return {
    status: "VEROEFFENTLICHT",
    startsAt: { lte: new Date(t + EVENT_AHEAD_MS) },
    OR: [
      { endsAt: { gte: new Date(t - EVENT_GRACE_MS) } },
      // Ohne Ende gilt Beginn + 6 h: Beginn + 6 h >= jetzt - 6 h  <=>  Beginn >= jetzt - 12 h
      { endsAt: null, startsAt: { gte: new Date(t - EVENT_GRACE_MS - EVENT_DEFAULT_DURATION_MS) } },
    ],
  };
}

// ---- Eingaben -----------------------------------------------------------------------------------------------------

const idSchema = z.string().min(1).max(100);

export const scanBodySchema = z.object({
  token: z.string().min(1).max(200),
  eventId: idSchema.nullish(),
  checkIn: z.boolean().nullish(),
});
export type ScanBody = z.infer<typeof scanBodySchema>;

export const attendanceBodySchema = z.object({ memberId: idSchema, attended: z.boolean() });

export const membersQuerySchema = z.object({
  q: z.string().trim().min(2, "Der Suchbegriff muss mindestens 2 Zeichen lang sein.").max(100, "Der Suchbegriff ist zu lang."),
  eventId: idSchema.nullish(),
});

// ---- Suche ----------------------------------------------------------------------------------------------------------

export type MemberQuery = { kind: "number"; number: number | null } | { kind: "name"; words: string[] };

/** Grösste Mitgliedernummer (Int der Datenbank). */
const MAX_INT = 2_147_483_647;

/** Nur Ziffern = Mitgliedernummer (genau), sonst Wörter für die Suche im Vor- oder Nachnamen. `number: null`: Zahl ausserhalb des Bereichs, kein Treffer möglich. */
export function parseMemberQuery(q: string): MemberQuery {
  const t = q.trim();
  if (/^[0-9]+$/.test(t)) {
    const n = t.length <= 10 ? Number(t) : Number.NaN;
    return { kind: "number", number: Number.isSafeInteger(n) && n <= MAX_INT ? n : null };
  }
  return { kind: "name", words: t.split(/\s+/).filter(Boolean).slice(0, 5) };
}

/** Zeichen, die in einem LIKE-Muster etwas bedeuten (Prisma `contains` maskiert sie nicht): %, _ und der Backslash. */
const LIKE_SPECIAL = /[%_\\]/;
const LIKE_SPLIT = /[%_\\]+/;

/** Hat die Suche Wörter mit %, _ oder Backslash? Dann reicht der Datenbankfilter nicht, die Treffer werden zusätzlich genau geprüft (matchesMemberQuery). */
export const needsExactFilter = (query: MemberQuery): boolean => query.kind === "name" && query.words.some((w) => LIKE_SPECIAL.test(w));

/**
 * Filter für die manuelle Suche: nie anonymisierte Mitglieder, nie ANTRAG/ABGELEHNT. Namen: jedes Wort muss im Vor- oder Nachnamen vorkommen
 * (ohne Gross-/Kleinschreibung, in SQLite und PostgreSQL über containsCI, nicht über providerspezifische Optionen).
 * Weil `contains` die Zeichen %, _ und \ als Muster liest, werden Wörter damit an diesen Zeichen zerlegt: Die Datenbank prüft nur die Teile ohne
 * Sonderzeichen (grobe Vorauswahl), den genauen Treffer entscheidet matchesMemberQuery. So wird kein Suchbegriff je zum Muster.
 */
export function memberSearchWhere(query: MemberQuery): Prisma.MemberWhereInput {
  const base: Prisma.MemberWhereInput = { anonymizedAt: null, status: { notIn: ["ANTRAG", "ABGELEHNT"] } };
  if (query.kind === "number") return { ...base, memberNumber: query.number ?? -1 };
  const and: Prisma.MemberWhereInput[] = [];
  for (const word of query.words) {
    const parts = word.split(LIKE_SPLIT).filter(Boolean);
    if (parts.length === 0) continue;
    and.push({ OR: [{ AND: parts.map((p) => ({ firstName: containsCI(p) })) }, { AND: parts.map((p) => ({ lastName: containsCI(p) })) }] });
  }
  return { ...base, ...(and.length > 0 ? { AND: and } : {}) };
}

/** Genaue Prüfung (ohne Gross-/Kleinschreibung, Sonderzeichen wörtlich): jedes Wort kommt im Vor- oder Nachnamen vor. */
export function matchesMemberQuery(m: { firstName: string; lastName: string }, query: MemberQuery): boolean {
  if (query.kind !== "name") return true;
  const first = m.firstName.toLocaleLowerCase("de-CH");
  const last = m.lastName.toLocaleLowerCase("de-CH");
  return query.words.every((w) => {
    const x = w.toLocaleLowerCase("de-CH");
    return first.includes(x) || last.includes(x);
  });
}

// ---- Antworten -------------------------------------------------------------------------------------------------------

export type ScannerMember = {
  id: string;
  memberNumber: number;
  firstName: string;
  lastName: string;
  status: string;
  membershipType: string | null;
  joinedAt: string | null;
  validUntil: string | null;
  offices: string[];
};

/** Reines Datum als «JJJJ-MM-TT» (der Kalendertag in Zürcher Zeit; die Website speichert Mittag UTC). */
export const isoDay = (d: Date): string => toDateOnly(d).toISOString().slice(0, 10);

export function toScannerMember(m: CardInspectMember): ScannerMember {
  return {
    id: m.id,
    memberNumber: m.memberNumber,
    firstName: m.firstName,
    lastName: m.lastName,
    status: m.status,
    membershipType: m.membershipTypeName,
    joinedAt: m.joinedAt ? isoDay(m.joinedAt) : null,
    validUntil: m.leftAt ? isoDay(m.leftAt) : null,
    offices: m.offices.map(officeTitle),
  };
}

export type TicketState = "valid" | "none" | "waitlist" | "cancelled" | "unconfirmed";

/** Ticket = Anmeldung des Mitglieds: ANGEMELDET gilt, alles andere nicht. */
export function ticketOf(status: string | null | undefined): TicketState {
  switch (status) {
    case "ANGEMELDET":
      return "valid";
    case "WARTELISTE":
      return "waitlist";
    case "UNBESTAETIGT":
      return "unconfirmed";
    case "ABGESAGT":
      return "cancelled";
    default:
      return "none";
  }
}

export type RegistrationRow = { id: string; status: string; seats: number; note: string; attendedAt: Date | null };

export type ScannerRegistration = { id: string; status: string; seats: number; note: string; attendedAt: string | null };

export const toScannerRegistration = (r: RegistrationRow): ScannerRegistration => ({
  id: r.id,
  status: r.status,
  seats: r.seats,
  note: r.note,
  attendedAt: r.attendedAt ? r.attendedAt.toISOString() : null,
});

export type ScannerEventCheck = {
  id: string;
  title: string;
  ticket: TicketState;
  registration: ScannerRegistration | null;
  checkIn: { performed: boolean; alreadyAt: string | null };
};

/**
 * Ticket-Zustand eines Mitglieds bei einem Anlass. `performed`: dieser Aufruf hat eingecheckt.
 * `alreadyAt`: Zeitpunkt, wenn die Person schon vorher eingecheckt war (nur bei gültigem Ticket und angefragtem Check-in, dann `performed: false`).
 */
export function toEventCheck(
  event: { id: string; title: string },
  registration: RegistrationRow | null,
  opts: { performed?: boolean; checkInRequested?: boolean } = {},
): ScannerEventCheck {
  const ticket = ticketOf(registration?.status);
  const performed = opts.performed === true;
  const alreadyAt = !performed && opts.checkInRequested === true && ticket === "valid" && registration?.attendedAt ? registration.attendedAt.toISOString() : null;
  return { id: event.id, title: event.title, ticket, registration: registration ? toScannerRegistration(registration) : null, checkIn: { performed, alreadyAt } };
}
