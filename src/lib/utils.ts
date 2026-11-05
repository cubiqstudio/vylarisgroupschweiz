import { clsx, type ClassValue } from "clsx";

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/ß/g, "ss")
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

type L = "de" | "en";
const fmts = {
  de: {
    date: new Intl.DateTimeFormat("de-DE", { day: "2-digit", month: "long", year: "numeric", timeZone: "Europe/Berlin" }),
    dateTime: new Intl.DateTimeFormat("de-DE", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Berlin" }),
    suffix: " Uhr",
    num: "de-DE",
  },
  en: {
    date: new Intl.DateTimeFormat("en-US", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }),
    dateTime: new Intl.DateTimeFormat("en-US", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "UTC" }),
    suffix: " UTC",
    num: "en-US",
  },
} as const;

/** Datum in der Sprache der Seite (Standard: Deutsch). */
export function formatDate(d: Date | string | null | undefined, locale: L = "de"): string {
  if (!d) return "–";
  return fmts[locale].date.format(new Date(d));
}
export function formatDateTime(d: Date | string | null | undefined, locale: L = "de"): string {
  if (!d) return "–";
  return `${fmts[locale].dateTime.format(new Date(d))}${fmts[locale].suffix}`;
}

export function formatUptime(v: number, locale: L = "de"): string {
  return `${v.toLocaleString(fmts[locale].num, { minimumFractionDigits: 2, maximumFractionDigits: 3 })} %`;
}

/** Zahl in der Sprache der Seite. */
export function formatNumber(n: number, locale: L = "de"): string {
  return n.toLocaleString(fmts[locale].num);
}
