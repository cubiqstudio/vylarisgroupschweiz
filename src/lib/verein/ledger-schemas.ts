// Zod-Schemas und Filter der Kassa (rein, ohne Datenbank). Beträge kommen als Text («1'234.50») oder Rappen und werden zu Rappen.
import { z } from "zod";
import { ACCOUNT_KINDS, TRANSACTION_DIRECTIONS, TRANSACTION_SOURCES } from "./constants";
import { MAX_RAPPEN, parseChf } from "./money";
import { firstParam, intParam } from "./pagination";
import { chfInputSchema, dateOnlySchema, idSchema, oneOf, optionalText, positiveRappenSchema, text } from "./validation";

type ParamSource = URLSearchParams | Record<string, string | string[] | undefined>;

export const FISCAL_YEAR_MIN = 2000;
export const FISCAL_YEAR_MAX = 2100;

export const yearSchema = z.coerce.number().int("Bitte ein Jahr angeben.").min(FISCAL_YEAR_MIN, "Ungültiges Jahr.").max(FISCAL_YEAR_MAX, "Ungültiges Jahr.");

/** Betrag, der auch negativ sein darf (Anfangsbestand mit Überzug). */
const signedChfSchema = z
  .union([z.string(), z.number()])
  .transform((v, ctx) => {
    const r = typeof v === "number" ? v : parseChf(v);
    if (r === null || !Number.isInteger(r) || Math.abs(r) > MAX_RAPPEN) {
      ctx.addIssue({ code: "custom", message: "Bitte einen gültigen Betrag angeben, z. B. 1’250.00." });
      return z.NEVER;
    }
    return r;
  });

const accountNumber = z
  .string()
  .trim()
  .min(1, "Bitte eine Nummer oder ein Kürzel angeben.")
  .max(12, "Maximal 12 Zeichen.")
  .regex(/^[A-Za-z0-9][A-Za-z0-9 ._-]*$/, "Erlaubt sind Buchstaben, Ziffern, Punkt, Bindestrich und Leerzeichen.");

export const accountSchema = z.object({
  kind: oneOf(ACCOUNT_KINDS),
  number: accountNumber,
  name: text(1, 80),
  openingBalance: signedChfSchema.default(0),
  active: z.boolean().default(true),
  sortOrder: z.number().int().min(0).max(9999).default(0),
});
export type AccountInput = z.infer<typeof accountSchema>;
export const accountPatchSchema = accountSchema.partial();

export const transactionCreateSchema = z.object({
  bookingDate: dateOnlySchema,
  direction: oneOf(TRANSACTION_DIRECTIONS),
  amount: chfInputSchema.pipe(positiveRappenSchema),
  categoryId: idSchema,
  counterAccountId: idSchema,
  text: text(1, 200),
  voucherRef: optionalText(100),
});
export type TransactionCreateInput = z.infer<typeof transactionCreateSchema>;

/** Änderung: die Buchungsart bleibt, die übrigen Felder sind einzeln änderbar. */
export const transactionPatchSchema = z.object({
  bookingDate: dateOnlySchema.optional(),
  amount: chfInputSchema.pipe(positiveRappenSchema).optional(),
  categoryId: idSchema.optional(),
  counterAccountId: idSchema.optional(),
  text: text(1, 200).optional(),
  voucherRef: optionalText(100).optional(),
});
export type TransactionPatchInput = z.infer<typeof transactionPatchSchema>;

export const reverseSchema = z.object({
  /** Datum der Gegenbuchung; leer = heute. Es muss in einem offenen Geschäftsjahr liegen. */
  bookingDate: dateOnlySchema.optional(),
  reason: text(1, 150, "Bitte einen Grund angeben."),
});
export type ReverseInput = z.infer<typeof reverseSchema>;

export const budgetSchema = z.object({
  year: yearSchema,
  items: z
    .array(
      z.object({
        categoryId: idSchema,
        /** leer oder «-» = kein Budget */
        amount: z.union([z.string(), z.number(), z.null()]).transform((v, ctx) => {
          if (v === null) return null;
          if (typeof v === "string" && (v.trim() === "" || v.trim() === "-")) return null;
          const r = typeof v === "number" ? v : parseChf(v);
          if (r === null || !Number.isInteger(r) || r < 0 || r > MAX_RAPPEN) {
            ctx.addIssue({ code: "custom", message: "Bitte einen gültigen Betrag angeben (nicht negativ)." });
            return z.NEVER;
          }
          return r;
        }),
      }),
    )
    .max(300, "Zu viele Zeilen."),
});
export type BudgetInput = z.infer<typeof budgetSchema>;

export const FISCAL_ACTIONS = ["lock", "unlock", "approve", "unapprove"] as const;
export type FiscalAction = (typeof FISCAL_ACTIONS)[number];

export const fiscalActionSchema = z.object({
  action: oneOf(FISCAL_ACTIONS),
  /** Bemerkung beim Abschluss; beim Wiedereröffnen ist sie Pflicht (Begründung). */
  note: optionalText(500),
  /** Datum der Genehmigung durch die Mitgliederversammlung */
  date: dateOnlySchema.optional(),
  /** Abschluss trotz Zahlungen, die noch nicht gebucht sind */
  confirmUnbooked: z.boolean().default(false),
});
export type FiscalActionInput = z.infer<typeof fiscalActionSchema>;

// ---- Listenfilter -------------------------------------------------------------------------------------------------------

export const LEDGER_STATES = ["AKTIV", "STORNIERT"] as const;

export type LedgerFilters = {
  q: string;
  /** Geschäftsjahr oder null = alle */
  year: number | null;
  direction: string;
  source: string;
  /** Konto (Kategorie oder Gegenkonto) */
  accountId: string;
  /** Nur Buchungen ohne Beleg */
  noReceipt: boolean;
};

export function parseLedgerFilters(source: ParamSource, fallbackYear: number | null = null): LedgerFilters {
  const rawYear = firstParam(source, "year");
  const year = rawYear === "alle" ? null : rawYear ? intParam(rawYear, fallbackYear ?? FISCAL_YEAR_MIN, FISCAL_YEAR_MIN, FISCAL_YEAR_MAX) : fallbackYear;
  const direction = firstParam(source, "direction");
  const src = firstParam(source, "source");
  return {
    q: firstParam(source, "q").trim().slice(0, 100),
    year,
    direction: (TRANSACTION_DIRECTIONS as readonly string[]).includes(direction) ? direction : "",
    source: (TRANSACTION_SOURCES as readonly string[]).includes(src) ? src : "",
    accountId: firstParam(source, "account").slice(0, 40).replace(/[^A-Za-z0-9_-]/g, ""),
    noReceipt: firstParam(source, "noReceipt") === "1",
  };
}

/** Jahr aus einem Parameter oder die Vorgabe. */
export function parseYearParam(source: ParamSource, fallback: number, key = "year"): number {
  return intParam(firstParam(source, key), fallback, FISCAL_YEAR_MIN, FISCAL_YEAR_MAX);
}
