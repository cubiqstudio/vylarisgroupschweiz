import type { ConsentMessages } from "@/i18n/consent";

/**
 * Konfiguration des Cookie-Hinweises (Struktur, Schlüssel, Pfade). Die sichtbaren Texte stehen in
 * src/i18n/consent.ts.
 *
 * Stand der Software (bitte ehrlich halten): Besucher ohne Anmeldung erhalten KEINE Cookies. Erst nach der Anmeldung
 * wird der technisch notwendige Sitzungs-Cookie "vgs_session" gesetzt (httpOnly, SameSite=Lax, Secure, höchstens
 * 14 Tage). Es gibt keine Analyse-/Marketing-Dienste und keine externen Einbettungen. Der Hinweis dient der
 * Information und Transparenz; für künftige optionale Kategorien (Statistik, Marketing …) ist er vorbereitet:
 * Einträge in `optionalCategories` erscheinen automatisch als abwählbare Schalter im Einstellungs-Dialog
 * (deren Texte dann ebenfalls in src/i18n/consent.ts ergänzen).
 */

/** Version der Einwilligungs-Struktur. Bei Änderung der Kategorien erhöhen → Besucher werden erneut gefragt. */
export const CONSENT_VERSION = 1;

/** Schlüssel im localStorage des Browsers (kein Cookie). */
export const STORAGE_KEY = "vgs-consent-v1";

/** Name des Sitzungs-Cookies, das nach der Anmeldung gesetzt wird. */
export const SESSION_COOKIE_NAME = "vgs_session";

/** Pfade (inkl. Unterpfade), auf denen der Banner nicht eingeblendet wird (Lesbarkeit der Rechtstexte). */
export const BANNER_HIDDEN_PATHS = ["/datenschutz", "/impressum"] as const;

export interface ConsentCookie {
  /** Name des Cookies bzw. Speicher-Eintrags */
  name: string;
  /** Zweck in einem kurzen Satz */
  purpose: string;
  /** Laufzeit, lesbar */
  duration: string;
}

export interface ConsentCategory {
  id: string;
  name: string;
  purpose: string;
  /** true = immer aktiv, nicht abwählbar */
  required: boolean;
  cookies: readonly ConsentCookie[];
}

/** Pflicht-Kategorie "Notwendig" in der Sprache der Seite. */
export function getNecessaryCategory(m: ConsentMessages): ConsentCategory {
  return {
    id: "necessary",
    name: m.necessary.name,
    purpose: m.necessary.purpose,
    required: true,
    cookies: [{ name: SESSION_COOKIE_NAME, purpose: m.necessary.sessionPurpose, duration: m.necessary.sessionDuration }],
  };
}

/** Vorbereitete optionale Kategorien. Aktuell setzen wir keine ein – daher leer. */
export const optionalCategories: readonly ConsentCategory[] = [];

/** Kein Cookie: Speicher-Eintrag, in dem der Banner die Auswahl merkt (nur im Browser des Besuchers). */
export function getStorageNote(m: ConsentMessages): ConsentCookie {
  return { name: STORAGE_KEY, purpose: m.storage.purpose, duration: m.storage.duration };
}

export const consentConfig = {
  version: CONSENT_VERSION,
  storageKey: STORAGE_KEY,
  optional: optionalCategories,
} as const;
