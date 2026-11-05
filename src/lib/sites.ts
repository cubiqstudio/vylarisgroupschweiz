// Profil der Seite: VylarisGroup Schweiz ist eine eigenständige Installation mit genau einer Domain und einer aktiven Sprache.
// Reine Daten ohne Node-APIs – nutzbar in Middleware, Server- und Client-Komponenten.
// Weitere Sprachen (z. B. FR/IT) kommen später hinzu: Locale erweitern, LOCALES ergänzen, defineMessages bekommt dann weitere Argumente.

export type Locale = "de";
export type SiteKey = "ch";

export const LOCALES = ["de"] as const satisfies readonly Locale[];
export const DEFAULT_LOCALE: Locale = "de";

export type BoardMember = {
  name: string;
  /** Funktion im Vereinsvorstand */
  role: string;
  /** Berufliche Stellung (i. A. = in Ausbildung) */
  occupation: string;
};

export type SiteProfile = {
  key: SiteKey;
  locale: Locale;
  /** Kanonische Domain ohne "www." */
  domain: string;
  /** Markenname */
  name: string;
  /** Kurzform für enge Stellen */
  shortName: string;
  /** Rechtsträger (Verein) */
  legalName: string;
  /** Ansprechperson und Vertretung nach aussen: der Präsident */
  leader: { name: string; role: string };
  /** Vorstand des Vereins */
  board: readonly BoardMember[];
};

export const SITE: SiteProfile = {
  key: "ch",
  locale: DEFAULT_LOCALE,
  domain: "vylaris.ch",
  name: "VylarisGroup Schweiz",
  shortName: "Vylaris Schweiz",
  legalName: "VylarisGroup",
  leader: { name: "Linus Fausch", role: "Präsident" },
  board: [
    { name: "Linus Fausch", role: "Präsident", occupation: "Informatiker Plattformentwicklung i. A." },
    { name: "Christopher Niedermann", role: "Vize-Präsident und Kassier", occupation: "Informatiker Applikationsentwicklung i. A." },
    { name: "Hüseyn Hüseynli", role: "Aktuar und Entwickler", occupation: "Informatiker Plattformentwicklung i. A." },
  ],
};
