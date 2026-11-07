// Schalter für Impressum und Datenschutzerklärung: welche Angaben und Abschnitte angezeigt werden.
// Reine Logik ohne Server- und Datenbankzugriff (auch im Browser nutzbar, mit Test in scripts/test/legal-settings.test.mts).
//
// Speicherung (SiteSetting):
//   legal.show.<element>           Impressum, «true» | «false»  (Vorgabe: angezeigt, ausser das Feld ist leer)
//   legal.show.privacy.<abschnitt> Datenschutzerklärung, «true» | «false»  (Vorgabe: angezeigt)
//   legal.privacyUpdatedAt         Stand der Datenschutzerklärung (ISO-Datum), wird beim Speichern nachgeführt
// Frühere Schlüssel legal.hideRegister / legal.hideVat werden beim Lesen übernommen (siehe resolveShow).

// ---- Angaben des Anbieters ------------------------------------------------------------------------------------------

export const LEGAL_FIELDS = ["responsible", "street", "zipCity", "country", "phone", "register", "vatId", "email"] as const;
export type LegalField = (typeof LEGAL_FIELDS)[number];
/** Aussagen zum Verein (keine Anzeige-Schalter): nicht mehrwertsteuerpflichtig, nicht im Handelsregister eingetragen. */
export const LEGAL_FLAGS = ["smallBusiness", "noRegister"] as const;
export type LegalFlag = (typeof LEGAL_FLAGS)[number];

/** Was für die Anzeige im Impressum vorliegt. */
export type LegalContent = {
  street: string;
  zipCity: string;
  country: string;
  phone: string;
  register: string;
  vatId: string;
  email: string;
  smallBusiness: boolean;
  noRegister: boolean;
  /** Anzahl Vorstandsmitglieder in den Stammdaten; undefined = unbekannt (gilt als vorhanden). */
  boardCount?: number;
};

// ---- Impressum --------------------------------------------------------------------------------------------------------

export type ImprintGroup = "angaben" | "hinweise";

export const IMPRINT_GROUPS = [
  { id: "angaben", title: "Angaben", description: "Wer der Verein ist und wie man ihn erreicht." },
  { id: "hinweise", title: "Hinweise", description: "Haftung, Urheberrecht und Verweis auf die Datenschutzerklärung." },
] as const satisfies readonly { id: ImprintGroup; title: string; description: string }[];

type ImprintItemDef = {
  key: string;
  group: ImprintGroup;
  label: string;
  description: string;
  /** Felder, aus denen der Inhalt stammt (leer = Anzeige ist ohne Eingabe möglich). */
  fields?: readonly LegalField[];
};

export const IMPRINT_ITEMS = [
  { key: "name", group: "angaben", label: "Vereinsname", description: "Name des Vereins als Anbieter der Website." },
  {
    key: "legalForm",
    group: "angaben",
    label: "Rechtsform",
    description: "«Verein im Sinne von Art. 60 ff. ZGB, nicht gewinnorientiert».",
  },
  {
    key: "address",
    group: "angaben",
    label: "Anschrift",
    description: "Strasse, PLZ/Ort und Land des Vereins.",
    fields: ["street", "zipCity"],
  },
  {
    key: "board",
    group: "angaben",
    label: "Vertretung (Vorstand)",
    description: "Mitglieder des Vorstands mit ihrer Funktion; sie vertreten den Verein.",
  },
  {
    key: "responsible",
    group: "angaben",
    label: "Ansprechperson",
    description: "Verantwortliche Person; ohne eigene Angabe erscheint der Präsident aus den Stammdaten.",
  },
  { key: "website", group: "angaben", label: "Website", description: "Domain der Website." },
  {
    key: "email",
    group: "angaben",
    label: "E-Mail-Adresse",
    description: "Kontakt-E-Mail des Vereins.",
    fields: ["email"],
  },
  {
    key: "phone",
    group: "angaben",
    label: "Telefon",
    description: "Telefonnummer. Gilt auch für die Angabe in der Datenschutzerklärung.",
    fields: ["phone"],
  },
  {
    key: "contactForm",
    group: "angaben",
    label: "Hinweis auf das Kontaktformular",
    description: "Zeile mit Link zum Kontaktformular und der Hinweis, dass Anfragen als Ticket bearbeitet werden.",
  },
  {
    key: "register",
    group: "angaben",
    label: "Handelsregister / UID",
    description: "Registereintrag bzw. der Hinweis «nicht im Handelsregister eingetragen». Nur nötig, wenn zutreffend.",
    fields: ["register"],
  },
  {
    key: "vat",
    group: "angaben",
    label: "MWST-Nummer",
    description: "MWST-Nummer bzw. der Hinweis «nicht mehrwertsteuerpflichtig». Nur nötig, wenn zutreffend.",
    fields: ["vatId"],
  },
  {
    key: "liabilityContent",
    group: "hinweise",
    label: "Haftung für Inhalte",
    description: "Haftungsausschluss zu Inhalten und Diensten der Website.",
  },
  {
    key: "liabilityLinks",
    group: "hinweise",
    label: "Haftung für Links",
    description: "Hinweis zu Links auf Websites Dritter.",
  },
  {
    key: "copyright",
    group: "hinweise",
    label: "Urheberrecht",
    description: "Urheberrecht an Inhalten, Open-Source-Lizenzen und Meldung von Verletzungen.",
  },
  {
    key: "privacyLink",
    group: "hinweise",
    label: "Hinweis auf die Datenschutzerklärung",
    description: "Kurzer Abschnitt mit Link zur Datenschutzerklärung.",
  },
] as const satisfies readonly ImprintItemDef[];

