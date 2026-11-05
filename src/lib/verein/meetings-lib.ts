// Fachlogik des Moduls Versammlungen (rein, ohne Seiteneffekte, auch im Browser nutzbar):
// Abstimmungsergebnis, Einladungsfrist, Beschlussfähigkeit (nur Hinweis), Reihenfolge der Traktanden, Protokoll-Entwurf,
// Sichtbarkeit für Mitglieder, Kalendereintrag und Register-Export.
// Alle Voreinstellungen (einfaches Mehr, Fristen) sind «gemäss Statuten anzupassen»; die Software entscheidet nichts rechtsverbindlich.
import { daysBetween, formatDateCh, isInvitationOnTime, latestInvitationDate, todayZurich, toDateOnly, zurichParts, ZONE } from "./dates";
import { MEETING_KIND_LABEL, RESOLUTION_RESULT_LABEL, type MeetingKind, type ResolutionResult } from "./constants";
import type { IcsEvent } from "./ics";

// ---- Werte ----------------------------------------------------------------------------------------------------------

/** Mehrheitsregeln für einen Beschluss. Die Voreinstellung (einfaches Mehr) ist gemäss Statuten anzupassen. */
export const MAJORITY_RULES = ["EINFACH", "ABSOLUT", "ZWEIDRITTEL"] as const;
export type MajorityRule = (typeof MAJORITY_RULES)[number];
export const DEFAULT_MAJORITY: MajorityRule = "EINFACH";
export const MAJORITY_LABEL: Record<MajorityRule, string> = {
  EINFACH: "Einfaches Mehr (mehr Ja als Nein)",
  ABSOLUT: "Absolutes Mehr (mehr als die Hälfte der anwesenden Stimmberechtigten)",
  ZWEIDRITTEL: "Zwei Drittel der abgegebenen Stimmen",
};
export const MAJORITY_SHORT: Record<MajorityRule, string> = { EINFACH: "Einfaches Mehr", ABSOLUT: "Absolutes Mehr", ZWEIDRITTEL: "Zwei Drittel" };

/** Rückmeldung eines Mitglieds vor der Sitzung. */
export const RSVP_VALUES = ["ZUSAGE", "ABSAGE"] as const;
export type Rsvp = (typeof RSVP_VALUES)[number];
export const RSVP_LABEL: Record<Rsvp, string> = { ZUSAGE: "Nimmt teil", ABSAGE: "Entschuldigt" };

export const MAIL_KINDS = ["EINLADUNG", "ERINNERUNG", "ABSAGE"] as const;
export type MailKind = (typeof MAIL_KINDS)[number];
export const MAIL_KIND_LABEL: Record<MailKind, string> = { EINLADUNG: "Einladung", ERINNERUNG: "Erinnerung", ABSAGE: "Absage" };

/** Versammlungen der Mitglieder (im Portal sichtbar). Vorstandssitzungen bleiben intern. */
export const ASSEMBLY_KINDS: readonly string[] = ["MITGLIEDERVERSAMMLUNG", "AUSSERORDENTLICH"];
export const isAssemblyKind = (kind: string): boolean => ASSEMBLY_KINDS.includes(kind);

/** Status, in denen Mitglieder die Versammlung im Portal sehen (eingeladen oder durchgeführt). */
export const PORTAL_MEETING_STATUSES: readonly string[] = ["EINGELADEN", "DURCHGEFUEHRT"];

export const kindLabel = (kind: string): string => (MEETING_KIND_LABEL as Record<string, string>)[kind] ?? kind;

// ---- Abstimmungsergebnis ----------------------------------------------------------------------------------------------

export type TallyInput = {
  yes: number | null;
  no: number | null;
  abstentions?: number | null;
  majority?: MajorityRule;
  /** Anzahl anwesender Stimmberechtigter (nur für das absolute Mehr nötig) */
  presentVoters?: number | null;
};

export type TallyOutcome = {
  /** null: aus den Zahlen nicht ermittelbar */
  result: Extract<ResolutionResult, "ANGENOMMEN" | "ABGELEHNT"> | null;
  /** Stimmengleichheit: Ob ein Stichentscheid gilt, bestimmen die Statuten */
  tie: boolean;
  /** Abgegebene Stimmen (Ja + Nein); Enthaltungen zählen nicht mit */
  cast: number;
  note: string;
};

