// Gemeinsame Zod-Bausteine der Vereinsmodule (zod 4). Die Schemas der Module setzen sich daraus zusammen.
// Deutsche Standardmeldungen setzt src/lib/validation.ts (z.config) – diese Datei erzwingt keine Reihenfolge, importiert sie aber mit.
import { z } from "zod";
import "@/lib/validation";
import { parseDateOnly, parseDateTimeLocal } from "./dates";
import { MAX_RAPPEN, parseChf } from "./money";

/** Getrimmter Text mit Längengrenzen. */
export const text = (min: number, max: number, msg?: string) =>
  z.string().trim().min(min, msg ?? `Mindestens ${min} Zeichen.`).max(max, `Maximal ${max} Zeichen.`);

/** Optionaler Text: leer erlaubt, Standard "". */
export const optionalText = (max: number) => z.string().trim().max(max, `Maximal ${max} Zeichen.`).default("");

/** Mehrzeiliger Text (Markdown, Protokolle, Notizen): nicht getrimmt innen, Obergrenze. */
export const longText = (max: number) => z.string().max(max, `Maximal ${max} Zeichen.`).default("");

/** Datenbank-ID (cuid). */
export const idSchema = z.string().trim().min(1, "Pflichtfeld.").max(40, "Ungültige ID.").regex(/^[A-Za-z0-9_-]+$/, "Ungültige ID.");

/** E-Mail-Adresse, kleingeschrieben und getrimmt. */
export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .max(254, "Maximal 254 Zeichen.")
  .regex(/^[^\s@<>()[\]\\,;:"]+@[^\s@<>()[\]\\,;:"]+\.[a-z]{2,}$/i, "Bitte eine gültige E-Mail-Adresse angeben.");

/** E-Mail-Adresse oder leer. */
export const optionalEmailSchema = z.union([emailSchema, z.literal("")]).default("");

/** Telefonnummer: Ziffern, Leerzeichen, + - / ( ). */
export const phoneSchema = z
  .string()
  .trim()
  .max(30, "Maximal 30 Zeichen.")
  .regex(/^[0-9+\-/()\s.]*$/, "Nur Ziffern und + - / ( ) erlaubt.")
  .default("");

/** Schweizer/Liechtensteiner PLZ (4 Ziffern) oder ausländische PLZ (bis 10 Zeichen). */
export const zipSchema = z.string().trim().max(10, "Maximal 10 Zeichen.").regex(/^[A-Za-z0-9 -]*$/, "Ungültige Postleitzahl.").default("");

/** Ländercode ISO-2 (Grossbuchstaben). */
export const countrySchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z]{2}$/, "Bitte den Ländercode mit zwei Buchstaben angeben, z. B. CH.")
  .default("CH");

/** Betrag in Rappen (ganze Zahl, ≥ 0). */
export const rappenSchema = z.number().int("Bitte einen ganzen Rappen-Betrag angeben.").min(0, "Der Betrag darf nicht negativ sein.").max(MAX_RAPPEN, "Der Betrag ist zu gross.");

/** Betrag in Rappen, positiv (> 0). */
export const positiveRappenSchema = rappenSchema.min(1, "Der Betrag muss grösser als 0 sein.");

/** Betragsfeld aus einem Formular («1'234.50» oder Zahl in Rappen) → Rappen. Text wird mit parseChf gelesen. */
export const chfInputSchema = z
  .union([z.string(), z.number()])
  .transform((v, ctx) => {
    if (typeof v === "number") return v;
    const r = parseChf(v);
    if (r === null) {
      ctx.addIssue({ code: "custom", message: "Bitte einen gültigen Betrag angeben, z. B. 120.50." });
      return z.NEVER;
    }
    return r;
  })
  .pipe(rappenSchema);

/** Datum ohne Uhrzeit aus «JJJJ-MM-TT» oder «T.M.JJJJ» → Date (Mittag UTC). */
export const dateOnlySchema = z.string().trim().transform((v, ctx) => {
  const d = parseDateOnly(v);
  if (!d) {
    ctx.addIssue({ code: "custom", message: "Bitte ein gültiges Datum angeben (TT.MM.JJJJ)." });
    return z.NEVER;
  }
  return d;
});

/** Optionales Datum: leer → null. */
export const optionalDateOnlySchema = z
  .union([dateOnlySchema, z.literal(""), z.null()])
  .optional()
  .transform((v) => (v instanceof Date ? v : null));

/** Zeitpunkt aus «JJJJ-MM-TTTHH:mm» (datetime-local) in Zürcher Zeit → Date. */
export const dateTimeSchema = z.string().trim().transform((v, ctx) => {
  const d = parseDateTimeLocal(v);
  if (!d) {
    ctx.addIssue({ code: "custom", message: "Bitte Datum und Uhrzeit angeben (TT.MM.JJJJ HH:mm)." });
    return z.NEVER;
  }
  return d;
});

export const optionalDateTimeSchema = z
  .union([dateTimeSchema, z.literal(""), z.null()])
  .optional()
  .transform((v) => (v instanceof Date ? v : null));

/** Boolesche Formularwerte tolerant lesen. */
export const boolSchema = z.union([z.boolean(), z.enum(["true", "false", "on"])]).transform((v) => v === true || v === "true" || v === "on");

/** Einschränkung auf eine Werteliste aus constants.ts. */
export const oneOf = <T extends readonly [string, ...string[]]>(values: T, msg = "Ungültiger Wert.") => z.enum(values, { error: msg });
