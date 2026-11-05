// Fachlogik des Moduls Mitglieder: reine Funktionen ohne Datenbank und ohne Seiteneffekte (testbar, auch im Browser nutzbar).
// Austritt (ZGB Art. 70 Abs. 2, Statuten gehen vor), Statusübergänge, Ämter, Kontoverknüpfung, Anonymisierung, Auskunft (revDSG), Export.
import {
  COMMUNICATION_PREF_LABEL,
  MEMBER_STATUS_LABEL,
  OFFICE_KIND_LABEL,
  SALUTATION_LABEL,
  labelOf,
  type MemberStatus,
  type OfficeKind,
} from "./constants";
import {
  EXIT_MODE_LABEL,
  earliestExitDate,
  formatDateCh,
  formatDateTimeCh,
  todayZurich,
  toDateOnly,
  type ExitRule,
  type FiscalStart,
} from "./dates";
import { formatChf } from "./money";

// ---- Anzeige --------------------------------------------------------------------------------------------------------

export const ANONYMIZED_LAST_NAME = "Anonymisiert";

type NameParts = { firstName: string; lastName: string; anonymizedAt?: Date | null; memberNumber?: number };

/** «Vorname Nachname»; bei anonymisierten Personen «Anonymisiert (Nr. 12)». */
export function memberName(m: NameParts): string {
  if (m.anonymizedAt) return m.memberNumber !== undefined ? `${ANONYMIZED_LAST_NAME} (Nr. ${m.memberNumber})` : ANONYMIZED_LAST_NAME;
  return `${m.firstName} ${m.lastName}`.trim() || (m.memberNumber !== undefined ? `Mitglied Nr. ${m.memberNumber}` : "Unbenannt");
}

/** «Nachname, Vorname» für Sortierung und Listen. */
export function memberNameLastFirst(m: NameParts): string {
  if (m.anonymizedAt) return memberName(m);
  return [m.lastName, m.firstName].filter(Boolean).join(", ") || memberName(m);
}

/** «Strasse 12, 9410 Heiden». Leere Teile entfallen. */
export function formatAddress(m: { street: string; houseNumber: string; zip: string; city: string; country?: string }): string {
  const street = [m.street, m.houseNumber].filter(Boolean).join(" ");
  const place = [m.zip, m.city].filter(Boolean).join(" ");
  const country = m.country && m.country !== "CH" ? m.country : "";
  return [street, place, country].filter(Boolean).join(", ");
}

/** Mehrzeilige Adresse (Rechnungs- und Briefkopf). */
export function formatAddressLines(m: { salutation?: string; firstName: string; lastName: string; street: string; houseNumber: string; zip: string; city: string; country?: string }): string[] {
  const lines = [`${m.firstName} ${m.lastName}`.trim(), [m.street, m.houseNumber].filter(Boolean).join(" "), [m.zip, m.city].filter(Boolean).join(" ")];
  if (m.country && m.country !== "CH") lines.push(m.country);
  return lines.filter(Boolean);
}

export const memberStatusLabel = (status: string): string => labelOf(MEMBER_STATUS_LABEL, status);

// ---- Statusübergänge ------------------------------------------------------------------------------------------------

export type MemberAction = "accept" | "reject" | "reinstate" | "exit" | "exit-withdraw" | "exit-complete" | "expel" | "deceased" | "anonymize";

type ActionState = { status: string; exitNoticeAt?: Date | null; anonymizedAt?: Date | null };

/** Welche Aktionen sind für ein Mitglied in diesem Zustand möglich? Die Datenschicht prüft dasselbe noch einmal vor dem Schreiben. */
export function availableActions(m: ActionState): MemberAction[] {
  if (m.anonymizedAt) return [];
  switch (m.status) {
    case "ANTRAG":
      return ["accept", "reject"];
    case "ABGELEHNT":
      return ["accept", "anonymize"];
    case "AKTIV":
      return m.exitNoticeAt ? ["exit-complete", "exit-withdraw", "expel", "deceased"] : ["exit", "expel", "deceased"];
    case "AUSGETRETEN":
    case "AUSGESCHLOSSEN":
      return ["reinstate", "anonymize"];
    case "VERSTORBEN":
      return ["anonymize"];
    default:
      return [];
  }
}