const isCount = (n: unknown): n is number => typeof n === "number" && Number.isInteger(n) && n >= 0;

/**
 * Ergebnis aus den Stimmen. Voreinstellung «einfaches Mehr der abgegebenen Stimmen»: Ja grösser als Nein; Enthaltungen werden nicht
 * mitgezählt. Bei Stimmengleichheit gilt der Antrag als abgelehnt, sofern die Statuten keinen Stichentscheid vorsehen (Hinweis, tie).
 * Das Ergebnis ist ein Vorschlag: Die Sitzungsleitung kann es von Hand überschreiben.
 */
export function tallyResolution(input: TallyInput): TallyOutcome {
  const majority = input.majority ?? DEFAULT_MAJORITY;
  if (!isCount(input.yes) || !isCount(input.no)) {
    return { result: null, tie: false, cast: 0, note: "Ohne Auszählung (Ja und Nein) wird kein Ergebnis berechnet." };
  }
  const yes = input.yes;
  const no = input.no;
  const cast = yes + no;
  if (cast === 0) return { result: null, tie: false, cast, note: "Es wurden keine Stimmen abgegeben." };

  if (majority === "ZWEIDRITTEL") {
    const ok = yes * 3 >= cast * 2;
    return { result: ok ? "ANGENOMMEN" : "ABGELEHNT", tie: false, cast, note: `Zwei Drittel von ${cast} abgegebenen Stimmen verlangt (Ja: ${yes}).` };
  }
  if (majority === "ABSOLUT") {
    if (!isCount(input.presentVoters) || input.presentVoters === 0) {
      return { result: null, tie: false, cast, note: "Für das absolute Mehr fehlt die Zahl der anwesenden Stimmberechtigten." };
    }
    const ok = yes * 2 > input.presentVoters;
    return { result: ok ? "ANGENOMMEN" : "ABGELEHNT", tie: false, cast, note: `Mehr als die Hälfte von ${input.presentVoters} anwesenden Stimmberechtigten verlangt (Ja: ${yes}).` };
  }
  if (yes === no) return { result: "ABGELEHNT", tie: true, cast, note: "Stimmengleichheit. Ob ein Stichentscheid gilt, bestimmen die Statuten." };
  return { result: yes > no ? "ANGENOMMEN" : "ABGELEHNT", tie: false, cast, note: "Einfaches Mehr der abgegebenen Stimmen (Enthaltungen zählen nicht mit)." };
}

/** Kurztext «Ja 5, Nein 2, Enthaltungen 1» (nur vorhandene Angaben); leer ohne Auszählung. */
export function voteSummary(r: { votesYes: number | null; votesNo: number | null; abstentions: number | null }): string {
  const parts: string[] = [];
  if (r.votesYes !== null) parts.push(`Ja ${r.votesYes}`);
  if (r.votesNo !== null) parts.push(`Nein ${r.votesNo}`);
  if (r.abstentions !== null) parts.push(`Enthaltungen ${r.abstentions}`);
  return parts.join(", ");
}

// ---- Einladungsfrist --------------------------------------------------------------------------------------------------

export type InvitationTiming = {
  /** unknown: Frist nicht eingestellt · ok: rechtzeitig · late: Frist unterschritten · past: Sitzung hat schon begonnen */
  state: "unknown" | "ok" | "late" | "past";
  /** Spätester Versandtag (Datum ohne Uhrzeit); null ohne Einstellung */
  latest: Date | null;
  /** Tage von heute bis zur Sitzung (negativ: vorbei) */
  daysToMeeting: number;
  /** Tage, um die die Frist heute unterschritten wäre (nur bei late) */
  daysShort: number;
  text: string;
};

