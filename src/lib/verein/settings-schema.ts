// Vereinseinstellungen: definierte Schlüssel in SiteSetting («verein.*»), Zod-Schema, Voreinstellungen und Vollständigkeitsprüfung.
// Reine Funktionen (kein Datenbankzugriff); Lesen und Schreiben: ./settings.ts.
//
// Grundsatz «nichts erfinden»: Beträge, Fristen und Kontodaten trägt der Verein selbst ein. Voreinstellungen gibt es nur dort, wo sie
// aus dem Gesetz folgen (Austritt nach ZGB Art. 70 Abs. 2) oder neutral sind (Geschäftsjahr = Kalenderjahr); sie sind in der
// Oberfläche mit «gemäss Statuten anpassen» zu kennzeichnen. Alles andere ist leer (null) und blockiert die jeweilige Funktion
// mit einem Hinweis, bis es eingetragen ist (siehe missing…-Funktionen).
import { z } from "zod";
import { DEFAULT_EXIT_RULE, DEFAULT_FISCAL_START, EXIT_MODES, type ExitRule, type FiscalStart } from "./dates";
import { isQrIban, isValidSwissIban, normalizeIban } from "./iban";
import { MAX_RAPPEN } from "./money";
import { emailSchema } from "./validation";

export const VEREIN_SETTING_KEYS = {
  accountHolder: "verein.account.holder",
  iban: "verein.account.iban",
  qrIban: "verein.account.qrIban",
  bank: "verein.account.bank",
  paymentDays: "verein.fees.paymentDays",
  reminderAfterDays: "verein.fees.reminderAfterDays",
  reminderDays1: "verein.fees.reminderDays1",
  reminderDays2: "verein.fees.reminderDays2",
  reminderDays3: "verein.fees.reminderDays3",
  reminderFee1Rappen: "verein.fees.reminderFee1Rappen",
  reminderFee2Rappen: "verein.fees.reminderFee2Rappen",
  reminderFee3Rappen: "verein.fees.reminderFee3Rappen",
  fiscalStartMonth: "verein.fiscal.startMonth",
  fiscalStartDay: "verein.fiscal.startDay",
  invitationDays: "verein.assembly.invitationDays",
  exitMode: "verein.exit.mode",
  exitNoticeMonths: "verein.exit.noticeMonths",
  senderName: "verein.texts.senderName",
  senderSignature: "verein.texts.signature",
  invoiceMailIntro: "verein.texts.invoiceMailIntro",
  reminderMailIntro: "verein.texts.reminderMailIntro",
  invitationMailIntro: "verein.texts.invitationMailIntro",
  welcomeMailText: "verein.texts.welcomeMailText",
  replyToEmail: "verein.mail.replyTo",
  applyEnabled: "verein.public.applyEnabled",
  applyNotifyEmail: "verein.public.applyNotifyEmail",
} as const;
export type VereinSettingField = keyof typeof VEREIN_SETTING_KEYS;

/** Alle Einstellungen des Vereins in typisierter Form. null = vom Verein noch nicht festgelegt. */
export type VereinSettings = {
  // Konto für Rechnungen (QR-Rechnung)
  accountHolder: string;
  iban: string;
  qrIban: string;
  bank: string;
  // Beiträge und Mahnwesen
  paymentDays: number | null;
  reminderAfterDays: number | null;
  reminderDays1: number | null;
  reminderDays2: number | null;
  reminderDays3: number | null;
  reminderFee1Rappen: number | null;
  reminderFee2Rappen: number | null;
  reminderFee3Rappen: number | null;
  // Geschäftsjahr (Voreinstellung: Kalenderjahr)
  fiscalStartMonth: number;
  fiscalStartDay: number;
  // Versammlungen
  invitationDays: number | null;
  // Austritt (Voreinstellung nach ZGB Art. 70 Abs. 2)
  exitMode: (typeof EXIT_MODES)[number];
  exitNoticeMonths: number;
  // Absender und Texte der Vereinsmails
  senderName: string;
  senderSignature: string;
  invoiceMailIntro: string;
  reminderMailIntro: string;
  invitationMailIntro: string;
  welcomeMailText: string;
  replyToEmail: string;
  // Öffentliches Beitrittsformular
  applyEnabled: boolean;
  applyNotifyEmail: string;
};

