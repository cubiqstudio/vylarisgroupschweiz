import { defineMessages } from "@/i18n";

type BranchText = { region: string; text: string; role: string };
type UnitText = { subtitle: string; text: string; role: string; form: string; region: string };

/** Texte der Seite "Allianz & Standorte". Niederlassungstexte sind nach Name indexiert (Fakten stehen in src/lib/alliance.ts). */
export const allianz = defineMessages({
  meta: {
    title: "Allianz & Standorte",
    description: (name: string) =>
      `Die Struktur hinter ${name}: Schweizer Verein, europäische Zweitstelle, das Rechenzentrum VylarisData, VylarisSecurity und Niederlassungen in Deutschland, Nordamerika und bald Österreich.`,
  },
  hero: {
    eyebrow: "Allianz",
    titlePre: "Ein Netzwerk aus Verein, Firma und",
    titleAccent: "Niederlassungen",
    description: (name: string) =>
      `Alles zur Struktur hinter ${name}: wer die Idee trägt, wer die Infrastruktur betreibt und wie die Gruppe von Europa aus in weitere Länder wächst.`,
  },
  shared: {
    eyebrow: "Gemeinsame Grundsätze",
    title: "Was alle Standorte verbindet",
    description:
      "Egal wo: Diese drei Punkte gelten überall in der VylarisGroup.",
    items: [
      {
        title: "Sicherheit ohne Paywall",
        text: "Datenschutz und Sicherheit gehören allen – an jedem Standort und für jede Person.",
      },
      {
        title: "100 % Open Source",
        text: "Unser Code ist offen und überprüfbar. Jede Niederlassung arbeitet nach demselben Prinzip.",
      },
      {
        title: "Privatsphäre zuerst",
        text: "Keine Tracker, keine Werbung, keine unnötigen Cookies – so arbeiten unsere Dienste und Standorte.",
      },
    ],
    contact: "Kontakt aufnehmen",
    about: "Mehr über uns",
  },
  structure: {
    eyebrow: "Allianz CH & EU",
    title: "Mehrere Standorte, eine Mission",
    description: (eu: string) =>
      `Hand in Hand: Als Schweizer Ursprungsverein tragen wir die Idee, ${eu} gibt ihr die europäische Struktur und die Infrastruktur. Darunter stehen VylarisData als Rechenzentrum und VylarisSecurity für die Sicherheit, danach wächst die Gruppe mit eigenen Niederlassungen weiter.`,
    euSubtitle: "Offizielle europäische Zweitstelle",
    lead: "Leitung",
    euLead: (name: string, company: string) =>
      `${name} – Experte für Webhosting & IT-Services (${company})`,
    task: "Aufgabe",
    euTask:
      "Die offizielle europäische Rechts- und Unternehmensstruktur sowie hochverfügbare Hosting- und Server-Infrastruktur für die Dienste der Gruppe in Europa.",
    branchesLabel: "Niederlassungen",
    euBranches: (eu: string) =>
      `Dazu gehören VylarisData und VylarisSecurity sowie die Niederlassungen: Deutschland und Nordamerika bestehen bereits, Österreich ist in Planung – alle gehen von ${eu} aus.`,
    association: "Ursprungsverein",
    associationLead: (name: string, role: string) => `${name}, ${role}`,
    associationFact: "Verein",
    members: (members: number, board: number) =>
      `${members} Mitglieder, davon ${board} im Vorstand`,
    origin: "Ursprung",
    originText:
      "Entstanden aus einem eigenen Homelab und einem Podcast – das ideelle Fundament, aus dem alles gewachsen ist.",
    contribution: "Beitrag",
    contributionText:
      "Gibt die Richtung vor: Sicherheit ohne Paywall, offen und transparent.",
    branchesOf: (eu: string) => `Niederlassungen von ${eu}`,
    statusPlanned: "In Planung",
    statusActive: "Aktiv",
    leadLabel: "Leitung:",
    notOnline: "· noch nicht online",
    newTab: "(öffnet in neuem Tab)",
    centralNote: (eu: string, euDomain: string, own: string) =>
      `Die Niederlassungen gehören zur europäischen Struktur von ${eu} (${euDomain}). Die Website des Vereins (${own}) wird eigenständig betrieben.`,
    plannedNote: (domain: string) =>
      `Die Domain für Österreich (${domain}) ist noch nicht online.`,
    more: "Weitere Standorte folgen nach demselben Prinzip",
    visit: (domain: string) => `${domain} besuchen`,
    unitsOf: "Gemeinsame Einheiten der Allianz",
    brandOf: (owner: string) => `Marke von ${owner}`,
    servers: (n: number) => `${n} Server`,
    ssd: (tb: number) => `${tb} TB SSD im Betrieb`,
    goal: "Ziel: knapp 1 PB",
    unitMore: "Mehr zum Rechenzentrum",
  },
  overview: {
    eyebrow: "Firmenaufteilung",
    title: "Wer macht was",
    description:
      "Alle Gesellschaften im Überblick – mit Rechtsform, Region und Aufgabe.",
    caption: "Gesellschaften der VylarisGroup in der Schweiz und Europa",
    columns: {
      name: "Name",
      form: "Form",
      region: "Region",
      role: "Aufgabe",
      status: "Stand",
    },
    association: "Verein",
    company: "Firma",
    branch: "Niederlassung",
    switzerland: "Schweiz",
    eu: "Europäische Union",
    associationRole: "Idee, Werte und Gemeinschaft",
    euRole: (leader: string) =>
      `Europäische Rechts- und Unternehmensstruktur, Hosting und kostenlose Open-Source-SaaS-Dienste (ohne Tracking) · Leitung ${leader}`,
    withLead: (role: string, lead: string) => `${role} · Leitung ${lead}`,
    established: "Besteht",
    planned: "In Planung",
  },
  units: {
    VylarisData: {
      subtitle: "Rechenzentrum & Technologie",
      text: "Unser komplettes Rechenzentrum und der Geschäftsbereich Software Development & Technology der VylarisGroup: eigene Server, eigener Speicher, eigenes Netz, eigene Datensicherung. VylarisData ist eine Marke von CircleUpWilms.",
      role: "Betreibt das Rechenzentrum der Gruppe (Server, Speicher, Netzwerk, Backup, Sicherheitssystem) und entwickelt Software und Technik für das Ökosystem",
      form: "Marke",
      region: "Gesamte Gruppe",
    },
    VylarisSecurity: {
      subtitle: "Sicherheit der Gruppe",
      text: "Künftiges Unternehmen, das das Sicherheitssystem der VylarisGroup bereitstellt.",
      role: "Stellt künftig das Sicherheitssystem der Gruppe bereit",
      form: "Unternehmen",
      region: "Gesamte Gruppe",
    },
  } as Record<string, UnitText>,
  dataCenter: {
    eyebrow: "VylarisData",
    title: "Unser Rechenzentrum",
    description:
      "Eigene Hardware, eigenes Netz, eigene Datensicherung: Das Rechenzentrum der Allianz. Betrieben von VylarisData, einer Marke von CircleUpWilms.",
    motto: "Powering the Vylaris Ecosystem. Technology. Infrastructure. Innovation.",
    stats: [
      { value: "10", label: "Server", text: "Intern eigene Server, extern ganz normale Server." },
      { value: "250 TB", label: "SSD im Betrieb", text: "Der heutige Speicher der Gruppe." },
      { value: "knapp 1 PB", label: "Ausbauziel", text: "Rohkapazität vor Redundanz: 4 × 120 TB SSD und ein Storage-Server mit knapp 500 TB HDD sind im Aufbau." },
      { value: "Eigenes Subnetz", label: "Netzwerk", text: "Eigener IP-Adressbereich und ein Network-Server, der die Internetanbindung regelt." },
    ],
    componentsTitle: "Bausteine und Stand",
    componentsNote: (asOf: string) =>
      `Stand ${asOf}. Den aktuellen Live-Stand zeigt vylarisdata.com.`,
    components: {
      serversInternal: { name: "Server (intern)", text: "Eigene Server, von uns selbst betrieben." },
      serversExternal: { name: "Server (extern)", text: "Ganz normale Server." },
      ssd: { name: "SSD-Speicher", text: "250 TB im Betrieb." },
      expansion: { name: "Speicherausbau", text: "Weitere SSD-Kapazität und ein Storage-Server mit knapp 500 TB HDD, Ziel knapp 1 PB Rohkapazität." },
      network: { name: "Eigenes Netzwerk", text: "Eigenes IP-Subnetz, Network-Server für die Internetanbindung." },
      dns: { name: "DNS-Server", text: "Namensauflösung, derzeit in Wartung." },
      backup: { name: "PBS-Backup-System", text: "Eigenes System für die Datensicherung." },
      security: { name: "Sicherheitssystem", text: "Mit internem Netzwerk-Setup." },
      ecosystem: { name: "Ökosystem ausbauen", text: "Das Vylaris-Ökosystem weiter auszubauen ist geplant." },
    } as Record<string, { name: string; text: string }>,
    states: { ok: "Im Betrieb", building: "Im Aufbau", maintenance: "In Wartung", planned: "Geplant" } as Record<string, string>,
    principlesTitle: "So arbeiten wir",
    principles: [
      { title: "Eigene Hardware", text: "Wir betreiben unsere Server selbst und haben die Technik in der eigenen Hand." },
      { title: "Schutz im Design", text: "Ein Sicherheitssystem gehört zur Infrastruktur; die eigene Website läuft hinter einem Tunnel statt mit offenen Ports." },
      { title: "Kein Tracking", text: "Keine Tracker, keine Werbenetzwerke, keine Cookies für Besucher." },
      { title: "Ehrlich im Stand", text: "Wir sagen, was läuft, was im Aufbau ist, was gewartet wird und was geplant ist." },
    ],
    visit: "VylarisData besuchen",
    status: "Live-Status ansehen",
    contactNote:
      "Anfragen zu VylarisData laufen über die Kontaktseite der VylarisGroup; eine eigene Kontaktadresse gibt es nicht.",
    newTab: "(öffnet in neuem Tab)",
  },
  ecosystem: {
    eyebrow: "Ökosystem",
    title: "Vier Bausteine, eine Gruppe",
    description: "Das Ökosystem der VylarisGroup: Wer es trägt, wer es betreibt und was noch kommt.",
    items: [
      { name: "VylarisGroup Schweiz", text: "Der Verein hinter der Idee, entstanden aus Homelab und Podcast.", state: "Besteht" },
      { name: "VylarisGroupEurope", text: "Europäische Rechts- und Unternehmensstruktur, Hosting und kostenlose Open-Source-Dienste.", state: "Besteht" },
      { name: "VylarisData", text: "Rechenzentrum sowie Software Development & Technology.", state: "Besteht" },
    ],
    space: { name: "VylarisSpace", text: "Ein Hosting-Panel für Websites, E-Mail und Datenbanken. Angekündigt, noch nicht verfügbar.", state: "Bald verfügbar" },
    security: { name: "VylarisSecurity", text: "Künftig das Sicherheitssystem der Gruppe.", state: "In Planung" },
  },
  roles: {
    eyebrow: "Allianz CH & EU",
    title: "Zwei Standorte, eine Mission",
    description:
      "Hand in Hand: Der Verein trägt die Idee, die Firma gibt ihr die europäische Struktur und die Infrastruktur. So verteilen sich die Aufgaben.",
    caption: (partner: string, eu: string) =>
      `Rollenverteilung zwischen ${partner} und ${eu}`,
    aspect: "Aspekt",
    association: "Ursprungsverein",
    company: "Europäische Zweitstelle",
    rows: (p: {
      members: number;
      board: number;
      leader: string;
      company: string;
      domain: string;
      euDomain: string;
    }) => [
      {
        label: "Charakter",
        verein: "Schweizer Verein, entstanden aus Homelab und Podcast",
        firma: "Offizielle europäische Firma und Zweitstelle der VylarisGroup",
      },
      {
        label: "Menschen",
        verein: `${p.members} Mitglieder, davon ${p.board} im Vorstand`,
        firma: `Leitung: ${p.leader} (${p.company})`,
      },
      {
        label: "Rolle",
        verein: "Ideelles Fundament: Idee, Werte und Gemeinschaft",
        firma: "Europäische Rechts- und Unternehmensstruktur",
      },
      {
        label: "Beitrag",
        verein: "Gibt die Richtung vor: Sicherheit ohne Paywall, offen und transparent",
        firma: "Hochverfügbare Hosting- und Server-Infrastruktur für die Dienste der Gruppe in Europa",
      },
      {
        label: "Ansprechpartner für",
        verein: "Die Community und Fragen rund um den Verein",
        firma: "Datenschutz, Betrieb und Hosting-Anfragen von Unternehmen",
      },
      { label: "Online", verein: p.domain, firma: p.euDomain },
    ],
    outro: (eu: string) =>
      `Der Verein und ${eu} sind rechtlich eigenständig, verfolgen aber dieselbe Mission: Sicherheit und Privatsphäre für alle – ohne Paywall und offen.`,
    visit: (domain: string) => `${domain} besuchen`,
    newTab: "(öffnet in neuem Tab)",
  },
  branches: {
    VylarisGroupAustria: {
      region: "Österreich",
      text: "Niederlassung für Österreich mit eigenen Aufgaben: Support und Beratung für Kunden und Partner in Österreich, regionale Hosting-Projekte und Datenschutz nach österreichischem und EU-Recht.",
      role: "Support, Beratung und regionale Hosting-Projekte für Österreich",
    },
    VylarisGroupGermany: {
      region: "Deutschland",
      text: "Aufgestellt wie VylarisGroupEurope: europäische Rechts- und Unternehmensstruktur sowie hochverfügbare Hosting- und Server-Infrastruktur für Deutschland.",
      role: "Wie VylarisGroupEurope, für Deutschland",
    },
    VylarisGroupAmerica: {
      region: "USA · Phoenix, Arizona",
      text: "Anlaufstelle der Gruppe in Nordamerika und mehr als das: englischsprachiger Support, Community- und Partnerarbeit in den USA sowie eigene Projekte und Dienste für die Region.",
      role: "Support, Community- und Partnerarbeit sowie eigene Projekte für Nordamerika",
    },
  } as Record<string, BranchText>,
});