export type ImprintKey = (typeof IMPRINT_ITEMS)[number]["key"];
export const IMPRINT_KEYS = IMPRINT_ITEMS.map((i) => i.key) as ImprintKey[];
export type ImprintShow = Record<ImprintKey, boolean>;

/** Abschnitte des Impressums in der Reihenfolge der Seite. Ein Abschnitt erscheint, wenn mindestens eine Angabe sichtbar ist. */
export const IMPRINT_SECTIONS = [
  { id: "anbieter", title: "Angaben zum Anbieter", keys: ["name", "legalForm", "address", "board", "responsible", "website"] },
  { id: "kontakt", title: "Kontakt", keys: ["email", "phone", "contactForm"] },
  { id: "register", title: "Handelsregister und Mehrwertsteuer", keys: ["register", "vat"] },
  { id: "haftung-inhalte", title: "Haftungsausschluss", keys: ["liabilityContent"] },
  { id: "haftung-links", title: "Haftung für Links", keys: ["liabilityLinks"] },
  { id: "urheberrecht", title: "Urheberrecht", keys: ["copyright"] },
  { id: "datenschutz", title: "Datenschutz", keys: ["privacyLink"] },
] as const satisfies readonly { id: string; title: string; keys: readonly ImprintKey[] }[];

export type ImprintSectionId = (typeof IMPRINT_SECTIONS)[number]["id"];

/** Hat die Angabe etwas, das angezeigt werden könnte? (Leere Felder werden nie als leere Zeile ausgegeben.) */
export function imprintHasContent(key: ImprintKey, c: LegalContent): boolean {
  switch (key) {
    case "address":
      return Boolean(c.street.trim() || c.zipCity.trim());
    case "email":
      return Boolean(c.email.trim());
    case "phone":
      return Boolean(c.phone.trim());
    case "register":
      return c.noRegister || Boolean(c.register.trim());
    case "vat":
      return c.smallBusiness || Boolean(c.vatId.trim());
    case "board":
      return c.boardCount === undefined || c.boardCount > 0;
    default:
      return true;
  }
}

/** Angezeigt = Schalter an und Inhalt vorhanden. */
export function visibleImprint(show: ImprintShow, c: LegalContent): ImprintShow {
  const out = {} as ImprintShow;
  for (const k of IMPRINT_KEYS) out[k] = show[k] && imprintHasContent(k, c);
  return out;
}

/** Schalter, die angehakt sind, deren Feld aber leer ist (Warnung «Feld ist leer»). */
export function emptyShownKeys(show: ImprintShow, c: LegalContent): ImprintKey[] {
  return IMPRINT_ITEMS.filter((i) => "fields" in i && show[i.key] && !imprintHasContent(i.key, c)).map((i) => i.key);
}

export type PlannedSection = { id: string; title: string; number: number };

/** Sichtbare Abschnitte des Impressums, fortlaufend nummeriert (Grundlage für Inhaltsverzeichnis und Nummern). */
export function imprintSections(visible: ImprintShow): PlannedSection[] {
  const out: PlannedSection[] = [];
  for (const s of IMPRINT_SECTIONS) {
    if (!(s.keys as readonly ImprintKey[]).some((k) => visible[k])) continue;
    let title: string = s.title;
    if (s.id === "register") {
      if (visible.register && !visible.vat) title = "Handelsregister";
      else if (!visible.register && visible.vat) title = "Mehrwertsteuer";
    }
    out.push({ id: s.id, title, number: out.length + 1 });
  }
  return out;
}