export const canDoAction = (m: ActionState, action: MemberAction): boolean => availableActions(m).includes(action);

/** Status vor dem die Aktion ausgeführt werden darf (für die atomare Prüfung beim Schreiben). */
export const ACTION_FROM_STATUSES: Record<Exclude<MemberAction, "anonymize">, readonly MemberStatus[]> = {
  accept: ["ANTRAG", "ABGELEHNT"],
  reject: ["ANTRAG"],
  reinstate: ["AUSGETRETEN", "AUSGESCHLOSSEN"],
  exit: ["AKTIV"],
  "exit-withdraw": ["AKTIV"],
  "exit-complete": ["AKTIV"],
  expel: ["AKTIV"],
  deceased: ["AKTIV"],
};

/** Ehemalige Personen (kein Mitglied mehr) und abgelehnte Anträge dürfen anonymisiert werden. */
export const ANONYMIZABLE_STATUSES: readonly string[] = ["ABGELEHNT", "AUSGETRETEN", "AUSGESCHLOSSEN", "VERSTORBEN"];

// ---- Austritt -------------------------------------------------------------------------------------------------------

export type ExitPlan = {
  /** Eingang der Austrittserklärung */
  noticeAt: Date;
  /** Frühestmöglicher Termin nach Regel (Einstellungen bzw. ZGB Art. 70 Abs. 2) */
  earliest: Date;
  /** Gewählter Austrittstermin (letzter Tag der Mitgliedschaft) */
  effective: Date;
  /** Der gewählte Termin liegt vor dem frühestmöglichen Termin (nur mit ausdrücklicher Bestätigung zulässig) */
  earlierThanRule: boolean;
};

/**
 * Plant den Austritt: `requested` ist der von Hand gewählte Termin (leer = frühestmöglicher Termin).
 * Ein Termin vor dem frühestmöglichen wird markiert; ob er zulässig ist, entscheidet der Vorstand (z. B. Einverständnis, abweichende Statuten).
 */
export function planExit(input: { noticeAt: Date; requested?: Date | null; rule: ExitRule; fiscal: FiscalStart }): ExitPlan {
  const noticeAt = toDateOnly(input.noticeAt);
  const earliest = earliestExitDate(noticeAt, input.rule, input.fiscal);
  const effective = input.requested ? toDateOnly(input.requested) : earliest;
  return { noticeAt, earliest, effective, earlierThanRule: effective.getTime() < earliest.getTime() };
}

/** Der Austritt ist wirksam geworden: der letzte Tag der Mitgliedschaft liegt vor `today`. */
export function isExitDue(m: { status: string; leftAt?: Date | null }, today: Date = todayZurich()): boolean {
  return m.status === "AKTIV" && !!m.leftAt && toDateOnly(m.leftAt).getTime() < toDateOnly(today).getTime();
}

/** Beschreibung der geltenden Austrittsregel als Hinweis («Statuten gehen vor»). */
export function describeExitRule(rule: ExitRule): string {
  const notice = rule.noticeMonths === 1 ? "einem Monat" : `${rule.noticeMonths} Monaten`;
  const base = EXIT_MODE_LABEL[rule.mode];
  return rule.mode === "JEDERZEIT"
    ? `${base}: Der Austritt wird nach ${notice} wirksam.`
    : `${base}, Austrittserklärung spätestens ${rule.noticeMonths === 0 ? "am letzten Tag" : `${notice} vorher`}.`;
}

// ---- Ämter ----------------------------------------------------------------------------------------------------------

/** Ämter des Vorstands (die Revisionsstelle und andere Ämter gehören nicht dazu), in der Anzeigereihenfolge. */
export const BOARD_OFFICE_KINDS = ["PRAESIDENT", "VIZEPRAESIDENT", "KASSIER", "AKTUAR", "BEISITZ"] as const;

export const isBoardOffice = (kind: string): boolean => (BOARD_OFFICE_KINDS as readonly string[]).includes(kind);

