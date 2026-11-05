// Zod-Schemas des Moduls Dokumente. Reine Definitionen (auch im Browser nutzbar).
import { z } from "zod";
import { DOCUMENT_CATEGORIES, DOCUMENT_VISIBILITIES } from "./constants";
import { boolSchema, idSchema, oneOf, optionalText, text } from "./validation";

/** Verknüpfte Sitzung: ID, leer oder null (= keine). */
const meetingRef = z
  .union([idSchema, z.literal(""), z.null()])
  .optional()
  .transform((v) => (v ? v : null));

const titleSchema = text(3, 150, "Bitte einen Titel angeben (mindestens 3 Zeichen).");

/** Neues Dokument (Formularfelder neben der Datei). Sichtbarkeit ohne Angabe: nur Vorstand (datensparsam). */
export const documentCreateSchema = z.object({
  title: titleSchema,
  description: optionalText(2000),
  category: oneOf(DOCUMENT_CATEGORIES, "Bitte eine Kategorie wählen."),
  visibility: oneOf(DOCUMENT_VISIBILITIES, "Bitte die Sichtbarkeit wählen.").default("VORSTAND"),
  meetingId: meetingRef,
  changeNote: optionalText(300),
});
export type DocumentCreateInput = z.infer<typeof documentCreateSchema>;

/** Änderung der Angaben (nur gesendete Felder, gelesen mit parsePatch). */
export const documentPatchSchema = z.object({
  title: titleSchema,
  description: optionalText(2000),
  category: oneOf(DOCUMENT_CATEGORIES, "Bitte eine Kategorie wählen."),
  visibility: oneOf(DOCUMENT_VISIBILITIES, "Bitte die Sichtbarkeit wählen."),
  meetingId: meetingRef,
  archived: boolSchema,
}).partial();
export type DocumentPatchInput = z.infer<typeof documentPatchSchema>;

/** Neue Version: nur der Änderungshinweis (die Datei kommt als Upload). */
export const documentVersionSchema = z.object({ changeNote: optionalText(300) });
export type DocumentVersionInput = z.infer<typeof documentVersionSchema>;

/** Liest die Textfelder eines multipart-Formulars (alle ausser Dateien) als einfaches Objekt. */
export function formFields(form: FormData): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of form.entries()) {
    if (typeof value === "string") out[key] = value;
  }
  return out;
}
