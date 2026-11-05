import { defineMessages, type Locale } from "@/i18n";

/** Öffentliche Beschriftungen für Status, Vorfälle, Kategorien (Anzeigenamen für den Admin: src/lib/constants.ts) */
export const labels = defineMessages({
  status: { OPERATIONAL: "Betriebsbereit", MAINTENANCE: "Wartung", OUTAGE: "Störung" } as Record<string, string>,
  overall: {
    OPERATIONAL: "Alle Systeme betriebsbereit",
    MAINTENANCE: "Geplante Wartungsarbeiten",
    OUTAGE: "Aktuelle Störung",
  } as Record<string, string>,
  severity: { MINOR: "Geringfügig", MAJOR: "Schwerwiegend", MAINTENANCE: "Wartung" } as Record<string, string>,
  incidentStatus: {
    SCHEDULED: "Geplant",
    INVESTIGATING: "Wird untersucht",
    IDENTIFIED: "Ursache gefunden",
    MONITORING: "Wird beobachtet",
    RESOLVED: "Behoben",
  } as Record<string, string>,
  metricKind: { SERVER: "Server", NETWORK: "Netzwerk", DATABASE: "Datenbank", STORAGE: "Speicher", OTHER: "Sonstiges" } as Record<string, string>,
  /** Kategorien sind in der DB deutsche Strings; hier lassen sich später Anzeigenamen je Sprache ergänzen. */
  category: {} as Record<string, string>,
  /** Anzeigenamen der Infrastruktur-Komponenten nach Slug (leer = gespeicherter Name). */
  metricName: {} as Record<string, string>,
  metricLocation: {} as Record<string, string>,
  badge: { comingSoon: "Bald verfügbar" } as Record<string, string>,
  /** Autorennamen werden unverändert aus der DB angezeigt (leer = gespeicherter Name). */
  author: {} as Record<string, string>,
  ticketCategory: { GENERAL: "Allgemein", MEMBERSHIP: "Mitgliedschaft", B2B_HOSTING: "Web-Tools & Hosting", SECURITY_REPORT: "Security-Report" } as Record<string, string>,
  ticketStatus: { OPEN: "Offen", IN_PROGRESS: "In Bearbeitung", CLOSED: "Geschlossen" } as Record<string, string>,
});

type LabelGroup = keyof (typeof labels)["de"];

/** Beschriftung nachschlagen; unbekannte Werte werden unverändert angezeigt. */
export function labelFor(group: LabelGroup, value: string, locale: Locale): string {
  return labels[locale][group][value] ?? value;
}

/** Name einer Infrastruktur-Komponente in der Sprache der Seite (Fallback: gespeicherter Name). */
export function metricName(m: { slug: string; name: string }, locale: Locale): string {
  return labels[locale].metricName[m.slug] ?? m.name;
}

export function metricLocation(location: string, locale: Locale): string {
  return labels[locale].metricLocation[location] ?? location;
}

/** Autorenname in der Sprache der Seite (Fallback: gespeicherter Name). */
export function authorName(author: string, locale: Locale): string {
  return labels[locale].author[author] ?? author;
}