export function officeTitle(o: { kind: string; title: string }): string {
  return o.title.trim() || labelOf(OFFICE_KIND_LABEL, o.kind);
}

type OfficePeriod = { validFrom: Date; validUntil?: Date | null };

export type OfficeState = "LAUFEND" | "GEPLANT" | "BEENDET";

export function officeState(o: OfficePeriod, today: Date = todayZurich()): OfficeState {
  const t = toDateOnly(today).getTime();
  if (toDateOnly(o.validFrom).getTime() > t) return "GEPLANT";
  if (o.validUntil && toDateOnly(o.validUntil).getTime() < t) return "BEENDET";
  return "LAUFEND";
}

export const OFFICE_STATE_LABEL: Record<OfficeState, string> = { LAUFEND: "Laufend", GEPLANT: "Geplant", BEENDET: "Beendet" };

export function officePeriodLabel(o: OfficePeriod): string {
  return `${formatDateCh(o.validFrom)} – ${o.validUntil ? formatDateCh(o.validUntil) : "offen"}`;
}

/** Fehlertext, wenn die Amtszeit ungültig ist, sonst null. */
export function validateOfficePeriod(validFrom: Date, validUntil: Date | null | undefined): string | null {
  if (validUntil && toDateOnly(validUntil).getTime() < toDateOnly(validFrom).getTime()) return "Das Enddatum liegt vor dem Beginn.";
  return null;
}

/** Ämter, die in der Regel nur einmal besetzt sind. Eine zweite laufende Besetzung wird nur als Hinweis gemeldet. */
const SINGLE_SEAT: readonly OfficeKind[] = ["PRAESIDENT", "VIZEPRAESIDENT", "KASSIER", "AKTUAR"];

export function overlapsPeriod(a: OfficePeriod, b: OfficePeriod): boolean {
  const aEnd = a.validUntil ? toDateOnly(a.validUntil).getTime() : Infinity;
  const bEnd = b.validUntil ? toDateOnly(b.validUntil).getTime() : Infinity;
  return toDateOnly(a.validFrom).getTime() <= bEnd && toDateOnly(b.validFrom).getTime() <= aEnd;
}

/** Hinweis, wenn ein Amt mit Einzelbesetzung gleichzeitig mehrfach besetzt würde; sonst null. */
export function singleSeatWarning(candidate: OfficePeriod & { kind: string; id?: string }, existing: ReadonlyArray<OfficePeriod & { kind: string; id: string }>): string | null {
  if (!(SINGLE_SEAT as readonly string[]).includes(candidate.kind)) return null;
  const clash = existing.some((o) => o.id !== candidate.id && o.kind === candidate.kind && overlapsPeriod(o, candidate));
  return clash ? `Das Amt «${labelOf(OFFICE_KIND_LABEL, candidate.kind)}» ist in diesem Zeitraum bereits besetzt. Bitte die Amtszeiten prüfen.` : null;
}

export type OfficeRow = { id: string; kind: string; title: string; validFrom: Date; validUntil: Date | null; memberId: string };

/** Gruppiert Ämter: laufender Vorstand, laufende Revisionsstelle, übrige laufende Ämter, geplante und frühere. */
export function groupOffices<T extends OfficeRow>(offices: readonly T[], today: Date = todayZurich()) {
  const sortFrom = (a: T, b: T) => toDateOnly(b.validFrom).getTime() - toDateOnly(a.validFrom).getTime();
  const current = offices.filter((o) => officeState(o, today) === "LAUFEND");
  const order = (kind: string) => {
    const i = BOARD_OFFICE_KINDS.indexOf(kind as (typeof BOARD_OFFICE_KINDS)[number]);
    return i < 0 ? 99 : i;
  };
  return {
    board: current.filter((o) => isBoardOffice(o.kind)).sort((a, b) => order(a.kind) - order(b.kind) || sortFrom(a, b)),
    auditors: current.filter((o) => o.kind === "REVISOR").sort(sortFrom),
    other: current.filter((o) => !isBoardOffice(o.kind) && o.kind !== "REVISOR").sort(sortFrom),
    planned: offices.filter((o) => officeState(o, today) === "GEPLANT").sort(sortFrom),
    past: offices.filter((o) => officeState(o, today) === "BEENDET").sort(sortFrom),
  };
}

