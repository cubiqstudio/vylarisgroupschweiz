// Links für Mails und Seiten: ausschliesslich auf der festen Basis-URL der Website (src/lib/site.ts → SITE_URL bzw. Vereinsdomain),
// nie aus dem Host-Header der Anfrage.
import { site } from "@/lib/site";

/** Absolute Adresse auf der Website, z. B. publicUrl("/anlaesse/abc") oder publicUrl("/account/verein", { tab: "x" }). */
export function publicUrl(path: string, params?: Record<string, string>): string {
  if (!path.startsWith("/") || path.startsWith("//") || /[\\\u0000-\u001f]/.test(path)) throw new RangeError("Ungültiger Pfad.");
  const base = site.url.replace(/\/+$/, "");
  const qs = params && Object.keys(params).length ? `?${new URLSearchParams(params).toString()}` : "";
  return `${base}${path}${qs}`;
}

export const memberPortalUrl = (sub = ""): string => publicUrl(`/account/verein${sub ? `/${sub.replace(/^\/+/, "")}` : ""}`);
export const eventUrl = (eventId: string): string => publicUrl(`/anlaesse/${encodeURIComponent(eventId)}`);
export const eventCancelUrl = (eventId: string, token: string): string => publicUrl(`/anlaesse/${encodeURIComponent(eventId)}/abmelden`, { token });
export const joinUrl = (): string => publicUrl("/mitglied-werden");
