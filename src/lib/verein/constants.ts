// Wertelisten und deutsche Bezeichnungen der Vereinsverwaltung. Die Datenbank speichert Strings (provider-neutral);
// Zod-Schemas der Module verwenden diese Listen. Reine Daten ohne Seiteneffekte (auch im Browser nutzbar).

/** Hilfsfunktion: Bezeichnung nachschlagen, sonst den Rohwert zeigen. */
export function labelOf<T extends string>(map: Readonly<Record<T, string>>, value: string): string {
  return (map as Readonly<Record<string, string>>)[value] ?? value;
}

// ---- Mitglieder ----------------------------------------------------------------------------------------------------
export const SALUTATIONS = ["", "FRAU", "HERR"] as const;
export type Salutation = (typeof SALUTATIONS)[number];
export const SALUTATION_LABEL: Record<Salutation, string> = { "": "Keine Angabe", FRAU: "Frau", HERR: "Herr" };

export const MEMBER_STATUSES = ["ANTRAG", "ABGELEHNT", "AKTIV", "AUSGETRETEN", "AUSGESCHLOSSEN", "VERSTORBEN"] as const;
export type MemberStatus = (typeof MEMBER_STATUSES)[number];
export const MEMBER_STATUS_LABEL: Record<MemberStatus, string> = {
  ANTRAG: "Antrag",
  ABGELEHNT: "Abgelehnt",
  AKTIV: "Aktiv",
  AUSGETRETEN: "Ausgetreten",
  AUSGESCHLOSSEN: "Ausgeschlossen",
  VERSTORBEN: "Verstorben",
};
/** Status, in dem eine Person (noch) Mitglied ist: Beiträge, Stimmrecht, Einladungen. */
export const CURRENT_MEMBER_STATUSES = ["AKTIV"] as const satisfies readonly MemberStatus[];
/** Status, nach denen eine Person nicht mehr Mitglied ist (Aufbewahrung nur noch soweit nötig). */
export const FORMER_MEMBER_STATUSES = ["AUSGETRETEN", "AUSGESCHLOSSEN", "VERSTORBEN"] as const satisfies readonly MemberStatus[];

export const COMMUNICATION_PREFS = ["EMAIL", "POST"] as const;
export type CommunicationPref = (typeof COMMUNICATION_PREFS)[number];
export const COMMUNICATION_PREF_LABEL: Record<CommunicationPref, string> = { EMAIL: "Per E-Mail", POST: "Per Post" };

export const OFFICE_KINDS = ["PRAESIDENT", "VIZEPRAESIDENT", "KASSIER", "AKTUAR", "REVISOR", "BEISITZ", "SONSTIGES"] as const;
export type OfficeKind = (typeof OFFICE_KINDS)[number];
export const OFFICE_KIND_LABEL: Record<OfficeKind, string> = {
  PRAESIDENT: "Präsident/in",
  VIZEPRAESIDENT: "Vize-Präsident/in",
  KASSIER: "Kassier/in",
  AKTUAR: "Aktuar/in",
  REVISOR: "Revisor/in",
  BEISITZ: "Beisitz",
  SONSTIGES: "Anderes Amt",
};

// ---- Beiträge und Rechnungen -------------------------------------------------------------------------------------
export const INVOICE_STATUSES = ["ENTWURF", "OFFEN", "BEZAHLT", "STORNIERT"] as const;
export type InvoiceStatus = (typeof INVOICE_STATUSES)[number];
export const INVOICE_STATUS_LABEL: Record<InvoiceStatus, string> = {
  ENTWURF: "Entwurf",
  OFFEN: "Offen",
  BEZAHLT: "Bezahlt",
  STORNIERT: "Storniert",
};

export const PAYMENT_METHODS = ["UEBERWEISUNG", "BAR", "TWINT", "ANDERE"] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];
export const PAYMENT_METHOD_LABEL: Record<PaymentMethod, string> = {
  UEBERWEISUNG: "Überweisung",
  BAR: "Bar",
  TWINT: "TWINT",
  ANDERE: "Andere",
};

/** Höchste Mahnstufe (Stufe 0 = nicht gemahnt). */
export const MAX_REMINDER_LEVEL = 3;
export const REMINDER_LEVEL_LABEL: Record<number, string> = { 0: "Nicht gemahnt", 1: "1. Mahnung", 2: "2. Mahnung", 3: "3. Mahnung" };

// ---- Kasse -----------------------------------------------------------------------------------------------------
export const ACCOUNT_KINDS = ["EINNAHMEN", "AUSGABEN", "VERMOEGEN"] as const;
export type AccountKind = (typeof ACCOUNT_KINDS)[number];
export const ACCOUNT_KIND_LABEL: Record<AccountKind, string> = { EINNAHMEN: "Einnahmen", AUSGABEN: "Ausgaben", VERMOEGEN: "Vermögen" };