export const DEFAULT_VEREIN_SETTINGS: VereinSettings = {
  accountHolder: "",
  iban: "",
  qrIban: "",
  bank: "",
  paymentDays: null,
  reminderAfterDays: null,
  reminderDays1: null,
  reminderDays2: null,
  reminderDays3: null,
  reminderFee1Rappen: null,
  reminderFee2Rappen: null,
  reminderFee3Rappen: null,
  fiscalStartMonth: DEFAULT_FISCAL_START.month,
  fiscalStartDay: DEFAULT_FISCAL_START.day,
  invitationDays: null,
  exitMode: DEFAULT_EXIT_RULE.mode,
  exitNoticeMonths: DEFAULT_EXIT_RULE.noticeMonths,
  senderName: "",
  senderSignature: "",
  invoiceMailIntro: "",
  reminderMailIntro: "",
  invitationMailIntro: "",
  welcomeMailText: "",
  replyToEmail: "",
  applyEnabled: false,
  applyNotifyEmail: "",
};

// ---- Zod ----------------------------------------------------------------------------------------------------------

const days = z.number().int("Bitte ganze Tage angeben.").min(0, "Mindestens 0 Tage.").max(365, "Höchstens 365 Tage.");
const optionalDays = days.nullable();
const optionalRappen = z.number().int().min(0, "Der Betrag darf nicht negativ sein.").max(MAX_RAPPEN, "Der Betrag ist zu gross.").nullable();
const line = (max: number) => z.string().trim().max(max, `Maximal ${max} Zeichen.`);
const block = (max: number) => z.string().max(max, `Maximal ${max} Zeichen.`);

const ibanField = z
  .string()
  .trim()
  .transform(normalizeIban)
  .refine((v) => v === "" || isValidSwissIban(v), "Bitte eine gültige Schweizer IBAN angeben (CH… mit 21 Zeichen).")
  .refine((v) => v === "" || !isQrIban(v), "Das ist eine QR-IBAN. Trage sie im Feld «QR-IBAN» ein.");
const qrIbanField = z
  .string()
  .trim()
  .transform(normalizeIban)
  .refine((v) => v === "" || isQrIban(v), "Das ist keine QR-IBAN (Institutskennung 30000–31999).");

export const vereinSettingsSchema = z.object({
  accountHolder: line(70),
  iban: ibanField,
  qrIban: qrIbanField,
  bank: line(70),
  paymentDays: optionalDays,
  reminderAfterDays: optionalDays,
  reminderDays1: optionalDays,
  reminderDays2: optionalDays,
  reminderDays3: optionalDays,
  reminderFee1Rappen: optionalRappen,
  reminderFee2Rappen: optionalRappen,
  reminderFee3Rappen: optionalRappen,
  fiscalStartMonth: z.number().int().min(1, "Monat 1–12.").max(12, "Monat 1–12."),
  fiscalStartDay: z.number().int().min(1, "Tag 1–28.").max(28, "Tag 1–28 (kürzere Monate wären sonst ungültig)."),
  invitationDays: optionalDays,
  exitMode: z.enum(EXIT_MODES, { error: "Ungültige Austrittsregel." }),
  exitNoticeMonths: z.number().int().min(0, "Mindestens 0 Monate.").max(24, "Höchstens 24 Monate."),
  senderName: line(100),
  senderSignature: block(500),
  invoiceMailIntro: block(2000),
  reminderMailIntro: block(2000),
  invitationMailIntro: block(2000),
  welcomeMailText: block(2000),
  replyToEmail: z.union([emailSchema, z.literal("")]),
  applyEnabled: z.boolean(),
  applyNotifyEmail: z.union([emailSchema, z.literal("")]),
}) satisfies z.ZodType<VereinSettings>;

/** Eingabe zum Speichern: nur die gesendeten Felder (mit parsePatch aus src/app/api/_lib/http.ts lesen). */
export const vereinSettingsPatchSchema = vereinSettingsSchema.partial();

// ---- Umwandlung Key/Value ↔ typisiert ------------------------------------------------------------------------------

const NUMBER_FIELDS: readonly VereinSettingField[] = [
  "paymentDays",
  "reminderAfterDays",
  "reminderDays1",
  "reminderDays2",
  "reminderDays3",
  "reminderFee1Rappen",
  "reminderFee2Rappen",
  "reminderFee3Rappen",
  "fiscalStartMonth",
  "fiscalStartDay",
  "invitationDays",
  "exitNoticeMonths",
];
const FIELD_SCHEMA = vereinSettingsSchema.shape;

