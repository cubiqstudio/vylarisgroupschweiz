import { clsx, type ClassValue } from "clsx";
import { intlTag, type Locale } from "@/i18n";

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/\u00df/g, "ss")
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

const ZONE = "Europe/Zurich";
const fmts = {
  de: {
    date: new Intl.DateTimeFormat(intlTag("de"), { day: "numeric", month: "numeric", year: "numeric", timeZone: ZONE }),
    dateTime: new Intl.DateTimeFormat(intlTag("de"), { day: "numeric", month: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: ZONE }),
    suffix: " Uhr",
  },
} as const satisfies Record<Locale, unknown>;

/** Datum in der Sprache der Seite, z. B. 5.11.2026 (Standard: Deutsch/Schweiz). */
export function formatDate(d: Date | string | null | undefined, locale: Locale = "de"): string {
  if (!d) return "–";
  return fmts[locale].date.format(new Date(d));
}
export function formatDateTime(d: Date | string | null | undefined, locale: Locale = "de"): string {
  if (!d) return "–";
  return `${fmts[locale].dateTime.format(new Date(d))}${fmts[locale].suffix}`;
}

export function formatUptime(v: number, locale: Locale = "de"): string {
  return `${v.toLocaleString(intlTag(locale), { minimumFractionDigits: 2, maximumFractionDigits: 3 })} %`;
}

/** Zahl in der Sprache der Seite (de-CH). */
export function formatNumber(n: number, locale: Locale = "de"): string {
  return n.toLocaleString(intlTag(locale));
}
