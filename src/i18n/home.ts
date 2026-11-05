import { defineMessages } from "@/i18n";

/** Texte der Startseite (Hero, Werte, Allianz, Dienste-Vorschau, Ansprechpartner, Call-to-Action). */
export const home = defineMessages(
  {
    hero: {
      headingLead: "Wir sind die",
      body:
        "Wir entwickeln quelloffene SaaS-Dienste für Sicherheit und Zusammenarbeit und betreiben sie auf eigener, " +
        "DSGVO-konformer Infrastruktur in Europa. Kostenlos, transparent und ohne Tracking – weil Schutz deiner Daten " +
        "keine Frage des Geldbeutels sein sollte.",
      ctaServices: "Kostenlose SaaS-Dienste starten",
      ctaAlliance: "Über unsere Allianz CH & EU",
      teamAlt: "Das Team der VylarisGroup",
    },
    values: {
      eyebrow: "Unsere Werte",
      heading: "Sicherheit muss nichts kosten, nur weil große Unternehmen das sagen.",
      items: [
        {
          title: "Open Source & Eigenentwicklung",
          text: "Unser Code ist offen einsehbar und wird von uns selbst entwickelt. Keine proprietären Backdoors, keine Blackbox – du kannst nachprüfen, was passiert, statt es glauben zu müssen.",
        },
        {
          title: "0 €-Paywall-Garantie",
          text: "Alle unsere SaaS-Angebote sind zu 100 % kostenlos – ohne Abo, ohne Funktionssperre und ohne versteckte Gegenleistung. Dein Geld bleibt deins.",
        },
        {
          title: "Hochsicheres europäisches Hosting",
          text: "Eigene, vertrauenswürdige Infrastruktur statt anonymer Cloud-Kette. 100 % DSGVO-konform, ohne Tracking und mit dem klaren Ziel, dass keine Daten verloren gehen.",
        },
      ],
    },
    alliance: {
      eyebrow: "Allianz CH & EU",
      title: "Zwei Standorte, eine Mission",
      description:
        "Hand in Hand: Der Schweizer Verein trägt die Idee, VylarisGroupEurope gibt ihr die europäische Struktur und die Infrastruktur, auf der sie läuft.",
      handBadge: "Hand in Hand",
      euRole: "Offizielle europäische Zweitstelle",
      leadership: "Leitung",
      leaderText: (name: string, company: string) => `${name} – Experte für Webhosting & IT-Services (${company})`,
      task: "Aufgabe",
      taskText:
        "Die offizielle europäische Rechts- und Unternehmensstruktur sowie hochverfügbare Hosting- und Server-Infrastruktur für alle Dienste.",
      partnerName: "VylarisGroup Schweiz",
      partnerRole: (domain: string) => `Ursprungsverein · ${domain}`,
      association: "Verein",
      associationText: (members: number, board: number) => `${members} Mitglieder, davon ${board} im Vorstand`,
      origin: "Ursprung",
      originText: "Entstanden aus einem eigenen Homelab und einem Podcast – das ideelle Fundament, aus dem alles gewachsen ist.",
      visit: (domain: string) => `${domain} besuchen`,
      newTab: "(öffnet in neuem Tab)",
      more: "Mehr über die Allianz",
    },
    services: {
      eyebrow: "SaaS-Dienste",
      title: "Werkzeuge, die du sofort nutzen kannst",
      description: "Kostenlos, ohne Registrierungsfalle und ohne Funktionssperre hinter einem Abo.",
      all: "Alle Dienste ansehen",
      failedTitle: "Dienste sind gerade nicht abrufbar",
      emptyTitle: "Noch keine Dienste veröffentlicht",
      failedText:
        "Die Dienste-Übersicht konnte nicht geladen werden. Bitte versuche es in einem Moment erneut oder prüfe unsere Status-Seite.",
      emptyText: "Sobald die ersten Dienste live sind, findest du sie hier. Schau gern bald wieder vorbei oder sprich uns an.",
      toStatus: "Zum Status",
      toContact: "Kontakt aufnehmen",
      card: {
        fallbackTagline: "Kostenlos, quelloffen und auf europäischer Infrastruktur betrieben.",
        open: "Öffnen",
        newTabOf: (name: string) => `${name} (öffnet in neuem Tab)`,
        source: "Quellcode",
        sourceNewTab: (name: string) => `von ${name} (öffnet in neuem Tab)`,
      },
    },
    leadership: {
      // Nur vylaris.eu: Statement der Leitung
      eyebrow: "Statement der Leitung",
      quote:
        "„Sicherheit muss nichts kosten, nur weil große Unternehmen das sagen. Genau deshalb bauen wir Dienste, die " +
        "jeder nutzen kann – ohne Paywall und ohne versteckte Gegenleistung. Gemeinsam mit unserem Schweizer Verein " +
        "gehen wir diesen Weg Hand in Hand. Ich übernehme dafür die Verantwortung für Hosting und Infrastruktur, und " +
        "Vertrauen entsteht bei uns dadurch, dass jeder unseren Code prüfen kann.“",
      role: (name: string) => `Leitung ${name}`,
      // Andere Standorte: neutrale Ansprechpartner-Karte
      contactEyebrow: "Ansprechpartner",
      contactRole: (name: string) => `Ansprechpartner ${name}`,
      operationNote: "Technischer Betrieb, Hosting und Verwaltung dieser Website liegen zentral bei",
    },
    cta: {
      headingLead: "Bereit für Privatsphäre, die ",
      headingEm: "nichts kostet",
      headingTail: "?",
      text:
        "Starte direkt mit unseren kostenlosen Diensten – oder sprich mit uns, wenn du Fragen hast, Hosting für dein " +
        "Unternehmen suchst oder eine Sicherheitslücke melden möchtest.",
      services: "Kostenlose Dienste nutzen",
      contact: "Kontakt aufnehmen",
    },
  },
  {
    hero: {
      headingLead: "We are",
      body:
        "We build open-source SaaS services for security and collaboration and run them on our own, " +
        "GDPR-compliant infrastructure in Europe. Free, transparent and without tracking – because protecting your data " +
        "shouldn't depend on your wallet.",
      ctaServices: "Start using our free SaaS services",
      ctaAlliance: "About our CH & EU alliance",
      teamAlt: "The VylarisGroup team",
    },
    values: {
      eyebrow: "Our values",
      heading: "Security shouldn't cost a thing just because big companies say it does.",
      items: [
        {
          title: "Open source & in-house development",
          text: "Our code is open for anyone to inspect and developed by us. No proprietary backdoors, no black box – you can verify what happens instead of having to take our word for it.",
        },
        {
          title: "Zero-paywall guarantee",
          text: "All of our SaaS offerings are 100 % free – no subscription, no feature locks and no hidden price. Your money stays yours.",
        },
        {
          title: "Highly secure European hosting",
          text: "Our own trusted infrastructure instead of an anonymous cloud chain. 100 % GDPR compliant, no tracking and one clear goal: no data gets lost.",
        },
      ],
    },
    alliance: {
      eyebrow: "CH & EU alliance",
      title: "Two locations, one mission",
      description:
        "Hand in hand: the Swiss association carries the idea, VylarisGroupEurope gives it its European structure and the infrastructure it runs on.",
      handBadge: "Hand in hand",
      euRole: "Official European branch office",
      leadership: "Leadership",
      leaderText: (name: string, company: string) => `${name} – expert in web hosting & IT services (${company})`,
      task: "Role",
      taskText:
        "The official European legal and corporate structure, plus highly available hosting and server infrastructure for all services.",
      partnerName: "VylarisGroup Switzerland",
      partnerRole: (domain: string) => `Founding association · ${domain}`,
      association: "Association",
      associationText: (members: number, board: number) => `${members} members, ${board} of them on the board`,
      origin: "Origin",
      originText: "Born from a homelab of our own and a podcast – the foundation of ideas everything has grown from.",
      visit: (domain: string) => `Visit ${domain}`,
      newTab: "(opens in a new tab)",
      more: "More about the alliance",
    },
    services: {
      eyebrow: "SaaS services",
      title: "Tools you can use right away",
      description: "Free, with no sign-up traps and no features locked behind a subscription.",
      all: "View all services",
      failedTitle: "Services are unavailable right now",
      emptyTitle: "No services published yet",
      failedText:
        "The services overview could not be loaded. Please try again in a moment or check our status page.",
      emptyText: "Once the first services are live, you'll find them here. Check back soon or get in touch.",
      toStatus: "Go to status",
      toContact: "Get in touch",
      card: {
        fallbackTagline: "Free, open source and run on European infrastructure.",
        open: "Open",
        newTabOf: (name: string) => `${name} (opens in a new tab)`,
        source: "Source code",
        sourceNewTab: (name: string) => `of ${name} (opens in a new tab)`,
      },
    },
    leadership: {
      eyebrow: "Statement from leadership",
      quote:
        "“Security shouldn't cost a thing just because big companies say it does. That's exactly why we build services " +
        "anyone can use – no paywall and nothing hidden in return. Together with our Swiss association we walk this " +
        "path hand in hand. I take responsibility for hosting and infrastructure, and trust comes from the fact that " +
        "anyone can review our code.”",
      role: (name: string) => `Head of ${name}`,
      contactEyebrow: "Point of contact",
      contactRole: (name: string) => `Responsible for ${name}`,
      operationNote: "Technical operation, hosting and administration of this website are handled centrally by",
    },
    cta: {
      headingLead: "Ready for privacy that ",
      headingEm: "costs nothing",
      headingTail: "?",
      text:
        "Get started right away with our free services – or talk to us if you have questions, are looking for hosting " +
        "for your business or want to report a security vulnerability.",
      services: "Use our free services",
      contact: "Get in touch",
    },
  },
);
