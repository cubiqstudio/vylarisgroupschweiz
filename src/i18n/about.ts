import { defineMessages } from "@/i18n";

/** Texte der Seite "Über uns & Struktur" (Gruppeninhalte, auf vylaris.net übersetzt). */
export const about = defineMessages(
  {
    partnerName: "VylarisGroup Schweiz",
    meta: {
      title: "Über uns & Struktur",
      description: (name: string, partner: string) =>
        `Wer hinter ${name} steht: vom Homelab und Podcast über den Schweizer Verein ${partner} bis zur europäischen Hosting-Infrastruktur.`,
    },
    hero: {
      eyebrow: "Über uns & Struktur",
      titlePre: "Aus einem Homelab wurde eine",
      titleAccent: "europäische Plattform",
      description: (eu: string, partner: string) =>
        `${eu} ist die offizielle europäische Firma und Zweitstelle der VylarisGroup – gemeinsam mit dem Schweizer Verein ${partner} bauen wir kostenlose, offene Dienste auf eigener Infrastruktur.`,
    },
    story: {
      eyebrow: "Unsere Geschichte",
      title: "Drei Schritte, ein roter Faden",
      description:
        "Keine Gründungsmythen, sondern der tatsächliche Weg: von der Neugier zur Gemeinschaft zur belastbaren Struktur.",
      step: (n: number) => `Schritt ${n}: `,
      steps: {
        startLabel: "Der Anfang",
        startTitle: "Ein Homelab und ein Podcast",
        startBody:
          "Am Anfang stand kein Businessplan, sondern ein eigenes Homelab und ein Podcast. Technik selbst betreiben, verstehen und Wissen darüber teilen – aus dieser Haltung ist alles Weitere gewachsen.",
        communityLabel: "Die Gemeinschaft",
        communityTitle: (partner: string) => `Der Schweizer Verein ${partner}`,
        communityBody: (
          partner: string,
          domain: string,
          members: number,
          board: number,
        ) =>
          `Aus dem Homelab und dem Podcast wurde ein Verein: ${partner} (${domain}) hat ${members} Mitglieder, davon ${board} im Vorstand. Er ist das ideelle Fundament – hier wurden die Werte und die Ausrichtung festgelegt, an denen wir uns bis heute orientieren.`,
        structureLabel: "Die europäische Struktur",
        structureTitle: (eu: string, leader: string) => `${eu} unter ${leader}`,
        structureBody: (eu: string, leader: string, company: string) =>
          `${eu} ist die offizielle europäische Rechts- und Unternehmensstruktur der VylarisGroup – und stellt die hochverfügbare Hosting- und Server-Infrastruktur bereit, auf der die Dienste laufen. Geleitet wird sie von ${leader} (${company}).`,
      },
    },
    roles: {
      eyebrow: "Allianz CH & EU",
      title: "Zwei Standorte, eine Mission",
      description:
        "Hand in Hand: Der Verein trägt die Idee, die Firma gibt ihr die europäische Struktur und die Infrastruktur, auf der sie läuft. So verteilen sich die Aufgaben.",
      caption: (partner: string, eu: string) =>
        `Rollenverteilung zwischen ${partner} und ${eu}`,
      aspect: "Aspekt",
      association: "Ursprungsverein",
      company: "Europäische Zweitstelle",
      thisWebsite: "Diese Website",
      rows: (p: {
        members: number;
        board: number;
        leader: string;
        company: string;
        domain: string;
        online: string;
      }) => [
        {
          label: "Charakter",
          verein: "Schweizer Verein, entstanden aus Homelab und Podcast",
          firma:
            "Offizielle europäische Firma und Zweitstelle der VylarisGroup",
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
          verein:
            "Gibt die Richtung vor: Sicherheit ohne Paywall, offen und transparent",
          firma:
            "Hochverfügbare Hosting- und Server-Infrastruktur für alle Dienste",
        },
        {
          label: "Ansprechpartner für",
          verein: "Die Community und Fragen rund um den Verein",
          firma: "Datenschutz, Betrieb und Hosting-Anfragen von Unternehmen",
        },
        { label: "Online", verein: p.domain, firma: p.online },
      ],
      outro: (eu: string) =>
        `Der Verein und ${eu} sind rechtlich eigenständig, verfolgen aber dieselbe Mission: Sicherheit und Privatsphäre für alle – ohne Paywall, offen und auf vertrauenswürdiger europäischer Infrastruktur.`,
      visit: (domain: string) => `${domain} besuchen`,
      newTab: "(öffnet in neuem Tab)",
    },
    values: {
      eyebrow: "Unsere Werte",
      title: "Drei Versprechen, an denen du uns messen kannst",
      description:
        "Sie gelten für jeden Dienst, jede Entscheidung und jede Zeile Code.",
      items: [
        {
          title: "Sicherheit ohne Paywall",
          claim:
            "„Sicherheit muss nichts kosten, nur weil große Unternehmen das sagen.“",
          body: "Privatsphäre und Schutz vor Angriffen sind keine Luxusgüter. Deshalb sind alle unsere SaaS-Angebote zu 100 % kostenlos – ohne versteckte Stufen, die dich zum Bezahlen drängen.",
          points: [
            "Alle SaaS-Dienste dauerhaft kostenlos",
            "Dein Geld bleibt deins",
            "Sicherheit für alle statt für zahlende Kunden",
          ],
        },
        {
          title: "100 % Open Source & Eigenentwicklung",
          claim: "Vertrauen entsteht durch Nachprüfbarkeit.",
          body: "Unsere Software ist quelloffen und, wo es sinnvoll ist, selbst entwickelt. Transparenter Code bedeutet: Du musst uns nicht glauben, du kannst es nachlesen. Proprietäre Hintertüren haben darin keinen Platz.",
          points: [
            "Transparenter, einsehbarer Code",
            "Keine proprietären Backdoors",
            "Eigenentwicklung statt Black-Box-Abhängigkeit",
          ],
        },
        {
          title: "Europäisches Enterprise-Hosting & Datenschutz",
          claim: "Eigene Infrastruktur, der du vertrauen kannst.",
          body: "Wir betreiben unsere Dienste auf eigener, vertrauenswürdiger Infrastruktur in europäischer Verantwortung. Kein Tracking, keine Datenweitergabe an Werbenetzwerke – und ein Betrieb, der darauf ausgelegt ist, Datenverlust gar nicht erst zum Risiko werden zu lassen.",
          points: [
            "Eigene Infrastruktur statt fremder Cloud-Abhängigkeit",
            "Kein Tracking, keine Analyse-Dienste",
            "100 % DSGVO-konform",
          ],
        },
      ],
    },
    leadership: {
      // vylaris.eu: Leitungsvorstellung
      eyebrow: "Leitung",
      title: (name: string) => `Wer ${name} verantwortet`,
      description:
        "Eine Person trägt die Verantwortung für Struktur, Betrieb und Datenschutz – mit Namen statt hinter einer Fassade.",
      initialsOf: (name: string) => `Initialen von ${name}`,
      bio: (leader: string, name: string) =>
        `${leader} ist Experte für Webhosting und IT-Services und leitet ${name} als offizielle europäische Zweitstelle der VylarisGroup. Er verantwortet die europäische Rechts- und Unternehmensstruktur sowie die Hosting-Infrastruktur, auf der alle Dienste laufen.`,
      skills: { hosting: "Webhosting", it: "IT-Services" },
      // vylaris.de / vylaris.net: neutrale Ansprechpartner-Karte
      contactEyebrow: "Ansprechpartner",
      contactTitle: (name: string) => `Dein Ansprechpartner bei ${name}`,
      contactDescription:
        "Eine Person, an die du dich wenden kannst – mit Namen statt hinter einer Fassade.",
      roleContact: (name: string) => `Ansprechpartner ${name}`,
      roleResponsible: (name: string) => `Verantwortlich für ${name}`,
      centralNote: (eu: string, domain: string) =>
        `Technischer Betrieb, Hosting und Verwaltung aller Seiten der VylarisGroup liegen zentral bei ${eu} (${domain}).`,
    },
    funding: {
      eyebrow: "Haltung",
      title: "Warum ist das kostenlos?",
      description:
        "Weil wir überzeugt sind, dass Sicherheit und Privatsphäre nicht davon abhängen sollten, was du dir leisten kannst. Drei Prinzipien dahinter:",
      principles: [
        {
          title: "Kostenlos bleibt kostenlos",
          body: "Unsere SaaS-Dienste sind für alle Nutzerinnen und Nutzer dauerhaft kostenfrei. Das ist keine Testphase und kein Köder, sondern unsere Grundhaltung.",
        },
        {
          title: "Deine Daten sind nicht der Preis",
          body: "Wir verdienen nicht an deinem Verhalten: kein Tracking, keine Werbenetzwerke, kein Verkauf von Daten. Dienste, die nichts kosten, dürfen dich nicht anderswo teuer zu stehen kommen.",
        },
        {
          title: "Hosting für Unternehmen auf Anfrage",
          body: "Unternehmen, die professionelles Hosting auf europäischer Infrastruktur suchen, können uns über das Kontaktformular erreichen. Konditionen besprechen wir persönlich – deshalb nennen wir hier bewusst keine Preise.",
        },
      ],
      cta: "Hosting-Anfrage für dein Unternehmen stellen",
    },
    cta: {
      titlePre: "Lern uns",
      titleAccent: "im Alltag",
      titlePost: "kennen",
      description:
        "Probiere unsere kostenlosen Dienste aus oder schreib uns – bei Fragen, Hosting-Anfragen oder wenn du eine Sicherheitslücke melden möchtest.",
      services: "Dienste entdecken",
      contact: "Kontakt aufnehmen",
    },
  },
  {
    partnerName: "VylarisGroup Switzerland",
    meta: {
      title: "About us & structure",
      description: (name: string, partner: string) =>
        `Who is behind ${name}: from a homelab and a podcast to the Swiss association ${partner} and European hosting infrastructure.`,
    },
    hero: {
      eyebrow: "About us & structure",
      titlePre: "A homelab that grew into a",
      titleAccent: "European platform",
      description: (eu: string, partner: string) =>
        `${eu} is the official European company and second office of VylarisGroup. Together with the Swiss association ${partner}, we build free, open services on our own infrastructure.`,
    },
    story: {
      eyebrow: "Our story",
      title: "Three steps, one common thread",
      description:
        "No founding myths, just the way it actually happened: from curiosity to community to a structure that holds up.",
      step: (n: number) => `Step ${n}: `,
      steps: {
        startLabel: "The beginning",
        startTitle: "A homelab and a podcast",
        startBody:
          "It started without a business plan, just a homelab of our own and a podcast. Running technology ourselves, understanding it and sharing what we learn: everything else grew from that attitude.",
        communityLabel: "The community",
        communityTitle: (partner: string) => `The Swiss association ${partner}`,
        communityBody: (
          partner: string,
          domain: string,
          members: number,
          board: number,
        ) =>
          `The homelab and the podcast became an association: ${partner} (${domain}) has ${members} members, ${board} of them on the board. It is the ideological foundation, where the values and direction we still follow today were set.`,
        structureLabel: "The European structure",
        structureTitle: (eu: string, leader: string) => `${eu} under ${leader}`,
        structureBody: (eu: string, leader: string, company: string) =>
          `${eu} is the official European legal and corporate structure of VylarisGroup, and it provides the highly available hosting and server infrastructure the services run on. It is led by ${leader} (${company}).`,
      },
    },
    roles: {
      eyebrow: "Alliance CH & EU",
      title: "Two locations, one mission",
      description:
        "Hand in hand: the association carries the idea, and the company gives it its European structure and the infrastructure it runs on. This is how the work is shared.",
      caption: (partner: string, eu: string) =>
        `Division of roles between ${partner} and ${eu}`,
      aspect: "Aspect",
      association: "Founding association",
      company: "European second office",
      thisWebsite: "This website",
      rows: (p: {
        members: number;
        board: number;
        leader: string;
        company: string;
        domain: string;
        online: string;
      }) => [
        {
          label: "Character",
          verein: "Swiss association that grew out of a homelab and a podcast",
          firma: "Official European company and second office of VylarisGroup",
        },
        {
          label: "People",
          verein: `${p.members} members, ${p.board} of them on the board`,
          firma: `Lead: ${p.leader} (${p.company})`,
        },
        {
          label: "Role",
          verein: "Ideological foundation: ideas, values and community",
          firma: "European legal and corporate structure",
        },
        {
          label: "Contribution",
          verein:
            "Sets the direction: security without a paywall, open and transparent",
          firma:
            "Highly available hosting and server infrastructure for all services",
        },
        {
          label: "Contact for",
          verein: "The community and questions about the association",
          firma:
            "Data protection, operations and hosting inquiries from businesses",
        },
        { label: "Online", verein: p.domain, firma: p.online },
      ],
      outro: (eu: string) =>
        `The association and ${eu} are legally independent but share the same mission: security and privacy for everyone, with no paywall, open and on trustworthy European infrastructure.`,
      visit: (domain: string) => `Visit ${domain}`,
      newTab: "(opens in a new tab)",
    },
    values: {
      eyebrow: "Our values",
      title: "Three promises you can hold us to",
      description:
        "They apply to every service, every decision and every line of code.",
      items: [
        {
          title: "Security without a paywall",
          claim:
            "“Security shouldn't have to cost anything just because big companies say it does.”",
          body: "Privacy and protection from attacks are not luxury goods. That's why all of our SaaS offerings are 100% free, with no hidden tiers pushing you to pay.",
          points: [
            "All SaaS services free for good",
            "Your money stays yours",
            "Security for everyone, not just paying customers",
          ],
        },
        {
          title: "100% open source & in-house development",
          claim: "Trust comes from being verifiable.",
          body: "Our software is open source and, where it makes sense, developed in-house. Transparent code means you don't have to take our word for it, you can read it yourself. There is no room for proprietary backdoors.",
          points: [
            "Transparent, inspectable code",
            "No proprietary backdoors",
            "In-house development instead of black-box dependencies",
          ],
        },
        {
          title: "European enterprise hosting & data protection",
          claim: "Infrastructure of our own that you can trust.",
          body: "We run our services on our own trustworthy infrastructure under European responsibility. No tracking, no sharing of data with ad networks, and operations designed so that data loss never becomes a risk in the first place.",
          points: [
            "Our own infrastructure instead of dependence on third-party clouds",
            "No tracking, no analytics services",
            "100% GDPR-compliant",
          ],
        },
      ],
    },
    leadership: {
      eyebrow: "Leadership",
      title: (name: string) => `Who is responsible for ${name}`,
      description:
        "One person is responsible for structure, operations and data protection, with a name instead of a facade.",
      initialsOf: (name: string) => `Initials of ${name}`,
      bio: (leader: string, name: string) =>
        `${leader} is an expert in web hosting and IT services and leads ${name} as the official European second office of VylarisGroup. He is responsible for the European legal and corporate structure and for the hosting infrastructure all services run on.`,
      skills: { hosting: "Web hosting", it: "IT services" },
      contactEyebrow: "Point of contact",
      contactTitle: (name: string) => `Your point of contact at ${name}`,
      contactDescription:
        "One person you can turn to, with a name instead of a facade.",
      roleContact: (name: string) => `Point of contact, ${name}`,
      roleResponsible: (name: string) => `Responsible for ${name}`,
      centralNote: (eu: string, domain: string) =>
        `Technical operations, hosting and administration of all VylarisGroup sites are handled centrally by ${eu} (${domain}).`,
    },
    funding: {
      eyebrow: "Our stance",
      title: "Why is it free?",
      description:
        "Because we believe security and privacy shouldn't depend on what you can afford. Three principles behind it:",
      principles: [
        {
          title: "Free stays free",
          body: "Our SaaS services are free for all users, permanently. That's not a trial period and not bait, it's our basic stance.",
        },
        {
          title: "Your data is not the price",
          body: "We don't profit from your behavior: no tracking, no ad networks, no selling of data. Services that cost nothing must not cost you dearly somewhere else.",
        },
        {
          title: "Hosting for businesses on request",
          body: "Businesses looking for professional hosting on European infrastructure can reach us through the contact form. We discuss terms personally, which is why we deliberately don't list prices here.",
        },
      ],
      cta: "Send a hosting inquiry for your business",
    },
    cta: {
      titlePre: "Get to know us",
      titleAccent: "in everyday use",
      titlePost: "",
      description:
        "Try our free services or get in touch, whether you have questions, hosting inquiries or want to report a security vulnerability.",
      services: "Explore services",
      contact: "Get in touch",
    },
  },
);
