// Persönlicher Antwort-Link für die Rückmeldung zu einer Versammlung (Teilnahme / Entschuldigung), auch für Mitglieder ohne Website-Konto.
// Das Token ist eine Signatur (HMAC-SHA256) über Sitzung und Mitglied; es wird nicht gespeichert und enthält keine Personendaten.
// Es gilt nur für diese eine Sitzung und diese eine Person und erlaubt nichts anderes als die Rückmeldung.
// Rein (kein Zugriff auf Umgebung oder Datenbank): das Geheimnis wird übergeben, damit die Funktionen testbar bleiben.
import { createHmac, timingSafeEqual } from "node:crypto";

const ID = /^[A-Za-z0-9_-]{1,40}$/;

function sign(secret: string, meetingId: string, memberId: string): string {
  return createHmac("sha256", secret).update(`rsvp\u0000${meetingId}\u0000${memberId}`).digest("base64url");
}

/** Token «<Sitzung>.<Mitglied>.<Signatur>» (nur Zeichen aus A–Z, a–z, 0–9, _ - und Punkt). */
export function signRsvpToken(secret: string, meetingId: string, memberId: string): string {
  if (!ID.test(meetingId) || !ID.test(memberId)) throw new RangeError("Ungültige ID.");
  return `${meetingId}.${memberId}.${sign(secret, meetingId, memberId)}`;
}

/** Prüft ein Token; liefert Sitzung und Mitglied oder null (falsch aufgebaut, falsche Signatur). */
export function verifyRsvpToken(secret: string, token: string): { meetingId: string; memberId: string } | null {
  if (typeof token !== "string" || token.length > 200) return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [meetingId, memberId, sig] = parts as [string, string, string];
  if (!ID.test(meetingId) || !ID.test(memberId) || !/^[A-Za-z0-9_-]{43}$/.test(sig)) return null;
  const expected = Buffer.from(sign(secret, meetingId, memberId));
  const given = Buffer.from(sig);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
  return { meetingId, memberId };
}
