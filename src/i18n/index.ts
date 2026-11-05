// Mini-i18n ohne Fremdbibliothek. Texte stehen pro Bereich in src/i18n/<bereich>.ts:
//   export const xyz = defineMessages({ ...de });
// Aktiv ist nur Deutsch (Schweiz). Kommt eine Sprache hinzu (z. B. fr, it): Locale in src/lib/sites.ts erweitern,
// dann bekommt defineMessages ein weiteres Argument je Sprache, und alle Bereiche müssen dieselbe Form liefern.
// Server:  const m = await getMessages(xyz);        (aus "@/i18n/server")
// Client:  const m = useMessages(xyz);              (aus "@/i18n/client")
// Werte dürfen Funktionen sein, z. B. greeting: (name: string) => `Hallo, ${name}`.
import type { Locale } from "@/lib/sites";

export type { Locale } from "@/lib/sites";
export type Messages<T> = Record<Locale, T>;

export function defineMessages<T>(de: T): Messages<T> {
  return { de };
}

export function pick<T>(m: Messages<T>, locale: Locale): T {
  return m[locale];
}

/** Locale → BCP-47-Tag für Intl (Datum, Zahlen, Währung CHF). */
const INTL_TAGS: Record<Locale, string> = { de: "de-CH" };
export const intlTag = (locale: Locale = "de") => INTL_TAGS[locale];
