// Digitaler Mitgliederausweis: signierter Prüf-Link und Darstellung der Gültigkeit. Reine Funktionen (Tests: scripts/test/overview.test.mts).
//
// Der QR-Code des Ausweises enthält nur eine Adresse /verein/pruefen/<Token>. Das Token ist «<Mitglieds-ID>.<Signatur>»
// (HMAC-SHA256); es enthält keine Personendaten und wird nicht gespeichert. Die Prüfseite schlägt das Mitglied nach und zeigt
// nur: «Gültiges Mitglied: Vorname N., Nr. 12». Wer nicht (mehr) aktives Mitglied ist, bekommt «nicht gültig» ohne Namen.
// Das Geheimnis wird übergeben (Server: membership-card-data.ts), damit die Funktionen ohne Umgebung testbar bleiben.
import { createHmac, timingSafeEqual } from "node:crypto";
import QRCode from "qrcode";
import { formatDateCh } from "./dates";

const ID = /^[A-Za-z0-9_-]{1,40}$/;
const SIG = /^[A-Za-z0-9_-]{43}$/;

function sign(secret: string, memberId: string, version: number): string {
  // Version 0 signiert wie bisher (ausgegebene Ausweise bleiben gültig), höhere Versionen fliessen in die Signatur ein.
  const payload = version === 0 ? `ausweis\u0000${memberId}` : `ausweis\u0000${memberId}\u0000v${version}`;
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

/**
 * Token für den Prüf-Link des Ausweises: «<Mitglieds-ID>.<Signatur>» (Version 0) bzw. «<Mitglieds-ID>.<Version>.<Signatur>».
 * «Ausweis neu ausstellen» erhöht Member.cardVersion; Tokens früherer Versionen sind dann nicht mehr gültig.
 */
export function signCardToken(secret: string, memberId: string, version = 0): string {
  if (!ID.test(memberId)) throw new RangeError("Ungültige ID.");
  if (!Number.isInteger(version) || version < 0 || version > 1_000_000) throw new RangeError("Ungültige Version.");
  return version === 0 ? `${memberId}.${sign(secret, memberId, 0)}` : `${memberId}.${version}.${sign(secret, memberId, version)}`;
}

/** Prüft ein Token; liefert Mitglieds-ID und Version oder null (falsch aufgebaut, falsche Signatur). Ob die Version aktuell ist, prüft der Aufrufer. */
export function verifyCardToken(secret: string, token: string): { memberId: string; version: number } | null {
  if (typeof token !== "string" || token.length > 140) return null;
  const parts = token.split(".");
  if (parts.length !== 2 && parts.length !== 3) return null;
  const memberId = parts[0]!;
  const sig = parts[parts.length - 1]!;
  let version = 0;
  if (parts.length === 3) {
    if (!/^[1-9][0-9]{0,6}$/.test(parts[1]!)) return null;
    version = Number(parts[1]);
  }
  if (!ID.test(memberId) || !SIG.test(sig)) return null;
  const expected = Buffer.from(sign(secret, memberId, version));
  const given = Buffer.from(sig);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
  return { memberId, version };
}

/** «Anna M.»: Vorname und Initiale des Nachnamens, mehr zeigt die öffentliche Prüfseite nie. */
export function shortDisplayName(firstName: string, lastName: string): string {
  const first = firstName.trim();
  const initial = Array.from(lastName.trim())[0];
  return [first, initial ? `${initial.toLocaleUpperCase("de-CH")}.` : ""].filter(Boolean).join(" ");
}

export type CardMember = { status: string; joinedAt: Date | null; leftAt: Date | null; exitNoticeAt: Date | null; anonymizedAt: Date | null };

export type CardValidity = {
  valid: boolean;
  /** Kurzer Text für die Karte, z. B. «Gültig, solange die Mitgliedschaft besteht» */
  text: string;
};

/**
 * Gültigkeit des Ausweises. Gültig ist nur, wer aktives Mitglied ist (Status AKTIV) und nicht anonymisiert wurde.
 * Ist ein Austritt vorgemerkt, steht der Austrittstag auf der Karte. Es werden keine Fristen erfunden.
 */
export function cardValidity(m: CardMember, now: Date = new Date()): CardValidity {
  if (m.anonymizedAt || m.status !== "AKTIV") return { valid: false, text: "Nicht gültig" };
  if (m.leftAt && m.exitNoticeAt) {
    return m.leftAt.getTime() < now.getTime() && formatDateCh(m.leftAt) !== formatDateCh(now)
      ? { valid: false, text: "Nicht gültig" }
      : { valid: true, text: `Gültig bis ${formatDateCh(m.leftAt)}` };
  }
  return { valid: true, text: "Gültig, solange die Mitgliedschaft besteht" };
}

/** Text unter dem Namen: «Mitglied seit 5.11.2026» oder leer, wenn kein Eintrittsdatum erfasst ist. */
export const memberSinceText = (joinedAt: Date | null): string => (joinedAt ? `Mitglied seit ${formatDateCh(joinedAt)}` : "");

/** Ruhezone des QR-Codes in Modulen (Norm: mindestens 4, damit Scanner den Code zuverlässig finden). */
export const QR_QUIET_MODULES = 4;

/** viewBox für den QR-Code samt Ruhezone: «-4 -4 N+8 N+8» (der Code selbst liegt in 0 … N, die weisse Kachel füllt die ganze viewBox). */
export function qrViewBox(modules: number): string {
  const side = modules + 2 * QR_QUIET_MODULES;
  return `${-QR_QUIET_MODULES} ${-QR_QUIET_MODULES} ${side} ${side}`;
}

/** Kantenlänge des eigentlichen QR-Codes (ohne Ruhezone) in Millimetern, wenn die weisse Kachel `tileMm` breit ist. */
export const qrEdgeMm = (modules: number, tileMm: number): number => (tileMm * modules) / (modules + 2 * QR_QUIET_MODULES);

export type QrShape = {
  /** Anzahl Module je Seite */
  modules: number;
  /** SVG-Pfad aller dunklen Module in Moduleinheiten (viewBox 0 0 modules modules) */
  pathD: string;
};

/**
 * QR-Code als Vektorpfad (Fehlerkorrektur M). Die Darstellung rendert React als SVG-Element: kein HTML-Text aus fremder Quelle.
 * Wirft, wenn der Inhalt nicht in einen QR-Code passt.
 */
export function qrShape(content: string): QrShape {
  const qr = QRCode.create(content, { errorCorrectionLevel: "M" });
  const size = qr.modules.size;
  const data = qr.modules.data;
  let d = "";
  for (let y = 0; y < size; y++) {
    let x = 0;
    while (x < size) {
      if (!data[y * size + x]) {
        x++;
        continue;
      }
      let run = 1;
      while (x + run < size && data[y * size + x + run]) run++;
      d += `M${x} ${y}h${run}v1h-${run}z`;
      x += run;
    }
  }
  return { modules: size, pathD: d };
}
