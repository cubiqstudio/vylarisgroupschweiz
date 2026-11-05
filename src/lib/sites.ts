// Multi-Domain-Betrieb: Eine App, mehrere Domains. Der Hostname der Anfrage bestimmt Marke, Sprache, Ansprechpartner
// und Rechtstexte. Reine Daten ohne Node-APIs – nutzbar in Middleware, Server- und Client-Komponenten.
// Neue Domain oder geänderte Ansprechpartner: nur diese Datei anpassen.

export type Locale = "de" | "en";
export type SiteKey = "eu" | "de" | "net" | "at";

export type SiteProfile = {
  key: SiteKey;
  locale: Locale;
  /** Kanonische Domain ohne "www." */
  domain: string;
  /** Markenname, z. B. "VylarisGroupEurope" */
  name: string;
  /** Kurzform für enge Stellen */
  shortName: string;
  /** Region als Wort für Texte: Europe | Germany | America | Austria */
  region: "Europe" | "Germany" | "America" | "Austria";
  /** Verantwortliche Person (Ansprechpartner) dieses Standorts */
  leader: { name: string; company?: string };
  /** false = Seite ist (noch) nicht online */
  online: boolean;
  /** true = Hauptseite (Basis für Links in Team-Mails an das Admin-Team). Der Verwaltungsbereich ist auf allen Domains erreichbar. */
  primary: boolean;
  /** Art des Rechtstexts: eu = Impressum aus den Admin-Einstellungen, de = wie eu mit anderem Ansprechpartner, net = US-Legal-Notice */
  legal: "eu" | "de" | "net";
  /** Öffentliche Kontaktadresse (Legal Notice); leer = aus Admin-Einstellungen */
  contactEmail?: string;
  /** Standort-Angabe für die Legal Notice (nur net) */
  jurisdiction?: string;
};

export const SITES: Record<SiteKey, SiteProfile> = {
  eu: {
    key: "eu",
    locale: "de",
    domain: "vylaris.eu",
    name: "VylarisGroupEurope",
    shortName: "Vylaris Europe",
    region: "Europe",
    leader: { name: "Lucas Wilms", company: "CircleUp-Wilms Webhosting & IT-Services" },
    online: true,
    primary: true,
    legal: "eu",
  },
  de: {
    key: "de",
    locale: "de",
    domain: "vylaris.de",
    name: "VylarisGroupGermany",
    shortName: "Vylaris Germany",
    region: "Germany",
    // Gleiche Anschrift wie vylaris.eu, anderer Ansprechpartner.
    leader: { name: "Florian Brandt" },
    online: true,
    primary: false,
    legal: "de",
  },
  net: {
    key: "net",
    locale: "en",
    domain: "vylaris.net",
    name: "VylarisGroupAmerica",
    shortName: "Vylaris America",
    region: "America",
    leader: { name: "Sven Thompson" },
    online: true,
    primary: false,
    legal: "net",
    // TODO(Betreiber): Adresse prüfen/anpassen, sie erscheint in der Legal Notice von vylaris.net.
    contactEmail: "contact@vylaris.net",
    jurisdiction: "Phoenix, Arizona, United States",
  },
  at: {
    key: "at",
    locale: "de",
    domain: "vylaris.at",
    name: "VylarisGroupAustria",
    shortName: "Vylaris Austria",
    region: "Austria",
    leader: { name: "" },
    // Noch nicht fertig: die Domain liefert nur eine Offline-Seite (kein DNS-Eintrag, kein Tunnel-Hostname).
    online: false,
    primary: false,
    legal: "eu",
  },
};

export const DEFAULT_SITE: SiteKey = "eu";

const BY_HOST = new Map<string, SiteKey>(
  (Object.values(SITES) as SiteProfile[]).flatMap((s) => [
    [s.domain, s.key] as [string, SiteKey],
    [`www.${s.domain}`, s.key] as [string, SiteKey],
  ]),
);

/** Host-Header vereinheitlichen: erster Wert, klein, ohne Port und ohne abschließenden Punkt. */
export function normalizeHost(host: string | null | undefined): string {
  return (host ?? "").split(",")[0]!.trim().toLowerCase().replace(/:\d+$/, "").replace(/\.+$/, "");
}

/** Hostname (mit oder ohne Port) → Profil. Unbekannte Hosts (localhost, IP, Vorschau) fallen auf vylaris.eu zurück. */
export function siteForHost(host: string | null | undefined): SiteProfile {
  return SITES[BY_HOST.get(normalizeHost(host)) ?? DEFAULT_SITE];
}

/** true, wenn der Host zu einer der bekannten Vylaris-Domains gehört. */
export function isKnownHost(host: string | null | undefined): boolean {
  return BY_HOST.has(normalizeHost(host));
}

export const ALL_SITES = Object.values(SITES) as SiteProfile[];

/** Alle Domains, die über den Tunnel/Proxy bedient werden sollen (nur Standorte, die online sind). */
export const ONLINE_DOMAINS = ALL_SITES.filter((s) => s.online).map((s) => s.domain);
