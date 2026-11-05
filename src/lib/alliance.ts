// Struktur der Allianz. Einzige Quelle für die Fakten der Seite /allianz – Namen, Leitung, Domain und Status hier anpassen.
// Die sprachabhängigen Texte (Region, Beschreibung, Aufgabe) stehen in src/i18n/allianz.ts, indexiert nach dem Namen.
export type Branch = {
  name: string;
  /** Region in deutscher Schreibweise (Rückfall, falls das Wörterbuch keinen Eintrag hat). */
  region: string;
  /** geplant = Domain noch nicht online, aktiv = Niederlassung und Domain sind online. */
  status: "geplant" | "aktiv";
  /** Verantwortliche Person (nur wenn bekannt). */
  lead?: string;
  /** Eigene Domain der Niederlassung. */
  domain: string;
};

export const branches: Branch[] = [
  {
    name: "VylarisGroupAustria",
    region: "Österreich",
    status: "geplant",
    domain: "vylaris.at",
  },
  {
    name: "VylarisGroupGermany",
    region: "Deutschland",
    status: "aktiv",
    lead: "Florian Brandt",
    domain: "vylaris.de",
  },
  {
    name: "VylarisGroupAmerica",
    region: "USA · Phoenix, Arizona",
    status: "aktiv",
    lead: "Sven Thompson",
    domain: "vylaris.net",
  },
];

/** Gemeinsame Einheiten unter VylarisGroupEurope und der Allianz (zwischen Zentrale und Niederlassungen). */
export type Unit = {
  name: string;
  /** aktiv = besteht und ist online, geplant = angekündigt */
  status: "geplant" | "aktiv";
  /** Eigene Website (nur wenn sie online ist). */
  domain?: string;
};

export const units: Unit[] = [
  { name: "VylarisData", status: "aktiv", domain: "vylarisdata.com" },
  { name: "VylarisSecurity", status: "geplant" },
];

/**
 * Eckdaten des Rechenzentrums von VylarisData (Quelle: vylarisdata.com, Stand November 2026). Den Live-Stand zeigt vylarisdata.com/infrastruktur;
 * bei Änderungen hier anpassen. "state": ok = im Betrieb, building = im Aufbau, maintenance = in Wartung, planned = geplant.
 */
export const dataCenter = {
  url: "https://vylarisdata.com",
  statusUrl: "https://vylarisdata.com/infrastruktur/",
  asOf: "2026-11",
  servers: 10,
  ssdTb: 250,
  expansion: { ssdServers: 4, ssdTbEach: 120, hddTb: 500 },
  components: [
    { id: "serversInternal", state: "ok" },
    { id: "serversExternal", state: "ok" },
    { id: "ssd", state: "ok" },
    { id: "expansion", state: "building" },
    { id: "network", state: "ok" },
    { id: "dns", state: "maintenance" },
    { id: "backup", state: "ok" },
    { id: "security", state: "ok" },
    { id: "ecosystem", state: "planned" },
  ],
} as const;

/** Weitere Bausteine des Ökosystems, die angekündigt sind. */
export const upcoming = [{ name: "VylarisSpace", id: "space" }] as const;