/** Prüft, ob eine Einladung heute noch rechtzeitig versendet würde. `minDays` ist die Einladungsfrist aus den Vereinseinstellungen. */
export function invitationTiming(opts: { start: Date; minDays: number | null; now?: Date }): InvitationTiming {
  const now = opts.now ?? new Date();
  const daysToMeeting = daysBetween(now, opts.start);
  if (opts.start.getTime() <= now.getTime()) {
    return { state: "past", latest: opts.minDays === null ? null : latestInvitationDate(opts.start, opts.minDays), daysToMeeting, daysShort: 0, text: "Die Sitzung hat bereits begonnen." };
  }
  if (opts.minDays === null) {
    return { state: "unknown", latest: null, daysToMeeting, daysShort: 0, text: "Die Einladungsfrist ist in den Vereinseinstellungen nicht eingetragen." };
  }
  const latest = latestInvitationDate(opts.start, opts.minDays);
  if (isInvitationOnTime(now, opts.start, opts.minDays)) {
    return { state: "ok", latest, daysToMeeting, daysShort: 0, text: `Rechtzeitig, wenn die Einladung bis ${formatDateCh(latest)} versendet wird (Frist: ${opts.minDays} Tage).` };
  }
  const daysShort = daysBetween(latest, todayZurich(now));
  return {
    state: "late",
    latest,
    daysToMeeting,
    daysShort,
    text: `Die Frist von ${opts.minDays} Tagen wäre unterschritten: Spätester Versandtag war der ${formatDateCh(latest)} (${daysShort} ${daysShort === 1 ? "Tag" : "Tage"} zu spät). Prüfe die Statuten.`,
  };
}

/** Wurde ein früherer Versand rechtzeitig vorgenommen? null, wenn nicht beurteilbar (keine Frist eingetragen). */
export function wasSentOnTime(sentAt: Date, start: Date, minDays: number | null): boolean | null {
  return minDays === null ? null : isInvitationOnTime(sentAt, start, minDays);
}

// ---- Beschlussfähigkeit (nur Hinweis) ----------------------------------------------------------------------------------

export type QuorumHint = { state: "none" | "ok" | "below"; text: string };

/** Hinweis zur Beschlussfähigkeit. Massgeblich sind allein die Statuten; die Software verhindert nichts. */
export function quorumHint(opts: { presentVoters: number; quorumMin: number | null }): QuorumHint {
  if (opts.quorumMin === null || opts.quorumMin <= 0) {
    return { state: "none", text: "Keine Mindestzahl hinterlegt. Ob die Versammlung beschlussfähig ist, richtet sich nach den Statuten." };
  }
  if (opts.presentVoters >= opts.quorumMin) {
    return { state: "ok", text: `${opts.presentVoters} anwesende Stimmberechtigte (Mindestzahl gemäss Statuten: ${opts.quorumMin}).` };
  }
  return {
    state: "below",
    text: `Nur ${opts.presentVoters} anwesende Stimmberechtigte, Mindestzahl gemäss Statuten: ${opts.quorumMin}. Prüfe, ob Beschlüsse gültig gefasst werden können.`,
  };
}

/** Anzahl anwesender Stimmberechtigter. */
export function countPresentVoters(rows: ReadonlyArray<{ status: string; canVote: boolean }>): number {
  return rows.filter((r) => r.status === "ANWESEND" && r.canVote).length;
}

// ---- Reihenfolge ------------------------------------------------------------------------------------------------------

/** Verschiebt ein Element um eine Stelle; liefert die neue Reihenfolge der IDs (unverändert, wenn es nicht geht). */
export function moveId(ids: readonly string[], id: string, direction: "up" | "down"): string[] {
  const i = ids.indexOf(id);
  const j = direction === "up" ? i - 1 : i + 1;
  if (i < 0 || j < 0 || j >= ids.length) return [...ids];
  const out = [...ids];
  [out[i], out[j]] = [out[j]!, out[i]!];
  return out;
}

/** Nächste laufende Beschlussnummer innerhalb der Sitzung. */
export function nextResolutionNumber(numbers: readonly number[]): number {
  return numbers.reduce((max, n) => Math.max(max, n), 0) + 1;
}

// ---- Darstellung ------------------------------------------------------------------------------------------------------

const WEEKDAY = new Intl.DateTimeFormat("de-CH", { timeZone: ZONE, weekday: "long" });

const hhmm = (d: Date): string => {
  const p = zurichParts(d);
  return `${String(p.hour).padStart(2, "0")}:${String(p.minute).padStart(2, "0")}`;
};

/** «Donnerstag, 5.11.2026, 19:30–21:00 Uhr» (Zürcher Zeit). */
export function formatMeetingWhen(start: Date, end: Date | null): string {
  const day = `${WEEKDAY.format(start)}, ${formatDateCh(start)}`;
  const sameDay = end !== null && formatDateCh(end) === formatDateCh(start);
  if (end && sameDay && end.getTime() > start.getTime()) return `${day}, ${hhmm(start)}–${hhmm(end)} Uhr`;
  if (end && !sameDay && end.getTime() > start.getTime()) return `${day}, ${hhmm(start)} Uhr bis ${formatDateCh(end)}, ${hhmm(end)} Uhr`;
  return `${day}, ${hhmm(start)} Uhr`;
}