/** Liest die Rohwerte (SiteSetting-Zeilen) tolerant: ungültige oder fehlende Werte fallen auf die Voreinstellung zurück. */
export function parseVereinSettings(raw: Readonly<Record<string, string>>): VereinSettings {
  const out: Record<string, unknown> = { ...DEFAULT_VEREIN_SETTINGS };
  for (const field of Object.keys(VEREIN_SETTING_KEYS) as VereinSettingField[]) {
    const stored = raw[VEREIN_SETTING_KEYS[field]];
    if (stored === undefined) continue;
    let value: unknown = stored;
    if (NUMBER_FIELDS.includes(field)) value = stored.trim() === "" ? null : Number(stored);
    else if (field === "applyEnabled") value = stored === "true";
    const parsed = (FIELD_SCHEMA[field] as z.ZodType).safeParse(value);
    if (parsed.success) out[field] = parsed.data;
  }
  return out as VereinSettings;
}

/** Wandelt (Teil-)Einstellungen in SiteSetting-Werte. null löscht den Eintrag (Voreinstellung gilt wieder). */
export function serializeVereinSettings(patch: Partial<VereinSettings>): Record<string, string | null> {
  const out: Record<string, string | null> = {};
  for (const field of Object.keys(patch) as VereinSettingField[]) {
    const key = VEREIN_SETTING_KEYS[field];
    const v = patch[field];
    if (v === null || v === undefined) out[key] = null;
    else if (typeof v === "boolean") out[key] = v ? "true" : "false";
    else out[key] = String(v);
  }
  return out;
}

// ---- Abgeleitete Werte -------------------------------------------------------------------------------------------

export const fiscalStartOf = (s: VereinSettings): FiscalStart => ({ month: s.fiscalStartMonth, day: s.fiscalStartDay });
export const exitRuleOf = (s: VereinSettings): ExitRule => ({ mode: s.exitMode, noticeMonths: s.exitNoticeMonths });
/** Zahlungsfrist der Mahnstufe 1–3 in Tagen oder null. */
export function reminderDaysFor(s: VereinSettings, level: number): number | null {
  return level === 1 ? s.reminderDays1 : level === 2 ? s.reminderDays2 : level === 3 ? s.reminderDays3 : null;
}
/** Mahngebühr der Stufe 1–3 in Rappen (nicht festgelegt = 0). */
export function reminderFeeFor(s: VereinSettings, level: number): number {
  return (level === 1 ? s.reminderFee1Rappen : level === 2 ? s.reminderFee2Rappen : level === 3 ? s.reminderFee3Rappen : null) ?? 0;
}

// ---- Vollständigkeit ---------------------------------------------------------------------------------------------

export type MissingSetting = { field: VereinSettingField; message: string };

/** Was fehlt, bevor Rechnungen erstellt werden dürfen? (Konto und Zahlungsfrist) */
export function missingForInvoicing(s: VereinSettings): MissingSetting[] {
  const out: MissingSetting[] = [];
  if (!s.accountHolder) out.push({ field: "accountHolder", message: "Kontoinhaber fehlt." });
  if (!s.iban && !s.qrIban) out.push({ field: "iban", message: "IBAN oder QR-IBAN fehlt." });
  if (s.paymentDays === null) out.push({ field: "paymentDays", message: "Zahlungsfrist (Tage) fehlt." });
  return out;
}

/** Was fehlt, bevor Mahnungen versendet werden dürfen? */
export function missingForReminders(s: VereinSettings): MissingSetting[] {
  const out: MissingSetting[] = [];
  if (s.reminderAfterDays === null) out.push({ field: "reminderAfterDays", message: "Tage bis zur 1. Mahnung fehlen." });
  for (const level of [1, 2, 3]) {
    const field = `reminderDays${level}` as VereinSettingField;
    if (reminderDaysFor(s, level) === null) out.push({ field, message: `Zahlungsfrist der ${level}. Mahnung fehlt.` });
  }
  return out;
}

/** Was fehlt, bevor zu einer Mitgliederversammlung eingeladen wird? */
export function missingForInvitations(s: VereinSettings): MissingSetting[] {
  return s.invitationDays === null ? [{ field: "invitationDays", message: "Einladungsfrist (Tage) gemäss Statuten fehlt." }] : [];
}

/** Gesamtliste für die Einrichtungshilfe in der Übersicht. */
export function missingSettings(s: VereinSettings): MissingSetting[] {
  return [...missingForInvoicing(s), ...missingForReminders(s), ...missingForInvitations(s)];
}
