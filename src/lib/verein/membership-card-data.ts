// Mitgliederausweis: Token mit dem Geheimnis der Installation signieren und die öffentliche Prüfung auflösen. Reine Teile: ./membership-card.ts.
import "server-only";
import { createHash } from "node:crypto";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { authSecretString } from "@/lib/session";
import { publicUrl } from "./links";
import { todayZurich } from "./dates";
import { officeState } from "./members-lib";
import { cardValidity, shortDisplayName, signCardToken, verifyCardToken } from "./membership-card";
import { getVereinName } from "./profile";

/** Eigenes Geheimnis für die Ausweise, aus AUTH_SECRET abgeleitet (ein anderes Token der Seite lässt sich damit nie fälschen). */
const cardSecret = (): string => createHash("sha256").update(`vgs-ausweis-v1:${authSecretString()}`).digest("hex");

export const cardToken = (memberId: string, version = 0): string => signCardToken(cardSecret(), memberId, version);

/** Adresse der Prüfseite für den QR-Code: feste Basis-URL, nie aus dem Host-Header. */
export const cardVerifyUrl = (memberId: string, version = 0): string => publicUrl(`/verein/pruefen/${encodeURIComponent(cardToken(memberId, version))}`);

export type CardCheck = { valid: false } | { valid: true; shortName: string; memberNumber: number; clubName: string };

/**
 * Prüft ein Token aus dem QR-Code. Gültig sind nur aktuelle Mitglieder (Status AKTIV, nicht anonymisiert, Austritt nicht überschritten).
 * Bei «nicht gültig» wird nichts über die Person verraten (kein Name, kein Grund).
 */
export async function checkCardToken(token: string, now: Date = new Date()): Promise<CardCheck> {
  const parsed = verifyCardToken(cardSecret(), token);
  if (!parsed) return { valid: false };
  const m = await db.member.findUnique({
    where: { id: parsed.memberId },
    select: { firstName: true, lastName: true, memberNumber: true, status: true, joinedAt: true, leftAt: true, exitNoticeAt: true, anonymizedAt: true, cardVersion: true },
  });
  // Ein neu ausgestellter Ausweis (höhere Version) entwertet ältere QR-Codes.
  if (!m || m.cardVersion !== parsed.version || !cardValidity(m, now).valid) return { valid: false };
  return { valid: true, shortName: shortDisplayName(m.firstName, m.lastName), memberNumber: m.memberNumber, clubName: await getVereinName() };
}

export type CardInspectReason = "malformed" | "unknown" | "outdated" | "inactive";

/** Angaben zum Mitglied für berechtigte Geräte (Türkontrolle). Rohwerte: Aufbereitung für die Schnittstelle in src/lib/scanner-lib.ts. */
export type CardInspectMember = {
  id: string;
  memberNumber: number;
  firstName: string;
  lastName: string;
  status: string;
  membershipTypeName: string | null;
  joinedAt: Date | null;
  leftAt: Date | null;
  /** Vorgemerkter Austritt (Datum der Kündigung); zusammen mit `leftAt` und Status AKTIV gibt es ein Ende der Mitgliedschaft. */
  exitNoticeAt: Date | null;
  /** Aktuelle Ämter: Beginn heute oder früher, Ende leer oder heute oder später (Kalendertag Zürich, Regel officeState) */
  offices: Array<{ kind: string; title: string }>;
};

export type CardInspection =
  | { valid: true; reason: null; member: CardInspectMember }
  /** Bei «inactive» ist `member` gesetzt, ausser die Personendaten wurden entfernt (dann null). */
  | { valid: false; reason: "inactive"; member: CardInspectMember | null }
  | { valid: false; reason: "malformed" | "unknown" | "outdated"; member: null };

/** Felder für die Türkontrolle (Ausweisprüfung und Suche): Gültigkeit, Anzeige und Ämter (die aktuellen filtert toInspectMember). */
export const CARD_MEMBER_SELECT = {
  id: true,
  memberNumber: true,
  firstName: true,
  lastName: true,
  status: true,
  joinedAt: true,
  leftAt: true,
  exitNoticeAt: true,
  anonymizedAt: true,
  cardVersion: true,
  membershipType: { select: { name: true } },
  offices: { orderBy: [{ validFrom: "asc" }, { id: "asc" }], select: { kind: true, title: true, validFrom: true, validUntil: true } },
} as const satisfies Prisma.MemberSelect;

export type CardMemberRow = Prisma.MemberGetPayload<{ select: typeof CARD_MEMBER_SELECT }>;

/** Aktuelle Ämter nach der Regel der Verwaltung (officeState, Kalendertag Zürich), in der Reihenfolge der Abfrage. */
export const currentOffices = (offices: CardMemberRow["offices"], now: Date = new Date()): Array<{ kind: string; title: string }> => {
  const today = todayZurich(now);
  return offices.filter((o) => officeState(o, today) === "LAUFEND").map(({ kind, title }) => ({ kind, title }));
};

export const toInspectMember = (m: CardMemberRow, now: Date = new Date()): CardInspectMember => ({
  id: m.id,
  memberNumber: m.memberNumber,
  firstName: m.firstName,
  lastName: m.lastName,
  status: m.status,
  membershipTypeName: m.membershipType?.name ?? null,
  joinedAt: m.joinedAt,
  leftAt: m.leftAt,
  exitNoticeAt: m.exitNoticeAt,
  offices: currentOffices(m.offices, now),
});

/**
 * Wie checkCardToken, aber für berechtigte Geräte: liefert den genauen Grund (falsch aufgebaut oder gefälscht, Mitglied unbekannt,
 * Ausweis neu ausgestellt, Mitgliedschaft nicht aktiv) und die Mitgliedsdaten bei gültigem oder inaktivem Ausweis.
 * Nie für die öffentliche Prüfseite verwenden (dort gilt: kein Grund, kein Name).
 */
export async function inspectCardToken(token: string, now: Date = new Date()): Promise<CardInspection> {
  const parsed = verifyCardToken(cardSecret(), token);
  if (!parsed) return { valid: false, reason: "malformed", member: null };
  const m = await db.member.findUnique({ where: { id: parsed.memberId }, select: CARD_MEMBER_SELECT });
  if (!m) return { valid: false, reason: "unknown", member: null };
  if (m.cardVersion !== parsed.version) return { valid: false, reason: "outdated", member: null };
  if (!cardValidity(m, now).valid) return { valid: false, reason: "inactive", member: m.anonymizedAt ? null : toInspectMember(m, now) };
  return { valid: true, reason: null, member: toInspectMember(m, now) };
}
