// Zod-Schemas der Beiträge, Rechnungen, Zahlungen und Mahnungen (Eingaben der Admin-API). Reine Definitionen.
import { z } from "zod";
import { PAYMENT_METHODS } from "./constants";
import { chfInputSchema, dateOnlySchema, idSchema, longText, oneOf, optionalText, positiveRappenSchema, rappenSchema, text } from "./validation";

/** Position einer Rechnung. Menge: ganze Zahl 1–9999; Einzelpreis in Rappen (auch als «12.50» lesbar). */
export const invoiceItemSchema = z.object({
  description: text(1, 200, "Bitte die Position beschreiben."),
  quantity: z.number().int("Bitte eine ganze Menge angeben.").min(1, "Mindestens 1.").max(9999, "Höchstens 9999."),
  unit: chfInputSchema,
  categoryId: idSchema.nullable().optional(),
});
export type InvoiceItemInput = z.infer<typeof invoiceItemSchema>;

const itemsSchema = z.array(invoiceItemSchema).min(1, "Mindestens eine Position.").max(30, "Höchstens 30 Positionen.");

export const invoiceCreateSchema = z.object({
  memberId: idSchema,
  subject: optionalText(200),
  issueDate: dateOnlySchema.optional(),
  dueDate: dateOnlySchema.optional(),
  periodId: idSchema.nullable().optional(),
  notes: longText(2000),
  items: itemsSchema,
});

/** Entwurf ändern: alle Felder; offene Rechnungen: nur Fälligkeit und interne Notiz (Prüfung im Datenzugriff). */
export const invoiceUpdateSchema = z
  .object({
    subject: optionalText(200),
    issueDate: dateOnlySchema,
    dueDate: dateOnlySchema,
    notes: longText(2000),
    items: itemsSchema,
  })
  .partial();

export const invoiceCancelSchema = z.object({ reason: text(3, 500, "Bitte kurz begründen, warum die Rechnung storniert wird.") });

export const invoiceSendSchema = z.object({
  channel: oneOf(["MAIL", "POST"] as const).default("MAIL"),
});

export const invoiceBulkSendSchema = z.object({
  ids: z.array(idSchema).min(1, "Keine Rechnung ausgewählt.").max(200, "Höchstens 200 Rechnungen auf einmal."),
  channel: oneOf(["MAIL", "POST"] as const).default("MAIL"),
});

// ---- Beitragsjahre ----------------------------------------------------------------------------------------------

const rateSchema = z.object({ membershipTypeId: idSchema, amount: chfInputSchema });

export const periodCreateSchema = z.object({
  year: z.number().int("Bitte ein Jahr angeben.").min(2000, "Frühestens 2000.").max(2100, "Spätestens 2100."),
  label: optionalText(100),
  startsOn: dateOnlySchema.optional(),
  endsOn: dateOnlySchema.optional(),
  note: longText(1000),
  rates: z.array(rateSchema).max(50).default([]),
});

export const periodUpdateSchema = z
  .object({
    label: optionalText(100),
    startsOn: dateOnlySchema,
    endsOn: dateOnlySchema,
    note: longText(1000),
    rates: z.array(rateSchema).max(50),
  })
  .partial();

export const periodRunSchema = z.object({
  /** true = nur berechnen und anzeigen, nichts anlegen */
  dryRun: z.boolean().default(true),
  prorate: z.boolean().default(false),
  roundToFive: z.boolean().default(false),
  categoryId: idSchema.nullable().optional(),
  issueDate: dateOnlySchema.optional(),
});

// ---- Zahlungen --------------------------------------------------------------------------------------------------

export const paymentCreateSchema = z.object({
  invoiceId: idSchema.nullable().optional(),
  /** Nur ohne Rechnung (allgemeine Zahlung): zugehöriges Mitglied */
  memberId: idSchema.nullable().optional(),
  receivedAt: dateOnlySchema,
  amount: chfInputSchema.pipe(positiveRappenSchema),
  method: oneOf(PAYMENT_METHODS).default("UEBERWEISUNG"),
  reference: optionalText(100),
  note: optionalText(300),
  /** Vermögenskonto (Bank, Kasse) für die Buchung in der Kassa */
  assetAccountId: idSchema.nullable().optional(),
  /** Ertragskonto, falls die Rechnung keines vorgibt */
  incomeAccountId: idSchema.nullable().optional(),
});
export type PaymentCreateInput = z.infer<typeof paymentCreateSchema>;

export const paymentBookSchema = z.object({
  assetAccountId: idSchema,
  incomeAccountId: idSchema.nullable().optional(),
});

export const paymentImportSchema = z.object({
  csv: z.string().min(1, "Bitte die CSV-Datei einfügen oder hochladen.").max(1_000_000, "Die Datei ist zu gross (höchstens 1 MB)."),
  /** false = nur zuordnen (Vorschau); true = gewählte Zeilen buchen */
  commit: z.boolean().default(false),
  /** Zeilennummern, die gebucht werden sollen (nur mit commit) */
  lines: z.array(z.number().int().min(2).max(100000)).max(2000).default([]),
  assetAccountId: idSchema.nullable().optional(),
  incomeAccountId: idSchema.nullable().optional(),
  method: oneOf(PAYMENT_METHODS).default("UEBERWEISUNG"),
});

// ---- Mahnungen --------------------------------------------------------------------------------------------------

export const reminderSendSchema = z.object({
  ids: z.array(idSchema).min(1, "Keine Rechnung ausgewählt.").max(100, "Höchstens 100 Rechnungen auf einmal."),
  /** Optionaler Verzugszins in Rappen (nur bei genau einer Rechnung sinnvoll; wird als eigene Position angehängt) */
  interest: rappenSchema.optional(),
});
