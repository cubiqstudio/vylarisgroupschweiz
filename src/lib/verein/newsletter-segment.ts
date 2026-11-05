// Newsletter-Segmente: Empfängerkreis einer Kampagne («alle Abonnenten», «aktive Mitglieder», «Mitglieder einer Mitgliedschaftsart»).
// Reine Funktionen (Tests: scripts/test/overview.test.mts); Datenzugriff: ./newsletter-segment-data.ts.
//
// Abgleich: Ein Abonnent gehört zum Segment, wenn seine (bestätigte, aktive) Newsletter-Adresse mit der E-Mail-Adresse eines aktiven
// Mitglieds übereinstimmt (ohne Beachtung der Gross-/Kleinschreibung). Wer sich nie angemeldet hat, bekommt nie einen Newsletter,
// und wer sich abmeldet, ist sofort aus jedem Segment draussen: Das Double-Opt-In bleibt Pflicht.
import { NEWSLETTER_SEGMENT_LABEL, NEWSLETTER_SEGMENTS, type NewsletterSegment } from "./constants";

export type SegmentSelection = { segment: NewsletterSegment; segmentTypeId: string | null };

export const isNewsletterSegment = (value: string): value is NewsletterSegment => (NEWSLETTER_SEGMENTS as readonly string[]).includes(value);

/**
 * Bereinigt die Auswahl: unbekannte Werte werden «alle Abonnenten», die Mitgliedschaftsart gilt nur beim Segment
 * «Mitgliedschaftsart». Fehlt dort die Art, ist die Auswahl unvollständig (error).
 */
export function normalizeSegment(segment: string | null | undefined, segmentTypeId: string | null | undefined): SegmentSelection & { error?: string } {
  const s: NewsletterSegment = segment && isNewsletterSegment(segment) ? segment : "ALL";
  if (s === "MEMBERSHIP_TYPE") {
    const id = (segmentTypeId ?? "").trim();
    if (!id) return { segment: s, segmentTypeId: null, error: "Bitte eine Mitgliedschaftsart wählen." };
    return { segment: s, segmentTypeId: id };
  }
  return { segment: s, segmentTypeId: null };
}

/** Bezeichnung für Listen und Hinweise, z. B. «Mitglieder: Aktivmitglied». */
export function segmentLabel(segment: string, typeName?: string | null): string {
  if (segment === "MEMBERSHIP_TYPE") return typeName ? `Mitglieder: ${typeName}` : NEWSLETTER_SEGMENT_LABEL.MEMBERSHIP_TYPE;
  return isNewsletterSegment(segment) ? NEWSLETTER_SEGMENT_LABEL[segment] : NEWSLETTER_SEGMENT_LABEL.ALL;
}

/** E-Mail-Adresse für den Vergleich: getrimmt und kleingeschrieben. */
export const comparableEmail = (email: string): string => email.trim().toLowerCase();

/** Abonnenten, deren Adresse zu einer der Mitglieder-Adressen passt. Reihenfolge und Elemente der Abonnentenliste bleiben erhalten. */
export function matchSubscribersToMembers<T extends { email: string }>(subscribers: readonly T[], memberEmails: Iterable<string>): T[] {
  const set = new Set<string>();
  for (const e of memberEmails) {
    const c = comparableEmail(e);
    if (c) set.add(c);
  }
  return subscribers.filter((s) => set.has(comparableEmail(s.email)));
}

/** Teilt eine Liste in Stücke (für Abfragen mit vielen Parametern). */
export function chunk<T>(items: readonly T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}