// ---- Datenschutzerklärung ---------------------------------------------------------------------------------------------

export type PrivacyGroup = "website" | "verein";

export const PRIVACY_GROUPS = [
  { id: "website", title: "Website-Funktionen", description: "Funktionen der Website, bei denen Personendaten bearbeitet werden." },
  { id: "verein", title: "Vereinsfunktionen", description: "Verwaltung des Vereins: Mitglieder, Beiträge, Versammlungen, Anlässe." },
] as const satisfies readonly { id: PrivacyGroup; title: string; description: string }[];

type PrivacySectionDef = {
  id: string;
  title: string;
  /** Mit `item`: Abschnitt ist schaltbar (Schlüssel = id). Ohne: gehört immer zur Erklärung. */
  item?: { label: string; description: string; group: PrivacyGroup };
};

/** Alle Abschnitte in der Reihenfolge der Seite. */
export const PRIVACY_SECTIONS = [
  { id: "verantwortlicher", title: "Verantwortlicher" },
  { id: "ueberblick", title: "Überblick" },
  { id: "hosting", title: "Hosting und Server-Logfiles" },
  {
    id: "kontakt",
    title: "Kontaktformular und Ticket-System",
    item: {
      group: "website",
      label: "Kontaktformular und Tickets",
      description: "Anfragen über das Kontaktformular, Ticket-Bearbeitung und E-Mails zum Ticket.",
    },
  },
  {
    id: "konto",
    title: "Nutzerkonto",
    item: {
      group: "website",
      label: "Konten und Registrierung",
      description: "Registrierung, Anmeldung, Passwort-Reset, Firmenkunden-Status und Team-Profile.",
    },
  },
  {
    id: "lizenzen",
    title: "Lizenzschlüssel und Webspace-Anfragen",
    item: {
      group: "website",
      label: "Lizenzen und Webspace",
      description: "Lizenzschlüssel, Prüfung durch Installationen und Webspace-Anfragen.",
    },
  },
  {
    id: "mail",
    title: "E-Mail-Versand",
    item: {
      group: "website",
      label: "E-Mail-Versand",
      description: "Versand von Bestätigungs-, Ticket- und Vereinsmails über den eingerichteten SMTP-Server.",
    },
  },
  {
    id: "newsletter",
    title: "Newsletter",
    item: {
      group: "website",
      label: "Newsletter",
      description: "Anmeldung im Double-Opt-in, gespeicherte Daten, Abmeldung. Nur nötig, wenn der Newsletter aktiv ist.",
    },
  },
  {
    id: "cookies",
    title: "Cookies und lokaler Speicher",
    item: {
      group: "website",
      label: "Cookies und Browser-Speicher",
      description: "Sitzungs-Cookie, Cookie-Hinweis und Einträge im lokalen Speicher des Browsers.",
    },
  },
  {
    id: "missbrauchsschutz",
    title: "Missbrauchsschutz",
    item: {
      group: "website",
      label: "Missbrauchsschutz",
      description: "Begrenzung von Anfragen über die IP-Adresse (nur im Arbeitsspeicher) und Honeypot-Feld.",
    },
  },
  {
    id: "mitglieder",
    title: "Mitgliederverwaltung",
    item: {
      group: "verein",
      label: "Mitgliederverwaltung",
      description: "Stammdaten der Mitglieder, Beitrittsantrag, Ämter, Mitgliederportal und Austritt.",
    },
  },
  {
    id: "ausweis",
    title: "Digitaler Mitgliederausweis",
    item: {
      group: "verein",
      label: "Digitaler Mitgliederausweis",
      description: "Mitgliederausweis im Mitgliederportal und Türkontrolle mit der Scanner-App (Abschnitt entfällt ganz, wenn ausgeschaltet).",
    },
  },
  {
    id: "beitraege",
    title: "Beiträge, Rechnungen und Buchhaltung",
    item: {
      group: "verein",
      label: "Beiträge, Rechnungen und Buchhaltung",
      description: "Beitragsrechnungen, Zahlungen, Mahnungen, Buchungen und Belege; Aufbewahrung zehn Jahre (Art. 958f OR).",
    },
  },
  {
    id: "versammlungen",
    title: "Versammlungen, Protokolle und Beschlüsse",
    item: {
      group: "verein",
      label: "Versammlungen und Protokolle",
      description: "Einladungen, Traktanden, Anwesenheit, Protokolle und Beschlüsse.",
    },
  },
  {
    id: "anlaesse",
    title: "Anlässe und Anmeldungen",
    item: {
      group: "verein",
      label: "Anlässe, Anmeldungen und Gäste",
      description: "Anmeldungen von Mitgliedern und Gästen, Warteliste und Abmeldung.",
    },
  },
  {
    id: "dokumente",
    title: "Dokumentenablage",
    item: {
      group: "verein",
      label: "Dokumentenablage",
      description: "Statuten, Reglemente, Protokolle und weitere Dokumente mit Sichtbarkeit und Versionen.",
    },
  },
  {
    id: "audit",
    title: "Änderungsprotokoll (Audit)",
    item: {
      group: "verein",
      label: "Audit-Protokoll",
      description: "Protokoll sensibler Änderungen in der Verwaltung zur Nachvollziehbarkeit.",
    },
  },
  { id: "empfaenger", title: "Empfänger" },
  { id: "ausland", title: "Bekanntgabe ins Ausland" },
  { id: "aufbewahrung", title: "Aufbewahrung und Löschung" },
  {
    id: "links",
    title: "Externe Links",
    item: {
      group: "website",
      label: "Externe Links",
      description: "Hinweis zu Links auf andere Standorte, X, YouTube, Instagram, Discord und WhatsApp.",
    },
  },
  { id: "rechte", title: "Deine Rechte" },
  { id: "sicherheit", title: "Datensicherheit" },
  { id: "aenderungen", title: "Änderungen dieser Erklärung" },
] as const satisfies readonly PrivacySectionDef[];

