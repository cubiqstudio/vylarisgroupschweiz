// Empfängerauswahl der Newsletter-Segmente (Datenbank). Regeln und Abgleich: ./newsletter-segment.ts.
import "server-only";
import { ApiError } from "@/lib/api";
import { db } from "@/lib/db";
import { chunk, comparableEmail, matchSubscribersToMembers, normalizeSegment, type SegmentSelection } from "./newsletter-segment";

const IN_CHUNK = 500;

/** Wo-Bedingung der aktiven Abonnenten (bestätigt, nicht abgemeldet). */
const ACTIVE = { status: "ACTIVE" } as const;

/**
 * IDs der Abonnenten, die eine Kampagne mit diesem Segment erhalten. Immer nur aktive (bestätigte) Abonnenten; bei Segmenten mit
 * Mitgliedern zusätzlich nur solche, deren Adresse zu einem aktiven Mitglied (ggf. der gewählten Mitgliedschaftsart) passt.
 */
export async function segmentSubscriberIds(sel: SegmentSelection): Promise<string[]> {
  if (sel.segment === "ALL") {
    const rows = await db.newsletterSubscriber.findMany({ where: ACTIVE, select: { id: true } });
    return rows.map((r) => r.id);
  }
  // Segment «Mitgliedschaftsart» ohne Art (z. B. nach dem Löschen der Art): niemand, nie stillschweigend alle Mitglieder.
  if (sel.segment === "MEMBERSHIP_TYPE" && !sel.segmentTypeId) return [];
  const members = await db.member.findMany({
    where: {
      status: "AKTIV",
      anonymizedAt: null,
      email: { not: "" },
      ...(sel.segment === "MEMBERSHIP_TYPE" && sel.segmentTypeId ? { membershipTypeId: sel.segmentTypeId } : {}),
    },
    select: { email: true },
  });
  const emails = [...new Set(members.map((m) => comparableEmail(m.email)).filter(Boolean))];
  if (emails.length === 0) return [];
  // Abonnenten-Adressen sind kleingeschrieben gespeichert (Anmeldung); Mitglieder-Adressen werden hier angeglichen.
  const found: Array<{ id: string; email: string }> = [];
  for (const part of chunk(emails, IN_CHUNK)) {
    found.push(...(await db.newsletterSubscriber.findMany({ where: { ...ACTIVE, email: { in: part } }, select: { id: true, email: true } })));
  }
  return matchSubscribersToMembers(found, emails).map((r) => r.id);
}

/** Anzahl der Empfänger für die Vorschau im Kampagnen-Editor. */
export async function segmentRecipientCount(sel: SegmentSelection): Promise<number> {
  if (sel.segment === "ALL") return db.newsletterSubscriber.count({ where: ACTIVE });
  return (await segmentSubscriberIds(sel)).length;
}

/** Mitgliedschaftsarten für die Auswahl im Editor. */
export function listSegmentTypes() {
  return db.membershipType.findMany({ where: { active: true }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }], select: { id: true, name: true } });
}

/**
 * Prüft eine Segment-Eingabe der Kampagne: bereinigt sie und stellt sicher, dass die gewählte Mitgliedschaftsart existiert.
 * Wirft 422 mit Feldmeldung, wenn die Angabe unvollständig oder ungültig ist.
 */
export async function resolveSegmentInput(segment: string | undefined, segmentTypeId: string | null | undefined): Promise<SegmentSelection> {
  const sel = normalizeSegment(segment, segmentTypeId);
  if (sel.error) throw new ApiError(422, "VALIDATION_ERROR", "Ungültige Eingabe.", { segmentTypeId: sel.error });
  if (sel.segment === "MEMBERSHIP_TYPE" && sel.segmentTypeId) {
    const type = await db.membershipType.findUnique({ where: { id: sel.segmentTypeId }, select: { id: true } });
    if (!type) throw new ApiError(422, "VALIDATION_ERROR", "Ungültige Eingabe.", { segmentTypeId: "Diese Mitgliedschaftsart gibt es nicht." });
  }
  return { segment: sel.segment, segmentTypeId: sel.segmentTypeId };
}
