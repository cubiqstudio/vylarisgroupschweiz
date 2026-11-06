// Darstellung des Änderungsprotokolls: lesbare Bezeichnungen für Aktionen, Objekte und Felder sowie die Gegenüberstellung
// «vorher → nachher». Reine Funktionen ohne Seiteneffekte (Tests: scripts/test/overview.test.mts); Abfragen: ./audit-data.ts.
import { formatDateCh, formatDateTimeCh } from "./dates";
import { formatChf } from "./money";

export const AUDIT_OBJECT_LABEL: Record<string, string> = {
  Member: "Mitglied",
  MembershipType: "Mitgliedschaftsart",
  Office: "Amt",
  Invoice: "Rechnung",
  Payment: "Zahlung",
  FeePeriod: "Beitragsjahr",
  Reminder: "Mahnung",
  Transaction: "Buchung",
  AccountCategory: "Konto",
  Budget: "Budget",
  Receipt: "Beleg",
  FiscalYear: "Geschäftsjahr",
  Meeting: "Versammlung",
  AgendaItem: "Traktandum",
  Resolution: "Beschluss",
  Event: "Anlass",
  EventRegistration: "Anmeldung",
  Document: "Dokument",
  BoardTask: "Aufgabe",
  VereinSettings: "Vereinseinstellungen",
  VereinProfile: "Vereinsstammdaten",
  AdminUser: "Zugang",
  NewsletterCampaign: "Newsletter",
  NewsletterSubscriber: "Newsletter-Abonnent",
  SiteSetting: "Systemeinstellung",
  User: "Website-Konto",
  MinutesRevision: "Protokollfassung",
};

/** Bezeichnung des Objekttyps (unbekannte Typen erscheinen unverändert). */
export const auditObjectLabel = (type: string): string => AUDIT_OBJECT_LABEL[type] ?? type;

const PREFIX_LABEL: Record<string, string> = {
  member: "Mitglied",
  membertype: "Mitgliedschaftsart",
  office: "Amt",
  invoice: "Rechnung",
  payment: "Zahlung",
  period: "Beitragsjahr",
  reminder: "Mahnung",
  transaction: "Buchung",
  account: "Konto",
  budget: "Budget",
  receipt: "Beleg",
  fiscalyear: "Geschäftsjahr",
  meeting: "Versammlung",
  agenda: "Traktandum",
  resolution: "Beschluss",
  event: "Anlass",
  registration: "Anmeldung",
  document: "Dokument",
  task: "Aufgabe",
  settings: "Einstellungen",
  role: "Rolle",
  permissions: "Rollen und Rechte",
  access: "Zugang",
  export: "Export",
  newsletter: "Newsletter",
  user: "Website-Konto",
};

const VERB_LABEL: Record<string, string> = {
  create: "angelegt",
  update: "geändert",
  delete: "gelöscht",
  cancel: "storniert",
  paid: "als bezahlt erfasst",
  run: "Rechnungslauf",
  send: "versendet",
  link: "mit Konto verknüpft",
  unlink: "Konto gelöst",
  exit: "Austritt erfasst",
  anonymize: "Personendaten entfernt",
  reverse: "Gegenbuchung",
  book: "gebucht",
  lock: "abgeschlossen",
  unlock: "wieder geöffnet",
  approve: "genehmigt",
  unapprove: "Genehmigung aufgehoben",
  amend: "nachträglich geändert",
  attendance: "Anwesenheit erfasst",
  add: "hinzugefügt",
  version: "neue Fassung",
  remind: "Erinnerung gesendet",
  reminders: "Erinnerungen gesendet",
  resend: "erneut gesendet",
  template: "Standardkonten angelegt",
  change: "geändert",
  reset: "zurückgesetzt",
};

/** Ausdrücklich benannte Aktionen, die sich nicht aus Objekt und Verb zusammensetzen lassen. */
const ACTION_LABEL: Record<string, string> = {
  "settings.update": "Einstellungen geändert",
  "settings.mail": "Mailserver-Einstellungen geändert",
  "settings.legal": "Rechtliches geändert",
  "settings.registration": "Registrierung ein- oder ausgeschaltet",
  "user.update": "Website-Konto geändert",
  "user.verify": "Website-Konto von Hand bestätigt",
  "user.delete": "Website-Konto gelöscht",
  "export.newsletter": "Newsletter-Abonnenten exportiert",
  "member.card.reissue": "Ausweis neu ausgestellt",
  "role.change": "Rolle geändert",
  "permissions.update": "Rollen und Rechte geändert",
  "access.create": "Zugang angelegt",
  "access.update": "Zugang geändert",
  "access.delete": "Zugang gelöscht",
  "access.password-reset": "Passwort zurückgesetzt",
  "member.exit.complete": "Austritt vollzogen",
  "meeting.minutes.approve": "Protokoll genehmigt",
  "meeting.minutes.unapprove": "Genehmigung des Protokolls aufgehoben",
  "meeting.minutes.amend": "Protokoll nachträglich geändert",
  "export.members": "Mitgliederliste exportiert",
  "export.disclosure": "Auskunft über eigene Daten bezogen",
  "export.ledger": "Kasse exportiert",
  "export.invoices": "Rechnungen exportiert",
  "export.registrations": "Anmeldungen exportiert",
  "registration.confirm": "Anmeldung: E-Mail-Adresse von Hand bestätigt",
  "registration.purge": "Anmeldung: unbestätigte, abgelaufene gelöscht",
  "registration.anonymize": "Anmeldungen: Angaben von Gästen nach dem Anlass entfernt",
  "registration.guest-delete": "Anmeldung eines Gasts auf Anfrage gelöscht",
  "export.guest-disclosure": "Auskunft über Gast-Anmeldungen bezogen",
  "export.audit": "Änderungsprotokoll exportiert",
  "invoice.run": "Rechnungslauf durchgeführt",
  "invoice.paid": "Rechnung als bezahlt erfasst",
  "reminder.send": "Mahnung versendet",
  "reminder.resend": "Mahnung erneut versendet",
  "payment.book": "Zahlung gebucht",
  "transaction.reverse": "Gegenbuchung erstellt",
  "account.template": "Standardkonten angelegt",
  "fiscalyear.lock": "Geschäftsjahr abgeschlossen",
  "fiscalyear.unlock": "Geschäftsjahr wieder geöffnet",
  "fiscalyear.approve": "Jahresrechnung genehmigt",
  "fiscalyear.unapprove": "Genehmigung der Jahresrechnung aufgehoben",
  approve: "Genehmigt",
};