/** Weitere Schalter ohne eigenen Abschnitt (wirken innerhalb anderer Abschnitte). */
const PRIVACY_EXTRA = [
  {
    id: "tunnel",
    title: "Tunnel-/Proxy-Dienst",
    item: {
      group: "website",
      label: "Tunnel-/Proxy-Dienst",
      description: "Absatz zum vorgeschalteten Dienst (z. B. Cloudflare Tunnel) unter «Hosting»; wirkt auch auf «Empfänger» und «Bekanntgabe ins Ausland».",
    },
  },
] as const satisfies readonly PrivacySectionDef[];

type SwitchableSection = Extract<(typeof PRIVACY_SECTIONS)[number], { item: object }>;
export type PrivacyKey = SwitchableSection["id"] | (typeof PRIVACY_EXTRA)[number]["id"];
export type PrivacyShow = Record<PrivacyKey, boolean>;

export type PrivacyItem = { key: PrivacyKey; title: string; label: string; description: string; group: PrivacyGroup };

/** Schaltbare Punkte der Datenschutzerklärung für das Admin (Reihenfolge je Gruppe wie auf der Seite, «tunnel» zuletzt). */
export const PRIVACY_ITEMS: readonly PrivacyItem[] = ([...PRIVACY_SECTIONS, ...PRIVACY_EXTRA] as readonly PrivacySectionDef[]).flatMap((s) =>
  s.item ? [{ key: s.id as PrivacyKey, title: s.title, ...s.item }] : [],
);
export const PRIVACY_KEYS = PRIVACY_ITEMS.map((i) => i.key) as PrivacyKey[];

/** Abschnitte, die immer in der Erklärung stehen (nicht schaltbar). */
export const PRIVACY_ALWAYS = (PRIVACY_SECTIONS as readonly PrivacySectionDef[]).filter((s) => !s.item).map((s) => s.title);

export type PrivacyPlan = {
  sections: PlannedSection[];
  /** Nummer eines Abschnitts, undefined wenn er nicht in der Erklärung steht. */
  numberOf: (id: string) => number | undefined;
  /** Ist der Schalter an? (Für Abschnitte und für Teilabsätze wie «tunnel».) */
  has: (key: PrivacyKey) => boolean;
  /** Ids abgeschalteter Abschnitte (für Ersatz-Anker). */
  disabledAnchors: string[];
};

export function privacyPlan(show: PrivacyShow): PrivacyPlan {
  const sections: PlannedSection[] = [];
  const disabledAnchors: string[] = [];
  for (const s of PRIVACY_SECTIONS) {
    if ("item" in s && !show[s.id]) {
      disabledAnchors.push(s.id);
      continue;
    }
    sections.push({ id: s.id, title: s.title, number: sections.length + 1 });
  }
  const numbers = new Map(sections.map((s) => [s.id, s.number]));
  return { sections, numberOf: (id) => numbers.get(id), has: (key) => show[key] === true, disabledAnchors };
}

