import "server-only";
import { intlTag } from "@/i18n";
import { getLegalSettings } from "@/lib/settings";
import { site } from "@/lib/site";

/**
 * Stand der Datenschutzerklärung (ISO-Datum). Bei jeder inhaltlichen Änderung der Erklärung hier anpassen;
 * die Seite zeigt es als «Stand: 5.11.2026» an.
 */
export const PRIVACY_UPDATED_AT = "2026-11-05";

/** Stand-Datum in der Schreibweise der aktiven Sprache (de-CH: 5.11.2026). */
export function formatPrivacyUpdatedAt(): string {
  return new Intl.DateTimeFormat(intlTag(), {
    day: "numeric",
    month: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${PRIVACY_UPDATED_AT}T00:00:00Z`));
}

/** Rechtliche Pflichtangaben: Admin-Einstellungen, sonst Umgebungsvariablen. Fällt bei DB-Fehlern auf Env zurück. */
export async function getLegal() {
  let l;
  try {
    l = await getLegalSettings();
  } catch {
    const e = (k: string) => process.env[k]?.trim() || "";
    l = {
      responsible: "",
      street: e("LEGAL_STREET"),
      zipCity: e("LEGAL_ZIP_CITY"),
      country: e("LEGAL_COUNTRY"),
      phone: e("LEGAL_PHONE"),
      register: e("LEGAL_REGISTER"),
      vatId: e("LEGAL_VAT_ID"),
      email: e("CONTACT_EMAIL"),
      smallBusiness: false,
      noRegister: false,
      hideRegister: false,
      hideVat: false,
    };
  }
  return {
    responsible: l.responsible || site.leader.name,
    street: l.street || undefined,
    zipCity: l.zipCity || undefined,
    country: l.country || "Schweiz",
    phone: l.phone || undefined,
    register: l.register || undefined,
    vatId: l.vatId || undefined,
    email: l.email || undefined,
    // Die Schlüssel der Einstellungen bleiben bestehen (Datenbank), bedeuten aber für den Verein:
    /** Nicht mehrwertsteuerpflichtig: keine MWST-Nummer im Impressum */
    smallBusiness: l.smallBusiness,
    /** Kein Handelsregistereintrag */
    noRegister: l.noRegister,
    /** Zeilen im Impressum ausblenden (kein Hinweis, kein «Angabe ergänzen») */
    hideRegister: l.hideRegister,
    hideVat: l.hideVat,
    isComplete: Boolean(l.street && l.zipCity && l.email),
  };
}
