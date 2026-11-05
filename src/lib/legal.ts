import "server-only";
import { intlTag } from "@/i18n";
import { parseIsoDate, resolveShow, visibleImprint, type LegalContent } from "@/lib/legal-toggles";
import { getLegalSettings } from "@/lib/settings";
import { site } from "@/lib/site";

/**
 * Stand der Datenschutzerklärung, solange in den Einstellungen noch keiner gespeichert ist (ISO-Datum).
 * Im Betrieb gilt der Wert aus «Einstellungen → Rechtliches» (legal.privacyUpdatedAt): Er wird beim Speichern automatisch
 * erneuert, wenn sich die Erklärung dadurch ändert. Die Seite zeigt ihn als «Stand: 5.11.2026» an.
 */
export const PRIVACY_UPDATED_AT = "2026-11-05";

/** Stand-Datum in der Schreibweise der aktiven Sprache (de-CH: 5.11.2026). */
export function formatPrivacyUpdatedAt(iso?: string): string {
  const date = parseIsoDate(iso) || PRIVACY_UPDATED_AT;
  return new Intl.DateTimeFormat(intlTag(), {
    day: "numeric",
    month: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${date}T00:00:00Z`));
}

/** Rechtliche Pflichtangaben: Admin-Einstellungen, sonst Umgebungsvariablen. Fällt bei DB-Fehlern auf Env zurück. */
export async function getLegal() {
  let l;
  try {
    l = await getLegalSettings();
  } catch {
    const e = (k: string) => process.env[k]?.trim() || "";
    const content: LegalContent = {
      street: e("LEGAL_STREET"),
      zipCity: e("LEGAL_ZIP_CITY"),
      country: e("LEGAL_COUNTRY"),
      phone: e("LEGAL_PHONE"),
      register: e("LEGAL_REGISTER"),
      vatId: e("LEGAL_VAT_ID"),
      email: e("CONTACT_EMAIL"),
      smallBusiness: false,
      noRegister: false,
    };
    const { imprint, privacy } = resolveShow({}, { ...content, boardCount: site.board.length });
    l = { ...content, responsible: "", show: imprint, privacyShow: privacy, privacyUpdatedAt: "" };
  }
  const show = l.show;
  const content: LegalContent = {
    street: l.street,
    zipCity: l.zipCity,
    country: l.country,
    phone: l.phone,
    register: l.register,
    vatId: l.vatId,
    email: l.email,
    smallBusiness: l.smallBusiness,
    noRegister: l.noRegister,
    boardCount: site.board.length,
  };
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
    /** Nicht mehrwertsteuerpflichtig: keine MWST-Nummer im Impressum, stattdessen ein Hinweis */
    smallBusiness: l.smallBusiness,
    /** Kein Handelsregistereintrag: stattdessen ein Hinweis */
    noRegister: l.noRegister,
    /** Schalter «im Impressum anzeigen» je Element (Einstellungen) */
    show,
    /** Tatsächlich im Impressum erscheinende Elemente: Schalter an und Inhalt vorhanden (nie eine leere Zeile) */
    imprint: visibleImprint(show, content),
    /** Schalter je Abschnitt der Datenschutzerklärung */
    privacy: l.privacyShow,
    /** Stand der Datenschutzerklärung (ISO-Datum; leer = noch nie gespeichert) */
    privacyUpdatedAt: l.privacyUpdatedAt,
    isComplete: Boolean(l.street && l.zipCity && l.email),
  };
}