/**
 * Verweis «Abschnitt 4», «Abschnitte 5 und 6», «Abschnitte 5 bis 7», «Abschnitte 3, 5 und 9».
 * Nicht vorhandene Abschnitte (undefined) entfallen; ohne Treffer ist das Ergebnis leer.
 */
export function formatSectionRefs(nums: ReadonlyArray<number | undefined>): string {
  const n = [...new Set(nums.filter((x): x is number => typeof x === "number"))].sort((a, b) => a - b);
  if (n.length === 0) return "";
  if (n.length === 1) return `Abschnitt ${n[0]}`;
  if (n.length === 2) return `Abschnitte ${n[0]} und ${n[1]}`;
  if (n.every((v, i) => i === 0 || v === n[i - 1] + 1)) return `Abschnitte ${n[0]} bis ${n[n.length - 1]}`;
  return `Abschnitte ${n.slice(0, -1).join(", ")} und ${n[n.length - 1]}`;
}

/** Link auf die Datenschutzerklärung; ein Anker nur, wenn der Abschnitt auch angezeigt wird (sonst läuft er ins Leere). */
export function privacyHref(show: PrivacyShow, anchor?: string): string {
  if (!anchor) return "/datenschutz";
  const switchable = PRIVACY_SECTIONS.some((s) => s.id === anchor && "item" in s);
  if (switchable && show[anchor as PrivacyKey] === false) return "/datenschutz";
  return `/datenschutz#${anchor}`;
}

// ---- Speicherung und Auflösung -----------------------------------------------------------------------------------------

export const imprintSettingKey = (k: ImprintKey) => `legal.show.${k}`;
export const privacySettingKey = (k: PrivacyKey) => `legal.show.privacy.${k}`;
export const PRIVACY_UPDATED_KEY = "legal.privacyUpdatedAt";
/** Frühere Schlüssel der Anzeige-Häkchen: «ausblenden». Werden beim Lesen in die neuen Schalter übernommen. */
const LEGACY_HIDE: Partial<Record<ImprintKey, string>> = { register: "legal.hideRegister", vat: "legal.hideVat" };
export const LEGACY_SETTING_KEYS = Object.values(LEGACY_HIDE);

export function parseBool(v: string | undefined | null): boolean | undefined {
  if (v === "true") return true;
  if (v === "false") return false;
  return undefined;
}

/**
 * Löst die gespeicherten Werte zu Schaltern auf. Reihenfolge je Impressum-Element:
 * 1. ausdrücklich gespeicherter Schalter (legal.show.<element>),
 * 2. früheres Häkchen «ausblenden» (legal.hideRegister / legal.hideVat = true → aus),
 * 3. Vorgabe: angezeigt, ausser das zugehörige Feld ist leer.
 * Datenschutz-Abschnitte: gespeicherter Schalter, sonst angezeigt.
 */
export function resolveShow(
  stored: Readonly<Record<string, string | undefined>>,
  c: LegalContent,
): { imprint: ImprintShow; privacy: PrivacyShow } {
  const imprint = {} as ImprintShow;
  for (const k of IMPRINT_KEYS) {
    const explicit = parseBool(stored[imprintSettingKey(k)]);
    const legacyKey = LEGACY_HIDE[k];
    const legacyHidden = legacyKey ? parseBool(stored[legacyKey]) === true : false;
    imprint[k] = explicit ?? (legacyHidden ? false : imprintHasContent(k, c));
  }
  const privacy = {} as PrivacyShow;
  for (const k of PRIVACY_KEYS) privacy[k] = parseBool(stored[privacySettingKey(k)]) ?? true;
  return { imprint, privacy };
}

/** Schalter → SiteSetting-Werte. Unbekannte Schlüssel und Nicht-Booleans werden ignoriert. */
export function showToSettings(
  imprint: Readonly<Record<string, boolean | undefined>> | undefined,
  privacy: Readonly<Record<string, boolean | undefined>> | undefined,
): Record<string, string> {
  const rec: Record<string, string> = {};
  for (const k of IMPRINT_KEYS) if (typeof imprint?.[k] === "boolean") rec[imprintSettingKey(k)] = String(imprint[k]);
  for (const k of PRIVACY_KEYS) if (typeof privacy?.[k] === "boolean") rec[privacySettingKey(k)] = String(privacy[k]);
  return rec;
}

