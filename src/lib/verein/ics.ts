// Kalenderdateien (iCalendar, RFC 5545) für Anlässe und Versammlungen. Reine Funktionen.
// Zeiten werden in UTC ausgegeben (kein VTIMEZONE nötig); Texte werden escaped, Zeilen auf 75 Oktette gefaltet, Zeilenenden sind CRLF.
import { safeDownloadName } from "./csv";

export type IcsEvent = {
  /** Stabile Kennung, z. B. die Datenbank-ID (wird zu «<id>@<domain>») */
  uid: string;
  title: string;
  description?: string;
  location?: string;
  start: Date;
  /** Ende; fehlt es, wird kein DTEND ausgegeben */
  end?: Date | null;
  /** Link zur Seite des Anlasses */
  url?: string;
  cancelled?: boolean;
  /** Zeitpunkt der letzten Änderung (DTSTAMP und LAST-MODIFIED); Standard: jetzt */
  updatedAt?: Date;
  /** Versionszähler, steigt bei Änderungen (Standard 0) */
  sequence?: number;
};

export const ICS_PRODID = "-//VylarisGroup//Vereinsverwaltung//DE";

/** Text für iCalendar: Backslash, Semikolon, Komma und Zeilenumbrüche escapen, Steuerzeichen entfernen. */
export function escapeIcsText(s: string): string {
  return s
    .replace(/\r\n?|\n/g, "\n")
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "")
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\;")
    .replace(/,/g, "\\,")
    .replace(/\n/g, "\\n");
}

/** «20261105T183000Z» */
export function formatIcsUtc(d: Date): string {
  const p = (n: number, l = 2) => String(n).padStart(l, "0");
  return `${p(d.getUTCFullYear(), 4)}${p(d.getUTCMonth() + 1)}${p(d.getUTCDate())}T${p(d.getUTCHours())}${p(d.getUTCMinutes())}${p(d.getUTCSeconds())}Z`;
}

/** Faltet eine Zeile auf höchstens 75 Oktette (UTF-8); Fortsetzungszeilen beginnen mit einem Leerzeichen. */
export function foldIcsLine(line: string): string {
  const enc = new TextEncoder();
  if (enc.encode(line).length <= 75) return line;
  const parts: string[] = [];
  let current = "";
  let bytes = 0;
  let limit = 75;
  for (const ch of line) {
    const n = enc.encode(ch).length;
    if (bytes + n > limit) {
      parts.push(current);
      current = "";
      bytes = 0;
      limit = 74; // das führende Leerzeichen zählt mit
    }
    current += ch;
    bytes += n;
  }
  parts.push(current);
  return parts.join("\r\n ");
}

/** Kalender mit einem oder mehreren Terminen. `domain`: Teil hinter dem @ der UID (Standard: vylaris.ch). */
export function buildIcs(events: readonly IcsEvent[], opts: { calendarName?: string; domain?: string; now?: Date } = {}): string {
  const domain = opts.domain ?? "vylaris.ch";
  const now = opts.now ?? new Date();
  const lines: string[] = ["BEGIN:VCALENDAR", "VERSION:2.0", `PRODID:${ICS_PRODID}`, "CALSCALE:GREGORIAN", "METHOD:PUBLISH"];
  if (opts.calendarName) lines.push(`X-WR-CALNAME:${escapeIcsText(opts.calendarName)}`);
  for (const e of events) {
    const stamp = e.updatedAt ?? now;
    lines.push(
      "BEGIN:VEVENT",
      `UID:${e.uid.replace(/[^A-Za-z0-9_-]/g, "")}@${domain}`,
      `DTSTAMP:${formatIcsUtc(stamp)}`,
      `LAST-MODIFIED:${formatIcsUtc(stamp)}`,
      `SEQUENCE:${Math.max(0, Math.trunc(e.sequence ?? 0))}`,
      `DTSTART:${formatIcsUtc(e.start)}`,
    );
    if (e.end && e.end.getTime() > e.start.getTime()) lines.push(`DTEND:${formatIcsUtc(e.end)}`);
    lines.push(`SUMMARY:${escapeIcsText(e.title)}`);
    if (e.description) lines.push(`DESCRIPTION:${escapeIcsText(e.description)}`);
    if (e.location) lines.push(`LOCATION:${escapeIcsText(e.location)}`);
    if (e.url && /^https?:\/\//i.test(e.url)) lines.push(`URL:${e.url.replace(/[\r\n]/g, "")}`);
    lines.push(`STATUS:${e.cancelled ? "CANCELLED" : "CONFIRMED"}`, "END:VEVENT");
  }
  lines.push("END:VCALENDAR");
  return lines.map(foldIcsLine).join("\r\n") + "\r\n";
}

/** Download-Antwort für eine .ics-Datei. */
export function icsResponse(fileName: string, events: readonly IcsEvent[], opts: { calendarName?: string; domain?: string } = {}): Response {
  const name = safeDownloadName(fileName.replace(/\.ics$/i, ""), "termin") + ".ics";
  return new Response(buildIcs(events, opts), {
    status: 200,
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="${name}"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
