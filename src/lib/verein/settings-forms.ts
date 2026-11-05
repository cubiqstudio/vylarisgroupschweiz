// Felder der beiden Einstellungsseiten (Allgemein und Finanzen) und ihre Zod-Schemas. Die Aufteilung folgt den Rechten:
// «verein_settings» ändert die allgemeinen Angaben, «finance_settings» Konto, Zahlungsfrist und Mahnwesen.
// Reine Definitionen (Tests: scripts/test/overview.test.mts); Lesen und Schreiben: ./settings.ts, ./profile.ts.
import { z } from "zod";
import { vereinProfilePatchSchema } from "./profile-schema";
import { vereinSettingsSchema, type VereinSettingField } from "./settings-schema";

export const GENERAL_SETTING_FIELDS = [
  "fiscalStartMonth",
  "fiscalStartDay",
  "invitationDays",
  "exitMode",
  "exitNoticeMonths",
  "senderName",
  "senderSignature",
  "invoiceMailIntro",
  "reminderMailIntro",
  "invitationMailIntro",
  "welcomeMailText",
  "replyToEmail",
  "applyEnabled",
  "applyNotifyEmail",
] as const satisfies readonly VereinSettingField[];

export const FINANCE_SETTING_FIELDS = [
  "accountHolder",
  "iban",
  "qrIban",
  "bank",
  "paymentDays",
  "reminderAfterDays",
  "reminderDays1",
  "reminderDays2",
  "reminderDays3",
  "reminderFee1Rappen",
  "reminderFee2Rappen",
  "reminderFee3Rappen",
] as const satisfies readonly VereinSettingField[];

const pickMask = <F extends readonly VereinSettingField[]>(fields: F) => Object.fromEntries(fields.map((f) => [f, true])) as { [K in F[number]]: true };

/** Eingabe der Seite «Vereinseinstellungen»: nur bekannte Felder, unbekannte (auch Finanzfelder) werden abgelehnt. */
export const generalSettingsInputSchema = z.strictObject({
  settings: vereinSettingsSchema.pick(pickMask(GENERAL_SETTING_FIELDS)).partial().strict().optional(),
  profile: vereinProfilePatchSchema.strict().optional(),
});

/** Eingabe der Seite «Finanzeinstellungen». */
export const financeSettingsInputSchema = z.strictObject({
  settings: vereinSettingsSchema.pick(pickMask(FINANCE_SETTING_FIELDS)).partial().strict(),
});

export type GeneralSettingsInput = z.infer<typeof generalSettingsInputSchema>;
export type FinanceSettingsInput = z.infer<typeof financeSettingsInputSchema>;