const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

/**
 * Vergleicht den Vorstand in der Verwaltung mit den Personen auf der Über-uns-Seite (nur als Hinweis; die Website wird nie automatisch geändert).
 * Verglichen werden die Namen (ohne Gross-/Kleinschreibung und Akzente).
 */
export function compareBoardWithWebsite(boardNames: readonly string[], websiteNames: readonly string[]): { missingOnWebsite: string[]; notInRecords: string[]; matches: boolean } {
  const site = new Set(websiteNames.map(norm));
  const rec = new Set(boardNames.map(norm));
  const missingOnWebsite = [...new Set(boardNames)].filter((n) => !site.has(norm(n)));
  const notInRecords = [...new Set(websiteNames)].filter((n) => !rec.has(norm(n)));
  return { missingOnWebsite, notInRecords, matches: missingOnWebsite.length === 0 && notInRecords.length === 0 };
}

// ---- Verknüpfung mit dem Website-Konto -------------------------------------------------------------------------------

/**
 * Darf ein Website-Konto automatisch mit einem Mitglied verknüpft werden? Nur wenn
 *  - das Konto bestätigt (emailVerifiedAt) und nicht gesperrt ist,
 *  - die E-Mail-Adressen (ohne Gross-/Kleinschreibung) übereinstimmen,
 *  - das Mitglied noch kein Konto hat und aktuell Mitglied ist (Status AKTIV; ein Antrag wird nie automatisch verknüpft).
 * Die Angaben in einem Antrag allein genügen nie.
 */
export function canAutoLink(
  user: { email: string; emailVerifiedAt: Date | null; disabled?: boolean },
  member: { email: string; userId: string | null; status: string },
): boolean {
  if (!user.emailVerifiedAt || user.disabled) return false;
  if (member.userId) return false;
  if (member.status !== "AKTIV") return false;
  const a = user.email.trim().toLowerCase();
  const b = member.email.trim().toLowerCase();
  return a !== "" && a === b;
}

// ---- Anonymisierung ----------------------------------------------------------------------------------------------------

/** Felder, die beim Entfernen der Personendaten geleert werden (Mitgliedernummer, Status, Eintritts- und Austrittsdatum bleiben). */
export function anonymizedFields(at: Date) {
  return {
    salutation: "",
    firstName: "",
    lastName: ANONYMIZED_LAST_NAME,
    birthDate: null,
    street: "",
    houseNumber: "",
    zip: "",
    city: "",
    country: "CH",
    email: "",
    phone: "",
    exitReason: "",
    boardNotes: "",
    userId: null,
    anonymizedAt: at,
  } as const;
}

// ---- Protokoll ---------------------------------------------------------------------------------------------------------

/**
 * Felder, deren Inhalt nicht im Änderungsprotokoll stehen soll (das Protokoll lesen auch Rollen ohne Zugriff auf Mitglieder, z. B. die
 * Revisionsstelle). Im Protokoll steht nur, dass sie geändert wurden.
 */
export const AUDIT_MASKED_MEMBER_FIELDS = ["boardNotes", "birthDate", "street", "houseNumber", "zip", "city", "phone", "email", "exitReason"] as const;

type Plain = Record<string, unknown>;

function sameValue(a: unknown, b: unknown): boolean {
  if (a instanceof Date && b instanceof Date) return a.getTime() === b.getTime();
  return a === b;
}

/** Nur die geänderten Felder, Inhalte der sensiblen Felder durch einen Vermerk ersetzt. */
export function memberAuditDiff(before: Plain, after: Plain): { before: Plain; after: Plain } {
  const masked = new Set<string>(AUDIT_MASKED_MEMBER_FIELDS);
  const ignore = new Set(["updatedAt", "createdAt", "id"]);
  const b: Plain = {};
  const a: Plain = {};
  for (const key of new Set([...Object.keys(before), ...Object.keys(after)])) {
    if (ignore.has(key)) continue;
    if (sameValue(before[key], after[key])) continue;
    if (masked.has(key)) {
      b[key] = "[Inhalt nicht protokolliert]";
      a[key] = "[geändert]";
    } else {
      if (before[key] !== undefined) b[key] = before[key];
      if (after[key] !== undefined) a[key] = after[key];
    }
  }
  return { before: b, after: a };
}