/** Lesbare Bezeichnung einer Aktion, z. B. «member.exit» → «Mitglied: Austritt erfasst». Unbekanntes erscheint unverändert. */
export function auditActionLabel(action: string): string {
  const explicit = ACTION_LABEL[action];
  if (explicit) return explicit;
  const dot = action.indexOf(".");
  if (dot < 0) return action;
  const prefix = PREFIX_LABEL[action.slice(0, dot)];
  const verb = VERB_LABEL[action.slice(dot + 1)];
  return prefix && verb ? `${prefix}: ${verb}` : action;
}

/** Feldbezeichnungen für Vorher/Nachher (Vereinseinstellungen, Stammdaten, Zugänge, häufige Felder anderer Module). */
export const AUDIT_FIELD_LABEL: Record<string, string> = {
  // Vereinseinstellungen
  accountHolder: "Kontoinhaber",
  iban: "IBAN",
  qrIban: "QR-IBAN",
  bank: "Bank",
  paymentDays: "Zahlungsfrist (Tage)",
  reminderAfterDays: "Tage bis zur 1. Mahnung",
  reminderDays1: "Frist 1. Mahnung (Tage)",
  reminderDays2: "Frist 2. Mahnung (Tage)",
  reminderDays3: "Frist 3. Mahnung (Tage)",
  reminderFee1Rappen: "Mahngebühr 1. Mahnung",
  reminderFee2Rappen: "Mahngebühr 2. Mahnung",
  reminderFee3Rappen: "Mahngebühr 3. Mahnung",
  fiscalStartMonth: "Geschäftsjahr: Beginn (Monat)",
  fiscalStartDay: "Geschäftsjahr: Beginn (Tag)",
  invitationDays: "Einladungsfrist (Tage)",
  exitMode: "Austrittsregel",
  exitNoticeMonths: "Kündigungsfrist (Monate)",
  senderName: "Absendername",
  senderSignature: "Signatur",
  invoiceMailIntro: "Einleitung Rechnungsmail",
  reminderMailIntro: "Einleitung Mahnung",
  invitationMailIntro: "Einleitung Einladung",
  welcomeMailText: "Willkommenstext",
  replyToEmail: "Antwortadresse",
  applyEnabled: "Beitrittsformular",
  applyNotifyEmail: "Benachrichtigung bei Anträgen",
  // Stammdaten
  name: "Name",
  seat: "Sitz",
  foundedOn: "Gegründet am",
  purpose: "Zweck",
  uid: "UID",
  register: "Handelsregister",
  // Zugänge
  email: "E-Mail",
  role: "Hauptrolle",
  extraRoles: "Zusatzrollen",
  memberId: "Verknüpftes Mitglied",
  // häufige Felder
  status: "Status",
  title: "Titel",
  amountRappen: "Betrag",
  totalRappen: "Total",
  paidRappen: "Bezahlt",
  firstName: "Vorname",
  lastName: "Nachname",
  membershipTypeId: "Mitgliedschaftsart",
  dueDate: "Fällig am",
  leftAt: "Austritt am",
  joinedAt: "Eintritt am",
};

export const auditFieldLabel = (field: string): string => AUDIT_FIELD_LABEL[field] ?? field;

/** Liest einen JSON-Text des Protokolls; null bei leerem oder ungültigem Text. Nur Objekte werden als Feldliste interpretiert. */
export function parseAuditJson(text: string | null | undefined): Record<string, unknown> | null {
  if (!text) return null;
  try {
    const value: unknown = JSON.parse(text);
    return value !== null && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/;

/** Wert für die Anzeige: Beträge in CHF, Datum Schweizer Schreibweise, ja/nein, leer als «–». */
export function formatAuditValue(field: string, value: unknown): string {
  if (value === null || value === undefined || value === "") return "–";
  if (typeof value === "boolean") return value ? "ja" : "nein";
  if (typeof value === "number") return field.endsWith("Rappen") ? `CHF ${formatChf(value)}` : String(value);
  if (typeof value === "string") {
    if (ISO.test(value)) {
      const d = new Date(value);
      if (Number.isNaN(d.getTime())) return value;
      // Datum ohne Uhrzeit wird als Mittag UTC gespeichert (dateOnly)
      return value.slice(11, 19) === "12:00:00" ? formatDateCh(d) : formatDateTimeCh(d);
    }
    return value;
  }
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

export type AuditChange = { field: string; label: string; before: string; after: string };

/** Gegenüberstellung der geänderten Felder aus den JSON-Texten von vorher und nachher. */
export function auditChanges(before: string | null | undefined, after: string | null | undefined): AuditChange[] {
  const b = parseAuditJson(before) ?? {};
  const a = parseAuditJson(after) ?? {};
  const fields = [...new Set([...Object.keys(b), ...Object.keys(a)])];
  return fields.map((field) => ({
    field,
    label: auditFieldLabel(field),
    before: formatAuditValue(field, b[field]),
    after: formatAuditValue(field, a[field]),
  }));
}