/** Setzt alle Schalter einer Gruppe auf einen Wert (Knöpfe «Alle an» / «Alle aus»). */
export function setImprintGroup(show: ImprintShow, group: ImprintGroup, value: boolean): ImprintShow {
  const next = { ...show };
  for (const i of IMPRINT_ITEMS) if (i.group === group) next[i.key] = value;
  return next;
}
export function setPrivacyGroup(show: PrivacyShow, group: PrivacyGroup, value: boolean): PrivacyShow {
  const next = { ...show };
  for (const i of PRIVACY_ITEMS) if (i.group === group) next[i.key] = value;
  return next;
}

// ---- Stand-Datum --------------------------------------------------------------------------------------------------------

/** Gültiges ISO-Datum «JJJJ-MM-TT» oder leer. */
export function parseIsoDate(v: string | undefined | null): string {
  if (!v || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return "";
  const d = new Date(`${v}T00:00:00Z`);
  return Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== v ? "" : v;
}

/** Heutiges Datum in Zürcher Zeit als «JJJJ-MM-TT». */
export function todayZurich(now: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Zurich", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(now);
  const p = (t: string) => parts.find((x) => x.type === t)?.value ?? "";
  return `${p("year")}-${p("month")}-${p("day")}`;
}

/** Was in der Datenschutzerklärung steht und sich über die Rechtliches-Einstellungen ändern lässt. */
export type PrivacySnapshot = {
  street: string;
  zipCity: string;
  country: string;
  email: string;
  phone: string;
  /** Schalter «Telefon» des Impressums (gilt auch für die Datenschutzerklärung). */
  showPhone: boolean;
  privacy: PrivacyShow;
};

/** Hat sich die Datenschutzerklärung inhaltlich geändert? Dann wird der Stand beim Speichern erneuert. */
export function privacyChanged(before: PrivacySnapshot, after: PrivacySnapshot): boolean {
  const fields = ["street", "zipCity", "country", "email", "phone", "showPhone"] as const;
  if (fields.some((f) => before[f] !== after[f])) return true;
  return PRIVACY_KEYS.some((k) => before.privacy[k] !== after.privacy[k]);
}

// ---- Hinweise für das Admin (nicht blockierend) ----------------------------------------------------------------------

const LABEL = {
  name: "Vereinsname",
  address: "Anschrift",
  email: "E-Mail-Adresse",
} as const;

/**
 * Sachlicher Hinweis, wenn Angaben fehlen, die bei Online-Angeboten erwartet werden:
 * Art. 3 Abs. 1 lit. s UWG verlangt im elektronischen Geschäftsverkehr klare und vollständige Angaben zu Identität
 * und Kontaktadresse, einschliesslich der E-Mail-Adresse. Leer, wenn alles vorhanden ist. Keine Rechtsberatung.
 */
export function imprintWarnings(visible: ImprintShow): string[] {
  const missing = (["name", "address", "email"] as const).filter((k) => !visible[k]).map((k) => LABEL[k]);
  if (missing.length === 0) return [];
  return [
    `Nach Art. 3 Abs. 1 lit. s UWG werden im elektronischen Geschäftsverkehr klare und vollständige Angaben zur Identität und zur Kontaktadresse, einschliesslich der E-Mail-Adresse, erwartet. Im Impressum erscheint zurzeit nicht: ${missing.join(", ")}. Der Verein entscheidet, ob das für seine Website zutrifft.`,
  ];
}

/**
 * Sachlicher Hinweis, wenn Abschnitte der Datenschutzerklärung abgeschaltet sind: Art. 19 revDSG verlangt, über die
 * Beschaffung von Personendaten angemessen zu informieren, sobald sie bearbeitet werden. Leer, wenn nichts abgeschaltet ist.
 */
export function privacyWarnings(show: PrivacyShow): string[] {
  const off = PRIVACY_ITEMS.filter((i) => !show[i.key]).map((i) => i.label);
  if (off.length === 0) return [];
  return [
    `Abgeschaltet: ${off.join(", ")}. Nach Art. 19 revDSG ist über die Beschaffung von Personendaten angemessen zu informieren, sobald sie bearbeitet werden. Schalte einen Abschnitt nur ab, wenn die Funktion nicht genutzt wird oder auf andere Weise informiert wird.`,
  ];
}