// ---- Export (Mitgliederliste) -----------------------------------------------------------------------------------------

export const MEMBER_CSV_HEADERS = [
  "Nr.",
  "Anrede",
  "Vorname",
  "Nachname",
  "Strasse",
  "Hausnummer",
  "PLZ",
  "Ort",
  "Land",
  "E-Mail",
  "Telefon",
  "Mitgliedschaftsart",
  "Status",
  "Antrag am",
  "Eintritt",
  "Austritt",
  "Kontakt bevorzugt",
] as const;

export type MemberExportRow = {
  memberNumber: number;
  salutation: string;
  firstName: string;
  lastName: string;
  street: string;
  houseNumber: string;
  zip: string;
  city: string;
  country: string;
  email: string;
  phone: string;
  status: string;
  applicationAt: Date;
  joinedAt: Date | null;
  leftAt: Date | null;
  communicationPref: string;
  anonymizedAt: Date | null;
  membershipTypeName: string;
};

/** Zeilen für csvResponse. Geburtsdatum und Vorstandsnotizen gehören nie in die Liste (Datensparsamkeit). */
export function memberCsvRows(rows: readonly MemberExportRow[]): Array<Array<string | number | Date | null>> {
  return rows.map((m) => [
    m.memberNumber,
    labelOf(SALUTATION_LABEL, m.salutation) === "Keine Angabe" ? "" : labelOf(SALUTATION_LABEL, m.salutation),
    m.anonymizedAt ? "" : m.firstName,
    m.anonymizedAt ? ANONYMIZED_LAST_NAME : m.lastName,
    m.street,
    m.houseNumber,
    m.zip,
    m.city,
    m.country,
    m.email,
    m.phone,
    m.membershipTypeName,
    memberStatusLabel(m.status),
    m.applicationAt,
    m.joinedAt,
    m.leftAt,
    labelOf(COMMUNICATION_PREF_LABEL, m.communicationPref),
  ]);
}

// ---- Auskunft (revDSG Art. 25) -----------------------------------------------------------------------------------------

export type DisclosureInput = {
  generatedAt: Date;
  member: {
    memberNumber: number;
    salutation: string;
    firstName: string;
    lastName: string;
    birthDate: Date | null;
    street: string;
    houseNumber: string;
    zip: string;
    city: string;
    country: string;
    email: string;
    phone: string;
    status: string;
    applicationAt: Date;
    joinedAt: Date | null;
    exitNoticeAt: Date | null;
    leftAt: Date | null;
    exitReason: string;
    consentAt: Date | null;
    communicationPref: string;
    hasBoardNotes: boolean;
    membershipTypeName: string;
    hasAccount: boolean;
  };
  offices: ReadonlyArray<{ kind: string; title: string; validFrom: Date; validUntil: Date | null }>;
  invoices: ReadonlyArray<{ number: string; subject: string; issueDate: Date; dueDate: Date; totalRappen: number; paidRappen: number; status: string }>;
  payments: ReadonlyArray<{ receivedAt: Date; amountRappen: number; method: string; invoiceNumber: string | null }>;
  attendances: ReadonlyArray<{ meetingTitle: string; startsAt: Date; status: string }>;
  registrations: ReadonlyArray<{ eventTitle: string; startsAt: Date; seats: number; status: string }>;
};

export type Disclosure = {
  hinweis: string;
  erstelltAm: string;
  stammdaten: Record<string, string | number | boolean | null>;
  aemter: Array<{ amt: string; von: string; bis: string }>;
  rechnungen: Array<{ nummer: string; betreff: string; datum: string; faellig: string; betragChf: string; bezahltChf: string; status: string }>;
  zahlungen: Array<{ datum: string; betragChf: string; art: string; rechnung: string }>;
  versammlungen: Array<{ versammlung: string; datum: string; teilnahme: string }>;
  anmeldungenAnlaesse: Array<{ anlass: string; datum: string; plaetze: number; status: string }>;
};

