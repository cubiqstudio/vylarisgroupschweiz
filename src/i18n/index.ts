// Mini-i18n ohne Fremdbibliothek. Texte stehen pro Bereich in src/i18n/<bereich>.ts:
//   export const xyz = defineMessages({ ...de }, { ...en });   // en muss dieselbe Form haben wie de
// Server:  const m = await getMessages(xyz);        (aus "@/i18n/server")
// Client:  const m = useMessages(xyz);              (aus "@/i18n/client")
// Werte dürfen Funktionen sein, z. B. greeting: (name: string) => `Hallo, ${name}`.
import type { Locale } from "@/lib/sites";

export type { Locale } from "@/lib/sites";
export type Messages<T> = { de: T; en: T };

export function defineMessages<T>(de: T, en: T): Messages<T> {
  return { de, en };
}

export function pick<T>(m: Messages<T>, locale: Locale): T {
  return m[locale];
}

/** Locale → BCP-47-Tag für Intl. */
export const intlTag = (locale: Locale) => (locale === "en" ? "en-US" : "de-DE");

/** Feld einer DB-Zeile in der Sprache der Seite: bei en das Feld "<name>En", falls gefüllt, sonst Deutsch. */
export function localized<R extends Record<string, unknown>>(row: R, field: string, locale: Locale): string {
  const base = String(row[field] ?? "");
  if (locale !== "en") return base;
  const en = row[`${field}En`];
  return typeof en === "string" && en.trim() ? en : base;
}

/** true, wenn die Zeile für die englische Seite eine eigene Übersetzung hat (Feld "<field>En"). */
export function hasEnglish<R extends Record<string, unknown>>(row: R, field: string): boolean {
  const en = row[`${field}En`];
  return typeof en === "string" && en.trim().length > 0;
}