export const TRANSACTION_DIRECTIONS = ["EINNAHME", "AUSGABE", "UMBUCHUNG"] as const;
export type TransactionDirection = (typeof TRANSACTION_DIRECTIONS)[number];
export const TRANSACTION_DIRECTION_LABEL: Record<TransactionDirection, string> = { EINNAHME: "Einnahme", AUSGABE: "Ausgabe", UMBUCHUNG: "Umbuchung" };

export const TRANSACTION_SOURCES = ["MANUELL", "ZAHLUNG", "STORNO"] as const;
export type TransactionSource = (typeof TRANSACTION_SOURCES)[number];
export const TRANSACTION_SOURCE_LABEL: Record<TransactionSource, string> = { MANUELL: "Manuell", ZAHLUNG: "Aus Zahlungseingang", STORNO: "Gegenbuchung" };

// ---- Versammlungen -----------------------------------------------------------------------------------------------
export const MEETING_KINDS = ["MITGLIEDERVERSAMMLUNG", "VORSTANDSSITZUNG", "AUSSERORDENTLICH"] as const;
export type MeetingKind = (typeof MEETING_KINDS)[number];
export const MEETING_KIND_LABEL: Record<MeetingKind, string> = {
  MITGLIEDERVERSAMMLUNG: "Mitgliederversammlung",
  VORSTANDSSITZUNG: "Vorstandssitzung",
  AUSSERORDENTLICH: "Ausserordentliche Versammlung",
};

export const MEETING_STATUSES = ["GEPLANT", "EINGELADEN", "DURCHGEFUEHRT", "ABGESAGT"] as const;
export type MeetingStatus = (typeof MEETING_STATUSES)[number];
export const MEETING_STATUS_LABEL: Record<MeetingStatus, string> = {
  GEPLANT: "Geplant",
  EINGELADEN: "Eingeladen",
  DURCHGEFUEHRT: "Durchgeführt",
  ABGESAGT: "Abgesagt",
};

export const ATTENDANCE_STATUSES = ["ANWESEND", "ENTSCHULDIGT", "ABWESEND"] as const;
export type AttendanceStatus = (typeof ATTENDANCE_STATUSES)[number];
export const ATTENDANCE_STATUS_LABEL: Record<AttendanceStatus, string> = { ANWESEND: "Anwesend", ENTSCHULDIGT: "Entschuldigt", ABWESEND: "Abwesend" };

export const RESOLUTION_RESULTS = ["ANGENOMMEN", "ABGELEHNT", "VERSCHOBEN"] as const;
export type ResolutionResult = (typeof RESOLUTION_RESULTS)[number];
export const RESOLUTION_RESULT_LABEL: Record<ResolutionResult, string> = { ANGENOMMEN: "Angenommen", ABGELEHNT: "Abgelehnt", VERSCHOBEN: "Verschoben" };

// ---- Anlässe -----------------------------------------------------------------------------------------------------
export const EVENT_STATUSES = ["ENTWURF", "VEROEFFENTLICHT", "ABGESAGT"] as const;
export type EventStatus = (typeof EVENT_STATUSES)[number];
export const EVENT_STATUS_LABEL: Record<EventStatus, string> = { ENTWURF: "Entwurf", VEROEFFENTLICHT: "Veröffentlicht", ABGESAGT: "Abgesagt" };

export const REGISTRATION_STATUSES = ["UNBESTAETIGT", "ANGEMELDET", "WARTELISTE", "ABGESAGT"] as const;
export type RegistrationStatus = (typeof REGISTRATION_STATUSES)[number];
export const REGISTRATION_STATUS_LABEL: Record<RegistrationStatus, string> = { UNBESTAETIGT: "E-Mail noch nicht bestätigt", ANGEMELDET: "Angemeldet", WARTELISTE: "Warteliste", ABGESAGT: "Abgemeldet" };

// ---- Dokumente und Aufgaben --------------------------------------------------------------------------------------
export const DOCUMENT_CATEGORIES = ["STATUTEN", "REGLEMENT", "PROTOKOLL", "FINANZEN", "SONSTIGES"] as const;
export type DocumentCategory = (typeof DOCUMENT_CATEGORIES)[number];
export const DOCUMENT_CATEGORY_LABEL: Record<DocumentCategory, string> = {
  STATUTEN: "Statuten",
  REGLEMENT: "Reglemente",
  PROTOKOLL: "Protokolle",
  FINANZEN: "Finanzen",
  SONSTIGES: "Sonstiges",
};

