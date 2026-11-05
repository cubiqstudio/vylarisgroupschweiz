import { defineMessages } from "@/i18n";

type BranchText = { region: string; text: string; role: string };
type UnitText = { subtitle: string; text: string; role: string; form: string; region: string };

/** Texte der Seite "Allianz & Standorte". Niederlassungstexte sind nach Name indexiert (Fakten stehen in src/lib/alliance.ts). */
export const allianz = defineMessages(
  {
    partnerName: "VylarisGroup Schweiz",
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
        `Hand in Hand: Der Schweizer Verein trägt die Idee, ${eu} gibt ihr die europäische Struktur und die Infrastruktur. Darunter stehen VylarisData als Rechenzentrum und VylarisSecurity für die Sicherheit, danach wächst die Gruppe mit eigenen Niederlassungen weiter.`,
      euSubtitle: "Offizielle europäische Zweitstelle",
      lead: "Leitung",
      euLead: (name: string, company: string) =>
        `${name} – Experte für Webhosting & IT-Services (${company})`,
      task: "Aufgabe",
      euTask:
        "Die offizielle europäische Rechts- und Unternehmensstruktur sowie hochverfügbare Hosting- und Server-Infrastruktur für alle Dienste.",
      branchesLabel: "Niederlassungen",
      euBranches: (eu: string) =>
        `Dazu gehören VylarisData und VylarisSecurity sowie die Niederlassungen: Deutschland und Nordamerika bestehen bereits, Österreich ist in Planung – alle gehen von ${eu} aus.`,
      association: "Ursprungsverein",
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
      centralNote: (eu: string, euDomain: string) =>
        `Alle Seiten werden zentral von ${eu} betrieben und verwaltet (${euDomain}).`,
      plannedNote: (domain: string) =>
        `Die Domain für Österreich (${domain}) ist noch nicht online.`,
      more: "Weitere Standorte folgen nach demselben Prinzip",
      visit: (domain: string) => `${domain} besuchen`,
      unitsOf: "Gemeinsame Einheiten der Allianz",
      unitsNote: "VylarisData und VylarisSecurity gehören unter VylarisGroupEurope und stehen für die ganze Gruppe zwischen Zentrale und Niederlassungen.",
      brandOf: (owner: string) => `Marke von ${owner}`,
      unitFactsLabel: "Auf einen Blick",
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
      caption: "Gesellschaften der VylarisGroup in Europa und der Schweiz",
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
      group: "Gesamte Gruppe",
      associationRole: "Idee, Werte und Gemeinschaft",
      euRole: (leader: string) =>
        `Europäische Rechts- und Unternehmensstruktur, zentraler Betrieb und Verwaltung aller Seiten und Dienste, kostenlose Open-Source-SaaS-Dienste (DSGVO-konform, ohne Tracking) · Leitung ${leader}`,
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
        "Eigene Hardware, eigenes Netz, eigene Datensicherung: Das Fundament, auf dem alle Dienste der VylarisGroup laufen. Betrieben von VylarisData, einer Marke von CircleUpWilms.",
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
      comingSoon: "Bald verfügbar",
      items: [
        { name: "VylarisGroup Schweiz", text: "Der Verein hinter der Idee, entstanden aus Homelab und Podcast.", state: "Besteht" },
        { name: "VylarisGroupEurope", text: "Europäische Rechts- und Unternehmensstruktur, Hosting und kostenlose Open-Source-Dienste.", state: "Besteht" },
        { name: "VylarisData", text: "Rechenzentrum sowie Software Development & Technology.", state: "Besteht" },
      ],
      space: { name: "VylarisSpace", text: "Ein Hosting-Panel für Websites, E-Mail und Datenbanken. Angekündigt, noch nicht verfügbar.", state: "Bald verfügbar" },
      security: { name: "VylarisSecurity", text: "Künftig das Sicherheitssystem der Gruppe.", state: "In Planung" },
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
  },
  {
    partnerName: "VylarisGroup Switzerland",
    meta: {
      title: "Alliance & locations",
      description: (name: string) =>
        `The structure behind ${name}: the Swiss association, the European second office, the VylarisData data center, VylarisSecurity and branches in Germany, North America and soon Austria.`,
    },
    hero: {
      eyebrow: "Alliance",
      titlePre: "A network of association, company and",
      titleAccent: "branches",
      description: (name: string) =>
        `Everything about the structure behind ${name}: who carries the idea, who runs the infrastructure and how the group grows from Europe into more countries.`,
    },
    shared: {
      eyebrow: "Shared principles",
      title: "What connects all locations",
      description:
        "No matter where: these three points apply everywhere in VylarisGroup.",
      items: [
        {
          title: "Security without a paywall",
          text: "Privacy and security belong to everyone, at every location and for every person.",
        },
        {
          title: "100% open source",
          text: "Our code is open and verifiable. Every branch works by the same principle.",
        },
        {
          title: "Privacy first",
          text: "No trackers, no ads, no unnecessary cookies. That's how our services and locations work.",
        },
      ],
      contact: "Get in touch",
      about: "More about us",
    },
    structure: {
      eyebrow: "Alliance CH & EU",
      title: "Several locations, one mission",
      description: (eu: string) =>
        `Hand in hand: the Swiss association carries the idea, and ${eu} gives it its European structure and infrastructure. Below them sit VylarisData as the data center and VylarisSecurity for security, and from there the group keeps growing with branches of its own.`,
      euSubtitle: "Official European second office",
      lead: "Lead",
      euLead: (name: string, company: string) =>
        `${name}, expert in web hosting & IT services (${company})`,
      task: "Role",
      euTask:
        "The official European legal and corporate structure plus highly available hosting and server infrastructure for all services.",
      branchesLabel: "Branches",
      euBranches: (eu: string) =>
        `This includes VylarisData and VylarisSecurity as well as the branches: Germany and North America already exist, Austria is being planned. All of them originate from ${eu}.`,
      association: "Founding association",
      associationFact: "Association",
      members: (members: number, board: number) =>
        `${members} members, ${board} of them on the board`,
      origin: "Origin",
      originText:
        "Grew out of a homelab of our own and a podcast, the ideological foundation everything else grew from.",
      contribution: "Contribution",
      contributionText:
        "Sets the direction: security without a paywall, open and transparent.",
      branchesOf: (eu: string) => `Branches of ${eu}`,
      statusPlanned: "Planned",
      statusActive: "Active",
      leadLabel: "Lead:",
      notOnline: "· not online yet",
      newTab: "(opens in a new tab)",
      centralNote: (eu: string, euDomain: string) =>
        `All sites are operated and managed centrally by ${eu} (${euDomain}).`,
      plannedNote: (domain: string) =>
        `The domain for Austria (${domain}) is not online yet.`,
      more: "More locations will follow by the same principle",
      visit: (domain: string) => `Visit ${domain}`,
      unitsOf: "Shared units of the alliance",
      unitsNote: "VylarisData and VylarisSecurity sit below VylarisGroupEurope and serve the whole group, between headquarters and branches.",
      brandOf: (owner: string) => `Brand of ${owner}`,
      unitFactsLabel: "At a glance",
      servers: (n: number) => `${n} servers`,
      ssd: (tb: number) => `${tb} TB SSD in operation`,
      goal: "Goal: almost 1 PB",
      unitMore: "More about the data center",
    },
    overview: {
      eyebrow: "Company structure",
      title: "Who does what",
      description:
        "All entities at a glance, with legal form, region and role.",
      caption: "VylarisGroup entities in Europe and Switzerland",
      columns: {
        name: "Name",
        form: "Form",
        region: "Region",
        role: "Role",
        status: "Status",
      },
      association: "Association",
      company: "Company",
      branch: "Branch",
      switzerland: "Switzerland",
      eu: "European Union",
      group: "Entire group",
      associationRole: "Ideas, values and community",
      euRole: (leader: string) =>
        `European legal and corporate structure, central operation and management of all sites and services, free open-source SaaS services (GDPR-compliant, no tracking) · Lead: ${leader}`,
      withLead: (role: string, lead: string) => `${role} · Lead: ${lead}`,
      established: "Established",
      planned: "Planned",
    },
    units: {
      VylarisData: {
        subtitle: "Data center & technology",
        text: "Our complete data center and the Software Development & Technology business area of VylarisGroup: our own servers, storage, network and backups. VylarisData is a brand of CircleUpWilms.",
        role: "Runs the group's data center (servers, storage, network, backup, security system) and develops software and technology for the ecosystem",
        form: "Brand",
        region: "Entire group",
      },
      VylarisSecurity: {
        subtitle: "Security for the group",
        text: "A future company that will provide the security system of VylarisGroup.",
        role: "Will provide the group's security system",
        form: "Company",
        region: "Entire group",
      },
    } as Record<string, UnitText>,
    dataCenter: {
      eyebrow: "VylarisData",
      title: "Our data center",
      description:
        "Our own hardware, our own network, our own backups: the foundation all VylarisGroup services run on. Operated by VylarisData, a brand of CircleUpWilms.",
      motto: "Powering the Vylaris Ecosystem. Technology. Infrastructure. Innovation.",
      stats: [
        { value: "10", label: "Servers", text: "Our own servers internally, regular servers externally." },
        { value: "250 TB", label: "SSD in operation", text: "The group's storage today." },
        { value: "almost 1 PB", label: "Expansion goal", text: "Raw capacity before redundancy: 4 × 120 TB SSD and a storage server with almost 500 TB HDD are being built." },
        { value: "Own subnet", label: "Network", text: "Our own IP address range and a network server that handles our internet connection." },
      ],
      componentsTitle: "Building blocks and status",
      componentsNote: (asOf: string) =>
        `As of ${asOf}. The current live status is shown on vylarisdata.com.`,
      components: {
        serversInternal: { name: "Servers (internal)", text: "Our own servers, operated by ourselves." },
        serversExternal: { name: "Servers (external)", text: "Regular servers." },
        ssd: { name: "SSD storage", text: "250 TB in operation." },
        expansion: { name: "Storage expansion", text: "More SSD capacity and a storage server with almost 500 TB HDD, goal almost 1 PB raw capacity." },
        network: { name: "Own network", text: "Own IP subnet, network server for the internet connection." },
        dns: { name: "DNS server", text: "Name resolution, currently under maintenance." },
        backup: { name: "PBS backup system", text: "Our own system for data backup." },
        security: { name: "Security system", text: "With an internal network setup." },
        ecosystem: { name: "Growing the ecosystem", text: "Expanding the Vylaris ecosystem further is planned." },
      } as Record<string, { name: string; text: string }>,
      states: { ok: "In operation", building: "Being built", maintenance: "Under maintenance", planned: "Planned" } as Record<string, string>,
      principlesTitle: "How we work",
      principles: [
        { title: "Our own hardware", text: "We run our servers ourselves and keep the technology in our own hands." },
        { title: "Protection by design", text: "A security system is part of the infrastructure; our own website runs behind a tunnel instead of open ports." },
        { title: "No tracking", text: "No trackers, no ad networks, no cookies for visitors." },
        { title: "Honest about status", text: "We say what is running, what is being built, what is under maintenance and what is planned." },
      ],
      visit: "Visit VylarisData",
      status: "View live status",
      contactNote:
        "Inquiries about VylarisData go through the VylarisGroup contact page; there is no separate contact address.",
      newTab: "(opens in a new tab)",
    },
    ecosystem: {
      eyebrow: "Ecosystem",
      title: "Four building blocks, one group",
      description: "The VylarisGroup ecosystem: who carries it, who runs it and what is still to come.",
      comingSoon: "Coming soon",
      items: [
        { name: "VylarisGroup Switzerland", text: "The association behind the idea, grown out of a homelab and a podcast.", state: "Established" },
        { name: "VylarisGroupEurope", text: "European legal and corporate structure, hosting and free open-source services.", state: "Established" },
        { name: "VylarisData", text: "Data center plus Software Development & Technology.", state: "Established" },
      ],
      space: { name: "VylarisSpace", text: "A hosting panel for websites, email and databases. Announced, not available yet.", state: "Coming soon" },
      security: { name: "VylarisSecurity", text: "The group's security system in the future.", state: "Planned" },
    },
    branches: {
      VylarisGroupAustria: {
        region: "Austria",
        text: "Branch for Austria with tasks of its own: support and consulting for customers and partners in Austria, regional hosting projects and data protection under Austrian and EU law.",
        role: "Support, consulting and regional hosting projects for Austria",
      },
      VylarisGroupGermany: {
        region: "Germany",
        text: "Set up like VylarisGroupEurope: European legal and corporate structure plus highly available hosting and server infrastructure for Germany.",
        role: "Like VylarisGroupEurope, for Germany",
      },
      VylarisGroupAmerica: {
        region: "USA · Phoenix, Arizona",
        text: "The group's point of contact in North America, and more: English-language support, community and partner work in the US, plus projects and services of its own for the region.",
        role: "Support, community and partner work plus own projects for North America",
      },
    } as Record<string, BranchText>,
  },
);
