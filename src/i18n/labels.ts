import { defineMessages, type Locale } from "@/i18n";

/** Öffentliche Beschriftungen für Status, Vorfälle, Kategorien. (Admin bleibt deutsch: src/lib/constants.ts) */
export const labels = defineMessages(
  {
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
    /** Kategorien sind in der DB deutsche Strings; hier die Anzeige je Sprache. */
    category: {} as Record<string, string>,
    /** Anzeigenamen der Infrastruktur-Komponenten nach Slug (nur die mitgelieferten; neue erscheinen unübersetzt). */
    metricName: {} as Record<string, string>,
    metricLocation: {} as Record<string, string>,
    badge: { comingSoon: "Bald verfügbar" } as Record<string, string>,
    /** Autorennamen sind in der DB deutsch gespeichert; Deutsch bleibt unverändert (leer = Fallback auf den gespeicherten Namen). */
    author: {} as Record<string, string>,
    ticketCategory: { GENERAL: "Allgemein", B2B_HOSTING: "B2B-Hosting", SECURITY_REPORT: "Security-Report" } as Record<string, string>,
    ticketStatus: { OPEN: "Offen", IN_PROGRESS: "In Bearbeitung", CLOSED: "Geschlossen" } as Record<string, string>,
  },
  {
    status: { OPERATIONAL: "Operational", MAINTENANCE: "Maintenance", OUTAGE: "Outage" } as Record<string, string>,
    overall: {
      OPERATIONAL: "All systems operational",
      MAINTENANCE: "Scheduled maintenance",
      OUTAGE: "Ongoing outage",
    } as Record<string, string>,
    severity: { MINOR: "Minor", MAJOR: "Major", MAINTENANCE: "Maintenance" } as Record<string, string>,
    incidentStatus: {
      SCHEDULED: "Scheduled",
      INVESTIGATING: "Investigating",
      IDENTIFIED: "Identified",
      MONITORING: "Monitoring",
      RESOLVED: "Resolved",
    } as Record<string, string>,
    metricKind: { SERVER: "Server", NETWORK: "Network", DATABASE: "Database", STORAGE: "Storage", OTHER: "Other" } as Record<string, string>,
    category: {
      Sicherheit: "Security",
      Kommunikation: "Communication",
      Produktivität: "Productivity",
      Infrastruktur: "Infrastructure",
      "Entwickler-Tools": "Developer tools",
    } as Record<string, string>,
    metricName: {
      "server-primaer": "Primary server Europe",
      "server-failover": "Secondary server Europe (failover)",
      "netzwerk-dns": "Network & DNS",
      "datenbank-cluster": "Database cluster",
      "backup-speicher": "Backup storage",
    } as Record<string, string>,
    metricLocation: { Europa: "Europe" } as Record<string, string>,
    badge: { comingSoon: "Coming soon" } as Record<string, string>,
    author: { "Redaktion VylarisGroup": "VylarisGroup Editorial Team" } as Record<string, string>,
    ticketCategory: { GENERAL: "General", B2B_HOSTING: "B2B hosting", SECURITY_REPORT: "Security report" } as Record<string, string>,
    ticketStatus: { OPEN: "Open", IN_PROGRESS: "In progress", CLOSED: "Closed" } as Record<string, string>,
  },
);

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
