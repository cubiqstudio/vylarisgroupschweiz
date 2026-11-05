import "server-only";
import { cache } from "react";
import { headers } from "next/headers";
import { pick, type Messages } from "@/i18n";
import { isKnownHost, siteForHost, type Locale, type SiteProfile } from "@/lib/sites";

/** Profil der aktuellen Anfrage (Host-Header, hinter Proxy/Tunnel X-Forwarded-Host). */
export const getSite = cache(async (): Promise<SiteProfile> => {
  const h = await headers();
  const site = siteForHost(h.get("x-forwarded-host") ?? h.get("host"));
  // Kontakt-Adresse von vylaris.net lässt sich per Umgebung (NET_CONTACT_EMAIL, vom Installer gesetzt) überschreiben.
  const override = process.env.NET_CONTACT_EMAIL?.trim();
  return site.key === "net" && override ? { ...site, contactEmail: override } : site;
});

export async function getLocale(): Promise<Locale> {
  return (await getSite()).locale;
}

export async function getMessages<T>(m: Messages<T>): Promise<T> {
  return pick(m, await getLocale());
}

/** Basis-URL der aktuellen Anfrage ohne abschließenden Schrägstrich (Protokoll aus X-Forwarded-Proto). */
export async function getBaseUrl(): Promise<string> {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const site = siteForHost(host);
  const proto = h.get("x-forwarded-proto")?.split(",")[0]?.trim() || (process.env.NODE_ENV === "production" ? "https" : "http");
  return baseUrlFor(site, host ?? undefined, proto);
}

/**
 * Basis-URL für ein Profil (Links in Mails, Metadaten). Sie stammt NUR aus festen Werten – vylaris.eu aus SITE_URL, die anderen
 * Domains aus ihrer Domain –, nie aus dem Host-Header der Anfrage (sonst ließen sich Reset-/Bestätigungslinks auf fremde Domains lenken).
 * Nur außerhalb der Produktion wird der Anfrage-Host übernommen (localhost bzw. bekannte Domain mit Port), damit lokale Tests funktionieren.
 */
export function baseUrlFor(site: SiteProfile, requestHost?: string, proto?: string): string {
  if (process.env.NODE_ENV !== "production" && requestHost) {
    const h = requestHost.split(",")[0]!.trim();
    if (/^(localhost|127\.0\.0\.1)(:\d{1,5})?$/.test(h) || (isKnownHost(h) && siteForHost(h).key === site.key)) {
      return `${proto === "https" ? "https" : "http"}://${h}`;
    }
  }
  const siteUrl = (process.env.SITE_URL?.trim() || "http://localhost:3000").replace(/\/+$/, "");
  return site.key === "eu" ? siteUrl : `https://${site.domain}`;
}
