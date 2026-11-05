// Kontext für ausgehende Mails: Sprache, Marke und Basis-URL für Links.
// Es gibt nur eine Seite, der Kontext hängt daher weder von der Anfrage noch von gespeicherten Werten ab; die Basis-URL
// stammt aus festen Werten (siehe baseUrl in src/i18n/server.ts), nie aus dem Host-Header.
import "server-only";
import { baseUrl } from "@/i18n/server";
import { LOCALES, SITE, type Locale, type SiteProfile } from "@/lib/sites";

export type MailCtx = { locale: Locale; site: SiteProfile; baseUrl: string };

/**
 * Kontext für jede Mail, auch ohne laufende Anfrage (Ticket-Antwort, Kampagnenversand, Hintergrundaufgaben, Team-Hinweise).
 * Eine gespeicherte Sprache (Spalte "locale") wird nur übernommen, wenn sie aktiv ist; sonst gilt die Sprache der Seite.
 */
export function mailCtx(locale?: string | null): MailCtx {
  const known = LOCALES.find((l) => l === locale);
  return { locale: known ?? SITE.locale, site: SITE, baseUrl: baseUrl() };
}
