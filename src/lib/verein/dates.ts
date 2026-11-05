// Datum und Fristen in Zürcher Zeit (Europe/Zurich), ohne Fremdbibliothek.
//
// Zwei Arten von Zeitangaben:
//  - Datum ohne Uhrzeit (Eintritt, Fälligkeit, Geschäftsjahr, Buchungsdatum …): gespeichert als «Mittag UTC» des Kalendertags
//    (dateOnly). So bleibt der Tag in jeder Zeitzone und in beiden Datenbanken gleich. Gelesen wird immer der Zürcher Kalendertag.
//  - Zeitpunkte (Sitzungsbeginn, Zeitstempel): echte Instants. Eingaben «TT.MM.JJJJ HH:mm» bzw. datetime-local gelten als Zürcher Zeit.

export const ZONE = "Europe/Zurich";

const PARTS = new Intl.DateTimeFormat("en-GB", {
  timeZone: ZONE,
  hourCycle: "h23",
  year: "numeric",
  month: "numeric",
  day: "numeric",
  hour: "numeric",
  minute: "numeric",
  second: "numeric",
});

export type ZurichParts = { year: number; month: number; day: number; hour: number; minute: number; second: number; weekday: number };

/** Kalender- und Uhrzeitbestandteile eines Zeitpunkts in Zürcher Zeit. `weekday`: 0 = Sonntag … 6 = Samstag. */
export function zurichParts(date: Date): ZurichParts {
  const p: Record<string, number> = {};
  for (const part of PARTS.formatToParts(date)) {
    if (part.type !== "literal") p[part.type] = Number(part.value);
  }
  const year = p.year ?? 1970;
  const month = p.month ?? 1;
  const day = p.day ?? 1;
  return {
    year,
    month,
    day,
    hour: p.hour ?? 0,
    minute: p.minute ?? 0,
    second: p.second ?? 0,
    weekday: new Date(Date.UTC(year, month - 1, day)).getUTCDay(),
  };
}

/** Abweichung der Zürcher Zeit von UTC in Minuten zu einem Zeitpunkt (60 im Winter, 120 im Sommer). */
export function zurichOffsetMinutes(date: Date): number {
  const p = zurichParts(date);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return Math.round((asUtc - Math.floor(date.getTime() / 1000) * 1000) / 60000);
}

function assertCalendarDate(year: number, month: number, day: number): void {
  const d = new Date(Date.UTC(year, month - 1, day));
  if (!Number.isInteger(year) || d.getUTCFullYear() !== year || d.getUTCMonth() !== month - 1 || d.getUTCDate() !== day) {
    throw new RangeError(`Ungültiges Datum: ${day}.${month}.${year}`);
  }
}

/** Zürcher Ortszeit → Zeitpunkt. Berücksichtigt Sommer-/Winterzeit. */
export function zurichToDate(year: number, month: number, day: number, hour = 0, minute = 0): Date {
  assertCalendarDate(year, month, day);
  const guess = Date.UTC(year, month - 1, day, hour, minute);
  const first = zurichOffsetMinutes(new Date(guess));
  let result = guess - first * 60000;
  const second = zurichOffsetMinutes(new Date(result));
  if (second !== first) result = guess - second * 60000;
  return new Date(result);
}

// ---- Datum ohne Uhrzeit --------------------------------------------------------------------------------------------

/** Datum ohne Uhrzeit (Mittag UTC). Wirft bei ungültigen Kalendertagen (z. B. 30.2.). */
export function dateOnly(year: number, month: number, day: number): Date {
  assertCalendarDate(year, month, day);
  return new Date(Date.UTC(year, month - 1, day, 12));
}

/** Der Zürcher Kalendertag eines beliebigen Zeitpunkts als Datum ohne Uhrzeit. */
export function toDateOnly(date: Date): Date {
  const p = zurichParts(date);
  return dateOnly(p.year, p.month, p.day);
}

/** Heute in Zürcher Zeit als Datum ohne Uhrzeit. */
export const todayZurich = (now: Date = new Date()): Date => toDateOnly(now);

/** Jahr eines Zeitpunkts in Zürcher Zeit. */
export const yearOf = (date: Date): number => zurichParts(date).year;

/** Liest «JJJJ-MM-TT» oder «T.M.JJJJ» als Datum ohne Uhrzeit; null bei ungültiger Eingabe. */
export function parseDateOnly(input: string): Date | null {
  const s = input.trim();
  let y: number, m: number, d: number;
  let match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (match) {
    [y, m, d] = [Number(match[1]), Number(match[2]), Number(match[3])];
  } else if ((match = /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/.exec(s))) {
    [d, m, y] = [Number(match[1]), Number(match[2]), Number(match[3])];
  } else {
    return null;
  }
  if (y < 1900 || y > 2200) return null;
  try {
    return dateOnly(y, m, d);
  } catch {
    return null;
  }
}

