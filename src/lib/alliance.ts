// Struktur der Allianz. Einzige Quelle für die Fakten der Seite /allianz – Namen, Leitung, Domain und Status hier anpassen.
// Die Texte (Region, Beschreibung, Aufgabe) stehen in src/i18n/allianz.ts, indexiert nach dem Namen.
// Diese Website ist der Schweizer Ursprungsverein. Alle übrigen Einheiten sind reiner Inhalt der Seite: Sie werden nur beschrieben
// und höchstens als normale externe Links gezeigt, es gibt keine technische Verbindung zu ihnen.

/** Die europäische Zweitstelle (eigenständige Firma, getrennt vom Verein). */
export const europe = {
  name: "VylarisGroupEurope",
  domain: "vylaris.eu",
  url: "https://vylaris.eu",
  leader: { name: "Lucas Wilms", company: "CircleUp-Wilms Webhosting & IT-Services" },
} as const;

export type Branch = {
  name: string;
  /** Region als Rückfall, falls das Wörterbuch keinen Eintrag hat. */
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
    domain: "vylaris.de",
  },
  {
    name: "VylarisGroupAmerica",
    region: "Nordamerika",
    status: "aktiv",
    domain: "vylaris.net",
  },
];

/** Gemeinsame Einheiten der Allianz (zwischen Zweitstelle und Niederlassungen). */
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
 * Bausteine des Rechenzentrums von VylarisData. Zahlen und ein Stand-Datum stehen bewusst nicht hier, solange der Auftraggeber
 * sie nicht bestätigt hat; den Live-Stand zeigt vylarisdata.com/infrastruktur. "state": ok = im Betrieb, building = im Aufbau, maintenance = in Wartung, planned = geplant.
 */
export const dataCenter = {
  url: "https://vylarisdata.com",
  statusUrl: "https://vylarisdata.com/infrastruktur/",
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
