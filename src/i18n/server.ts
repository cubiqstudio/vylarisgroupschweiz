import "server-only";
import { headers } from "next/headers";
import { pick, type Messages } from "@/i18n";
import { SITE, type Locale, type SiteProfile } from "@/lib/sites";
import { site } from "@/lib/site";

/** Profil der Seite. Es gibt nur eine Seite; der Helfer bleibt async, damit Aufrufer bei einer späteren Spracherkennung unverändert laufen. */
export async function getSite(): Promise<SiteProfile> {
  return SITE;
}

export async function getLocale(): Promise<Locale> {
  return (await getSite()).locale;
}

export async function getMessages<T>(m: Messages<T>): Promise<T> {
  return pick(m, await getLocale());
}

/** Basis-URL für Links in Mails und Metadaten, ohne abschliessenden Schrägstrich. */
export async function getBaseUrl(): Promise<string> {
  const h = await headers();
  const proto = h.get("x-forwarded-proto")?.split(",")[0]?.trim();
  return baseUrl(h.get("x-forwarded-host") ?? h.get("host") ?? undefined, proto);
}

/**
 * Basis-URL der Seite. Sie stammt NUR aus festen Werten (SITE_URL bzw. die Vereinsdomain), nie aus dem Host-Header der Anfrage –
 * sonst liessen sich Reset-/Bestätigungslinks auf fremde Domains lenken. Nur ausserhalb der Produktion wird für lokale Tests
 * ein localhost-Host (mit Port) übernommen.
 */
export function baseUrl(requestHost?: string, proto?: string): string {
  if (process.env.NODE_ENV !== "production" && requestHost) {
    const h = requestHost.split(",")[0]!.trim();
    if (/^(localhost|127\.0\.0\.1)(:\d{1,5})?$/.test(h)) {
      return `${proto === "https" ? "https" : "http"}://${h}`;
    }
  }
  return site.url.replace(/\/+$/, "");
}