const date = (d: Date | null): string => (d ? formatDateCh(d) : "");

/** Stellt die gespeicherten Personendaten eines Mitglieds für die Auskunft zusammen (JSON bzw. CSV). Ohne interne Notizen und ohne Passwörter. */
export function buildDisclosure(input: DisclosureInput): Disclosure {
  const m = input.member;
  return {
    hinweis:
      "Auskunft über die zu deiner Person gespeicherten Daten. Interne Notizen des Vorstands und Einträge des Änderungsprotokolls sind nicht enthalten; weitere Auskünfte erteilt der Vorstand auf Anfrage.",
    erstelltAm: formatDateTimeCh(input.generatedAt),
    stammdaten: {
      Mitgliedernummer: m.memberNumber,
      Anrede: m.salutation ? labelOf(SALUTATION_LABEL, m.salutation) : "",
      Vorname: m.firstName,
      Nachname: m.lastName,
      Geburtsdatum: date(m.birthDate),
      Strasse: m.street,
      Hausnummer: m.houseNumber,
      PLZ: m.zip,
      Ort: m.city,
      Land: m.country,
      "E-Mail": m.email,
      Telefon: m.phone,
      Mitgliedschaftsart: m.membershipTypeName,
      Status: memberStatusLabel(m.status),
      "Antrag am": date(m.applicationAt),
      Eintritt: date(m.joinedAt),
      "Austrittserklärung am": date(m.exitNoticeAt),
      Austritt: date(m.leftAt),
      "Grund des Austritts": m.exitReason,
      "Einwilligung (Statuten und Datenschutz) am": m.consentAt ? formatDateTimeCh(m.consentAt) : "",
      "Kontakt bevorzugt": labelOf(COMMUNICATION_PREF_LABEL, m.communicationPref),
      "Mit Website-Konto verknüpft": m.hasAccount,
      "Interne Notizen vorhanden": m.hasBoardNotes,
    },
    aemter: input.offices.map((o) => ({ amt: officeTitle(o), von: date(o.validFrom), bis: o.validUntil ? date(o.validUntil) : "offen" })),
    rechnungen: input.invoices.map((i) => ({
      nummer: i.number,
      betreff: i.subject,
      datum: date(i.issueDate),
      faellig: date(i.dueDate),
      betragChf: formatChf(i.totalRappen),
      bezahltChf: formatChf(i.paidRappen),
      status: i.status,
    })),
    zahlungen: input.payments.map((p) => ({ datum: date(p.receivedAt), betragChf: formatChf(p.amountRappen), art: p.method, rechnung: p.invoiceNumber ?? "" })),
    versammlungen: input.attendances.map((a) => ({ versammlung: a.meetingTitle, datum: date(a.startsAt), teilnahme: a.status })),
    anmeldungenAnlaesse: input.registrations.map((r) => ({ anlass: r.eventTitle, datum: date(r.startsAt), plaetze: r.seats, status: r.status })),
  };
}

/** Auskunft als CSV-Zeilen «Bereich; Eintrag; Feld; Wert». */
export function disclosureCsvRows(d: Disclosure): Array<[string, string, string, string]> {
  const rows: Array<[string, string, string, string]> = [["Allgemein", "", "Hinweis", d.hinweis], ["Allgemein", "", "Erstellt am", d.erstelltAm]];
  for (const [k, v] of Object.entries(d.stammdaten)) rows.push(["Stammdaten", "", k, typeof v === "boolean" ? (v ? "Ja" : "Nein") : String(v ?? "")]);
  const section = (name: string, list: ReadonlyArray<Record<string, string | number>>) => {
    list.forEach((item, i) => {
      for (const [k, v] of Object.entries(item)) rows.push([name, String(i + 1), k, String(v)]);
    });
  };
  section("Ämter", d.aemter);
  section("Rechnungen", d.rechnungen);
  section("Zahlungen", d.zahlungen);
  section("Versammlungen", d.versammlungen);
  section("Anmeldungen Anlässe", d.anmeldungenAnlaesse);
  return rows;
}