/** Standardtitel einer neuen Sitzung, z. B. «Mitgliederversammlung 2026». */
export function defaultMeetingTitle(kind: string, start: Date): string {
  return `${kindLabel(kind)} ${zurichParts(start).year}`;
}

/** Markdown-Sonderzeichen in Namen und Titeln unschädlich machen. */
export function escapeMd(s: string): string {
  return s.replace(/[\\`*_{}[\]<>#|~]/g, (c) => `\\${c}`).replace(/\r?\n/g, " ").trim();
}

// ---- Protokoll-Entwurf ------------------------------------------------------------------------------------------------

export type DraftMeeting = {
  kind: string;
  title: string;
  startsAt: Date;
  endsAt: Date | null;
  location: string;
  quorumMin: number | null;
  leaderName: string | null;
  recorderName: string | null;
};
export type DraftAgenda = { id: string; position: number; title: string; description: string; motion: string };
export type DraftResolution = {
  agendaItemId: string | null;
  number: number;
  text: string;
  votesYes: number | null;
  votesNo: number | null;
  abstentions: number | null;
  result: string;
  recusal: string;
};
export type DraftAttendance = { name: string; status: string; canVote: boolean };

function resolutionLine(r: DraftResolution): string {
  const votes = voteSummary(r);
  const result = RESOLUTION_RESULT_LABEL[r.result as ResolutionResult] ?? r.result;
  const parts = [`**Beschluss ${r.number}:** ${escapeMd(r.text)}`, `Ergebnis: ${result}${votes ? ` (${votes})` : ""}.`];
  if (r.recusal.trim()) parts.push(`Ausstand: ${escapeMd(r.recusal)}.`);
  return parts.join(" ");
}

/**
 * Entwurf des Protokolls aus Sitzungsdaten, Traktanden, Anwesenheit und Beschlüssen. Der Entwurf ist ein Ausgangspunkt:
 * Das Protokoll wird danach von Hand ergänzt, geprüft und genehmigt.
 */
export function buildMinutesDraft(input: { meeting: DraftMeeting; agenda: readonly DraftAgenda[]; resolutions: readonly DraftResolution[]; attendance: readonly DraftAttendance[] }): string {
  const { meeting, agenda, resolutions, attendance } = input;
  const lines: string[] = [];
  lines.push(`# Protokoll: ${escapeMd(meeting.title)}`, "");
  lines.push(`**Art:** ${kindLabel(meeting.kind)}  `);
  lines.push(`**Datum und Zeit:** ${formatMeetingWhen(meeting.startsAt, meeting.endsAt)}  `);
  if (meeting.location.trim()) lines.push(`**Ort:** ${escapeMd(meeting.location)}  `);
  if (meeting.leaderName) lines.push(`**Leitung:** ${escapeMd(meeting.leaderName)}  `);
  if (meeting.recorderName) lines.push(`**Protokoll:** ${escapeMd(meeting.recorderName)}  `);
  lines.push("");

  const present = attendance.filter((a) => a.status === "ANWESEND");
  const excused = attendance.filter((a) => a.status === "ENTSCHULDIGT");
  const voters = present.filter((a) => a.canVote).length;
  lines.push("## Anwesenheit", "");
  if (attendance.length === 0) {
    lines.push("_Anwesenheit noch nicht erfasst._", "");
  } else {
    lines.push(`**Anwesend (${present.length}, davon stimmberechtigt ${voters}):** ${present.length ? present.map((a) => escapeMd(a.name)).join(", ") : "–"}  `);
    lines.push(`**Entschuldigt (${excused.length}):** ${excused.length ? excused.map((a) => escapeMd(a.name)).join(", ") : "–"}`, "");
    const q = quorumHint({ presentVoters: voters, quorumMin: meeting.quorumMin });
    if (q.state !== "none") lines.push(`_${q.text}_`, "");
  }

  lines.push("## Traktanden und Beschlüsse", "");
  const byAgenda = new Map<string, DraftResolution[]>();
  const loose: DraftResolution[] = [];
  const known = new Set(agenda.map((a) => a.id));
  for (const r of resolutions) {
    if (r.agendaItemId && known.has(r.agendaItemId)) byAgenda.set(r.agendaItemId, [...(byAgenda.get(r.agendaItemId) ?? []), r]);
    else loose.push(r);
  }
  if (agenda.length === 0 && loose.length === 0) lines.push("_Keine Traktanden erfasst._", "");
  [...agenda]
    .sort((a, b) => a.position - b.position)
    .forEach((a, i) => {
      lines.push(`### ${i + 1}. ${escapeMd(a.title)}`, "");
      if (a.description.trim()) lines.push(a.description.trim(), "");
      if (a.motion.trim()) lines.push(`**Antrag:** ${escapeMd(a.motion)}`, "");
      for (const r of byAgenda.get(a.id) ?? []) lines.push(resolutionLine(r), "");
      lines.push("_Diskussion und Bemerkungen:_", "");
    });
  if (loose.length > 0) {
    lines.push("### Weitere Beschlüsse", "");
    for (const r of loose) lines.push(resolutionLine(r), "");
  }

  lines.push("## Schluss", "", "_Die Sitzung wurde um ... Uhr geschlossen._", "");
  return lines.join("\n").replace(/\n{3,}/g, "\n\n").trimEnd() + "\n";
}

// ---- Protokoll sperren ------------------------------------------------------------------------------------------------

/** Ein genehmigtes Protokoll ist gesperrt; Änderungen brauchen eine Begründung und stehen im Änderungsprotokoll. */
export const isMinutesLocked = (m: { minutesApprovedAt: Date | null }): boolean => m.minutesApprovedAt !== null;

/** Vermerk, der nach einer nachträglichen Änderung an die Genehmigungsnotiz angehängt wird. */
export function amendmentNote(existing: string, when: Date, reason: string): string {
  const line = `Nachträglich geändert am ${formatDateCh(toDateOnly(when))}: ${reason.trim().replace(/\s+/g, " ")}`;
  return [existing.trim(), line].filter(Boolean).join("\n");
}

// ---- Kalender -----------------------------------------------------------------------------------------------------------

/** Kalendereintrag einer Sitzung (iCalendar). `url` ist ein Link auf der festen Basis-URL. */
export function meetingIcsEvent(m: {
  id: string;
  kind: string;
  title: string;
  startsAt: Date;
  endsAt: Date | null;
  location: string;
  status: string;
  updatedAt: Date;
  agenda?: ReadonlyArray<{ title: string }>;
  url?: string;
}): IcsEvent {
  const agenda = (m.agenda ?? []).map((a, i) => `${i + 1}. ${a.title}`).join("\n");
  return {
    uid: `versammlung-${m.id}`,
    title: m.title,
    description: [kindLabel(m.kind), agenda && `Traktanden:\n${agenda}`].filter(Boolean).join("\n\n"),
    location: m.location || undefined,
    start: m.startsAt,
    end: m.endsAt,
    url: m.url,
    cancelled: m.status === "ABGESAGT",
    updatedAt: m.updatedAt,
  };
}

// ---- Register-Export ----------------------------------------------------------------------------------------------------

export const RESOLUTION_CSV_HEADERS = ["Datum", "Sitzung", "Art", "Nr.", "Traktandum", "Beschluss", "Ja", "Nein", "Enthaltungen", "Mehrheit", "Ergebnis", "Ausstand"] as const;

export type RegisterRow = {
  meetingStart: Date;
  meetingTitle: string;
  meetingKind: string;
  number: number;
  agendaTitle: string;
  text: string;
  votesYes: number | null;
  votesNo: number | null;
  abstentions: number | null;
  majority: string;
  result: string;
  recusal: string;
};

/** Zeilen für csv.ts (Zahlen als Zahlen, Text wird dort gegen Formel-Injektion geschützt). */
export function registerCsvRows(rows: readonly RegisterRow[]): Array<Array<string | number | Date | null>> {
  return rows.map((r) => [
    toDateOnly(r.meetingStart),
    r.meetingTitle,
    kindLabel(r.meetingKind),
    r.number,
    r.agendaTitle,
    r.text,
    r.votesYes,
    r.votesNo,
    r.abstentions,
    MAJORITY_SHORT[r.majority as MajorityRule] ?? r.majority,
    RESOLUTION_RESULT_LABEL[r.result as ResolutionResult] ?? r.result,
    r.recusal,
  ]);
}

export type { MeetingKind };