/** «JJJJ-MM-TT» für <input type="date"> (Zürcher Kalendertag). */
export function toDateInputValue(date: Date): string {
  const p = zurichParts(date);
  return `${String(p.year).padStart(4, "0")}-${String(p.month).padStart(2, "0")}-${String(p.day).padStart(2, "0")}`;
}

/** «JJJJ-MM-TTTHH:mm» für <input type="datetime-local"> (Zürcher Zeit). */
export function toDateTimeLocalValue(date: Date): string {
  const p = zurichParts(date);
  return `${toDateInputValue(date)}T${String(p.hour).padStart(2, "0")}:${String(p.minute).padStart(2, "0")}`;
}

/** Liest «JJJJ-MM-TTTHH:mm» (datetime-local) bzw. «T.M.JJJJ HH:mm» als Zürcher Zeit; null bei ungültiger Eingabe. */
export function parseDateTimeLocal(input: string): Date | null {
  const s = input.trim();
  let y: number, mo: number, d: number, h: number, mi: number;
  let match = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})$/.exec(s);
  if (match) {
    [y, mo, d, h, mi] = [Number(match[1]), Number(match[2]), Number(match[3]), Number(match[4]), Number(match[5])];
  } else if ((match = /^(\d{1,2})\.(\d{1,2})\.(\d{4})[ ,]+(\d{1,2}):(\d{2})$/.exec(s))) {
    [d, mo, y, h, mi] = [Number(match[1]), Number(match[2]), Number(match[3]), Number(match[4]), Number(match[5])];
  } else {
    return null;
  }
  if (y < 1900 || y > 2200 || h > 23 || mi > 59) return null;
  try {
    return zurichToDate(y, mo, d, h, mi);
  } catch {
    return null;
  }
}

/** «5.11.2026» (Zürcher Kalendertag, ohne führende Nullen). */
export function formatDateCh(date: Date): string {
  const p = zurichParts(date);
  return `${p.day}.${p.month}.${p.year}`;
}

/** «5.11.2026, 19:30 Uhr» (Zürcher Zeit). */
export function formatDateTimeCh(date: Date): string {
  const p = zurichParts(date);
  return `${p.day}.${p.month}.${p.year}, ${String(p.hour).padStart(2, "0")}:${String(p.minute).padStart(2, "0")} Uhr`;
}

/** Beginn des Zürcher Kalendertags als Zeitpunkt (für Bereichsabfragen auf Zeitstempeln). */
export function startOfDayZurich(date: Date): Date {
  const p = zurichParts(date);
  return zurichToDate(p.year, p.month, p.day, 0, 0);
}

// ---- Rechnen mit Kalendertagen ------------------------------------------------------------------------------------

/** Verschiebt ein Datum um `days` Kalendertage (auch negativ). */
export function addDays(date: Date, days: number): Date {
  const d = toDateOnly(date);
  return new Date(d.getTime() + days * 86_400_000);
}

const daysInMonth = (year: number, month: number) => new Date(Date.UTC(year, month, 0)).getUTCDate();

/** Verschiebt ein Datum um `months` Monate; fehlt der Tag im Zielmonat, gilt dessen letzter Tag (31.12. − 6 Monate = 30.6.). */
export function addMonths(date: Date, months: number): Date {
  const p = zurichParts(date);
  const index = p.year * 12 + (p.month - 1) + months;
  const year = Math.floor(index / 12);
  const month = (index % 12 + 12) % 12 + 1;
  return dateOnly(year, month, Math.min(p.day, daysInMonth(year, month)));
}

/** Anzahl Kalendertage von a bis b (positiv, wenn b später ist). */
export function daysBetween(a: Date, b: Date): number {
  return Math.round((toDateOnly(b).getTime() - toDateOnly(a).getTime()) / 86_400_000);
}

/** Ist die Frist abgelaufen? Eine Frist gilt bis Ende des Fälligkeitstags: überfällig ist man ab dem Tag danach. */
export function isPastDue(dueDate: Date, now: Date = new Date()): boolean {
  return daysBetween(dueDate, now) > 0;
}

/** Fälligkeit = Rechnungsdatum + Zahlungsfrist in Tagen. */
export const dueDateFrom = (issueDate: Date, paymentDays: number): Date => addDays(issueDate, paymentDays);