export const DOCUMENT_VISIBILITIES = ["OEFFENTLICH", "MITGLIEDER", "VORSTAND"] as const;
export type DocumentVisibility = (typeof DOCUMENT_VISIBILITIES)[number];
export const DOCUMENT_VISIBILITY_LABEL: Record<DocumentVisibility, string> = {
  OEFFENTLICH: "Öffentlich",
  MITGLIEDER: "Nur Mitglieder",
  VORSTAND: "Nur Vorstand",
};

export const TASK_STATUSES = ["OFFEN", "IN_ARBEIT", "ERLEDIGT"] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];
export const TASK_STATUS_LABEL: Record<TaskStatus, string> = { OFFEN: "Offen", IN_ARBEIT: "In Arbeit", ERLEDIGT: "Erledigt" };

export const TASK_PRIORITIES = ["NIEDRIG", "NORMAL", "HOCH"] as const;
export type TaskPriority = (typeof TASK_PRIORITIES)[number];
export const TASK_PRIORITY_LABEL: Record<TaskPriority, string> = { NIEDRIG: "Niedrig", NORMAL: "Normal", HOCH: "Hoch" };

// ---- Newsletter-Segmente -----------------------------------------------------------------------------------------
export const NEWSLETTER_SEGMENTS = ["ALL", "MEMBERS", "MEMBERSHIP_TYPE"] as const;
export type NewsletterSegment = (typeof NEWSLETTER_SEGMENTS)[number];
export const NEWSLETTER_SEGMENT_LABEL: Record<NewsletterSegment, string> = {
  ALL: "Alle Abonnenten",
  MEMBERS: "Aktive Mitglieder",
  MEMBERSHIP_TYPE: "Mitglieder einer Mitgliedschaftsart",
};

// ---- Audit -----------------------------------------------------------------------------------------------------
export const AUDIT_ACTOR_TYPES = ["ADMIN", "MEMBER", "SYSTEM"] as const;
export type AuditActorType = (typeof AUDIT_ACTOR_TYPES)[number];

// ---- Darstellung (Tailwind, wie die bestehenden Status-Pillen im Admin) ---------------------------------------------
export type Tone = "green" | "amber" | "rose" | "sky" | "indigo" | "zinc";
/** Klassen für eine Pille: `cn(PILL, TONE_CLASS[tone])` (PILL aus @/components/admin/core/styles). */
export const TONE_CLASS: Record<Tone, string> = {
  green: "bg-emerald-500/10 text-emerald-300 ring-emerald-500/30",
  amber: "bg-amber-500/10 text-amber-300 ring-amber-500/30",
  rose: "bg-rose-500/10 text-rose-300 ring-rose-500/30",
  sky: "bg-sky-500/10 text-sky-300 ring-sky-500/30",
  indigo: "bg-indigo-500/10 text-indigo-300 ring-indigo-500/30",
  zinc: "bg-zinc-800/80 text-zinc-400 ring-zinc-700",
};

export const MEMBER_STATUS_TONE: Record<MemberStatus, Tone> = {
  ANTRAG: "amber",
  ABGELEHNT: "zinc",
  AKTIV: "green",
  AUSGETRETEN: "zinc",
  AUSGESCHLOSSEN: "rose",
  VERSTORBEN: "zinc",
};
export const INVOICE_STATUS_TONE: Record<InvoiceStatus, Tone> = { ENTWURF: "zinc", OFFEN: "amber", BEZAHLT: "green", STORNIERT: "rose" };
export const MEETING_STATUS_TONE: Record<MeetingStatus, Tone> = { GEPLANT: "indigo", EINGELADEN: "sky", DURCHGEFUEHRT: "green", ABGESAGT: "zinc" };
export const EVENT_STATUS_TONE: Record<EventStatus, Tone> = { ENTWURF: "zinc", VEROEFFENTLICHT: "green", ABGESAGT: "rose" };
export const REGISTRATION_STATUS_TONE: Record<RegistrationStatus, Tone> = { UNBESTAETIGT: "sky", ANGEMELDET: "green", WARTELISTE: "amber", ABGESAGT: "zinc" };
export const TASK_STATUS_TONE: Record<TaskStatus, Tone> = { OFFEN: "amber", IN_ARBEIT: "sky", ERLEDIGT: "green" };
export const TASK_PRIORITY_TONE: Record<TaskPriority, Tone> = { NIEDRIG: "zinc", NORMAL: "sky", HOCH: "rose" };
export const DOCUMENT_VISIBILITY_TONE: Record<DocumentVisibility, Tone> = { OEFFENTLICH: "green", MITGLIEDER: "sky", VORSTAND: "indigo" };
