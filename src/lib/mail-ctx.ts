// Kontext für ausgehende Mails: Sprache, Marke (Profil der Empfängerseite) und Basis-URL für Links.
// Jede Mail erscheint in der Sprache und unter der Marke der Seite, bei der sich die Person angemeldet hat.
import "server-only";
import { baseUrlFor, getBaseUrl, getSite } from "@/i18n/server";
import { DEFAULT_SITE, SITES, type Locale, type SiteKey, type SiteProfile } from "@/lib/sites";

export type MailCtx = { locale: Locale; site: SiteProfile; baseUrl: string };

const isLocale = (v: unknown): v is Locale => v === "de" || v === "en";
const isSiteKey = (v: unknown): v is SiteKey => typeof v === "string" && Object.prototype.hasOwnProperty.call(SITES, v);

/** Kontext der laufenden Anfrage (Host-Header). Nur innerhalb eines Request-Handlers aufrufen. */
export async function getRequestMailCtx(): Promise<MailCtx> {
  const [site, baseUrl] = await Promise.all([getSite(), getBaseUrl()]);
  return { locale: site.locale, site, baseUrl };
}

/**
 * Kontext für Mails ohne Anfrage (Admin-Antwort auf ein Ticket, Kampagnenversand, Hintergrundaufgaben):
 * nutzt die gespeicherten Werte der Datenbankzeile. Fehlende oder unbekannte Werte fallen auf vylaris.eu / Sprache der Seite zurück.
 */
export function mailCtxFor(siteKey?: string | null, locale?: string | null): MailCtx {
  const site = SITES[isSiteKey(siteKey) ? siteKey : DEFAULT_SITE];
  return { locale: isLocale(locale) ? locale : site.locale, site, baseUrl: baseUrlFor(site) };
}

/** Team-Benachrichtigungen sind immer deutsch und verlinken auf vylaris.eu, weil der Admin-Bereich nur dort erreichbar ist. */
export function adminMailCtx(): MailCtx {
  return mailCtxFor("eu", "de");
}