/** Neue Zahlungsfrist einer Mahnung ab dem Versanddatum. */
export const reminderDueDate = (sentOn: Date, days: number): Date => addDays(sentOn, days);

// ---- Geschäftsjahr ----------------------------------------------------------------------------------------------

export type FiscalStart = { month: number; day: number };
/** Voreinstellung: Kalenderjahr (1. Januar). Der Verein stellt es in den Vereinseinstellungen ein («gemäss Statuten»). */
export const DEFAULT_FISCAL_START: FiscalStart = { month: 1, day: 1 };

/**
 * Das Geschäftsjahr wird mit dem Jahr benannt, in dem es beginnt (Beginn 1.7.2026 → «2026», Ende 30.6.2027).
 * Beginnt es am 1. Januar, ist das identisch mit dem Kalenderjahr.
 */
export function fiscalYearRange(year: number, start: FiscalStart = DEFAULT_FISCAL_START): { start: Date; end: Date } {
  const first = dateOnly(year, start.month, start.day);
  const next = dateOnly(year + 1, start.month, start.day);
  return { start: first, end: addDays(next, -1) };
}

/** In welches Geschäftsjahr (benannt nach dem Beginnjahr) fällt das Datum? */
export function fiscalYearOf(date: Date, start: FiscalStart = DEFAULT_FISCAL_START): number {
  const day = toDateOnly(date);
  const y = zurichParts(day).year;
  return day.getTime() < dateOnly(y, start.month, start.day).getTime() ? y - 1 : y;
}

// ---- Austritt ------------------------------------------------------------------------------------------------------

export const EXIT_MODES = ["KALENDERJAHR", "GESCHAEFTSJAHR", "JEDERZEIT"] as const;
export type ExitMode = (typeof EXIT_MODES)[number];
export const EXIT_MODE_LABEL: Record<ExitMode, string> = {
  KALENDERJAHR: "Auf Ende des Kalenderjahres",
  GESCHAEFTSJAHR: "Auf Ende des Geschäftsjahres",
  JEDERZEIT: "Jederzeit (nach Ablauf der Kündigungsfrist)",
};

export type ExitRule = { mode: ExitMode; noticeMonths: number };
/**
 * Voreinstellung nach ZGB Art. 70 Abs. 2: Der Austritt ist, wenn die Statuten nichts anderes bestimmen, nur auf Ende eines
 * Kalenderjahres zulässig und muss spätestens sechs Monate vorher angekündigt werden. Die Statuten gehen vor.
 */
export const DEFAULT_EXIT_RULE: ExitRule = { mode: "KALENDERJAHR", noticeMonths: 6 };

/**
 * Frühestmöglicher Austrittstermin bei Eingang der Austrittserklärung am `noticeDate`.
 *  - KALENDERJAHR: 31.12. des Jahres, wenn die Erklärung spätestens `noticeMonths` Monate vorher eingeht, sonst 31.12. des Folgejahres.
 *  - GESCHAEFTSJAHR: dasselbe mit dem Ende des Geschäftsjahres.
 *  - JEDERZEIT: `noticeMonths` Monate nach Eingang.
 */
export function earliestExitDate(noticeDate: Date, rule: ExitRule = DEFAULT_EXIT_RULE, fiscal: FiscalStart = DEFAULT_FISCAL_START): Date {
  const notice = toDateOnly(noticeDate);
  if (rule.mode === "JEDERZEIT") return addMonths(notice, rule.noticeMonths);
  const start = rule.mode === "KALENDERJAHR" ? DEFAULT_FISCAL_START : fiscal;
  let fy = fiscalYearOf(notice, start);
  for (let i = 0; i < 3; i++, fy++) {
    const end = fiscalYearRange(fy, start).end;
    const deadline = addMonths(end, -rule.noticeMonths);
    if (notice.getTime() <= deadline.getTime()) return end;
  }
  return fiscalYearRange(fy, start).end;
}

// ---- Einladung zur Versammlung ---------------------------------------------------------------------------------------

/** Spätester Versandtag der Einladung: Versandtag und Versammlungstag werden nicht mitgezählt. */
export function latestInvitationDate(meetingStart: Date, minDays: number): Date {
  return addDays(toDateOnly(meetingStart), -minDays);
}

/** Wurde die Einladung rechtzeitig versendet (Frist in Tagen aus den Vereinseinstellungen, «gemäss Statuten»)? */
export function isInvitationOnTime(sentAt: Date, meetingStart: Date, minDays: number): boolean {
  return toDateOnly(sentAt).getTime() <= latestInvitationDate(meetingStart, minDays).getTime();
}
