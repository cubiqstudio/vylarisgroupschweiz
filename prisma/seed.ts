/**
 * VylarisGroupEurope – Seed
 *
 * Aufruf: `tsx prisma/seed.ts` bzw. `npm run db:seed`.
 *
 * Der Seed ist idempotent: Inhalte (Dienste, Blog, Metriken, Vorfälle, Produkte) werden per
 * upsert mit `update: {}` angelegt und überschreiben daher NIE Änderungen aus dem Admin-Bereich.
 * Außerdem läuft jeder Teil nur EINMAL (Marker "seed.*" in der Tabelle SiteSetting): Was ein Admin später löscht,
 * kommt beim nächsten Containerstart nicht wieder. Mit SEED_FORCE=true werden alle Teile erneut ausgeführt.
 * Das Beispiel-Ticket wird in Produktion nicht angelegt (außer SEED_EXAMPLE_TICKET=true).
 * Die englischen Fassungen (…En-Felder) werden bei bestehenden Datensätzen nur gesetzt, wo sie noch null sind.
 * Der Admin-User wird nur angelegt, wenn seine E-Mail noch nicht existiert; ein bestehender
 * Passwort-Hash bleibt unangetastet.
 *
 * Umgebungsvariablen:
 *   ADMIN_EMAIL                     Default: lucas.wilms@vylaris.example
 *   ADMIN_PASSWORD                  Default: ChangeMe-Vylaris-2026!
 *   SEED_BASE_DOMAIN                Default: vylaris.example
 *   SEED_FORCE                      "true" ignoriert die Marker und führt alle Teile erneut aus
 *   SEED_EXAMPLE_TICKET             "true" legt das Beispiel-Ticket auch in Produktion an
 *   ALLOW_DEFAULT_ADMIN_PASSWORD    "true" erlaubt das Default-Passwort auch bei NODE_ENV=production
 */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const db = new PrismaClient();

const DEFAULT_ADMIN_EMAIL = "lucas.wilms@vylaris.example";
const DEFAULT_ADMIN_PASSWORD = "ChangeMe-Vylaris-2026!";
const DEFAULT_BASE_DOMAIN = "vylaris.example";
const BCRYPT_COST = 12;

const adminEmail = (process.env.ADMIN_EMAIL?.trim() || DEFAULT_ADMIN_EMAIL).toLowerCase();
const adminPassword = process.env.ADMIN_PASSWORD || DEFAULT_ADMIN_PASSWORD;
const baseDomain = (process.env.SEED_BASE_DOMAIN?.trim() || DEFAULT_BASE_DOMAIN).replace(/^https?:\/\//, "").replace(/\/+$/, "");
const usesDefaultPassword = adminPassword === DEFAULT_ADMIN_PASSWORD;

const DAY = 24 * 60 * 60 * 1000;
const now = Date.now();
const daysFromNow = (days: number, hour = 9, minute = 0): Date => {
  const d = new Date(now + days * DAY);
  d.setUTCHours(hour, minute, 0, 0);
  return d;
};

// ---------------------------------------------------------------------------
// Inhalte
// ---------------------------------------------------------------------------

const services = [
  {
    name: "Vylaris Vault",
    slug: "vault",
    tagline: "Passwörter und Zugangsdaten – verschlüsselt, quelloffen, kostenlos.",
    description:
      "Vylaris Vault ist ein quelloffener Passwort-Manager für Einzelpersonen, Teams und Vereine. Zugangsdaten, Notizen und Wiederherstellungscodes werden auf deinem Gerät verschlüsselt, bevor sie den Server erreichen – wir können deinen Tresor also selbst nicht lesen. Du erzeugst starke Passwörter, teilst einzelne Einträge gezielt mit anderen Personen und nutzt den Tresor im Browser. Es gibt keine Bezahlstufe, keine Funktionsbremse und kein Tracking.",
    category: "Sicherheit",
    url: `https://vault.${baseDomain}`,
    repoUrl: `https://git.${baseDomain}/vylaris/vault`,
    uptime: 99.98,
    featured: true,
    sortOrder: 10,
  },
  {
    name: "Vylaris Share",
    slug: "share",
    tagline: "Dateien Ende-zu-Ende-verschlüsselt austauschen – ohne Konto-Zwang.",
    description:
      "Mit Vylaris Share verschickst du Dateien über einen Link, den nur du und die Empfänger entschlüsseln können. Die Verschlüsselung findet im Browser statt, der Schlüssel steckt im Link und wird nie an den Server übertragen. Du legst fest, wie lange ein Link gültig ist und wie oft er abgerufen werden darf; danach werden die Daten gelöscht. Der Dienst ist kostenlos, quelloffen und kommt ohne Tracking aus.",
    category: "Produktivität",
    url: `https://share.${baseDomain}`,
    repoUrl: `https://git.${baseDomain}/vylaris/share`,
    uptime: 99.95,
    featured: true,
    sortOrder: 20,
  },
  {
    name: "Vylaris Alias",
    slug: "alias",
    tagline: "E-Mail-Aliasse, die deine echte Adresse schützen.",
    description:
      "Vylaris Alias erzeugt beliebig viele E-Mail-Adressen, die Nachrichten an dein Postfach weiterleiten. Du gibst bei jeder Registrierung eine eigene Adresse an, erkennst so, wer deine Daten weitergibt, und schaltest einen Alias mit einem Klick ab, sobald er Spam anzieht. Deine echte Adresse bleibt verborgen. Der Dienst ist kostenlos und quelloffen, Weiterleitungen werden nicht ausgewertet und kein Nutzerverhalten wird getrackt.",
    category: "Kommunikation",
    url: `https://alias.${baseDomain}`,
    repoUrl: `https://git.${baseDomain}/vylaris/alias`,
    uptime: 99.93,
    featured: true,
    sortOrder: 30,
  },
  {
    name: "Vylaris Paste",
    slug: "paste",
    tagline: "Verschlüsselte Snippets und Notizen für Entwickler:innen.",
    description:
      "Vylaris Paste ist ein Dienst zum Teilen von Code-Schnipseln, Konfigurationen und Notizen. Inhalte werden im Browser verschlüsselt, Syntax-Hervorhebung läuft lokal, und jeder Eintrag kann ein Ablaufdatum oder eine einmalige Ansicht erhalten. So landen Logs, Tokens und Konfigurationsauszüge nicht dauerhaft in fremden Systemen. Kostenlos, quelloffen und ohne Tracking.",
    category: "Entwickler-Tools",
    url: `https://paste.${baseDomain}`,
    repoUrl: `https://git.${baseDomain}/vylaris/paste`,
    uptime: 99.91,
    featured: false,
    sortOrder: 40,
  },
];

const POST_HOMELAB = `Jedes Projekt hat einen Anfang, der unspektakulärer ist als seine Geschichte danach. Bei der VylarisGroup ist das ein eigenes Homelab: ein paar selbst betriebene Systeme, viel Neugier und der Wunsch, wirklich zu verstehen, wie Dienste funktionieren, statt sie nur zu konsumieren.

## Ausprobieren, scheitern, dazulernen

Ein Homelab ist ein geschützter Spielplatz. Man kann Dienste selbst hosten, Netzwerke neu aufbauen, Backups absichtlich zurückspielen und Fehler machen, ohne dass jemand darunter leidet. Genau dort ist die Grundhaltung entstanden, die uns bis heute prägt:

- **Selbst betreiben, was man nutzt.** Wer einen Dienst selbst hostet, versteht ihn besser und vertraut ihm begründeter.
- **Offen dokumentieren.** Was man gelernt hat, soll anderen den Einstieg erleichtern.
- **Sicherheit von Anfang an mitdenken.** Nicht als Zusatzoption, sondern als Voraussetzung.

## Der Podcast: Wissen teilen

Aus den Erfahrungen im Homelab wurde ein Podcast. Er gab uns einen Ort, um über unsere Themen zu sprechen – verständlich, ohne Fachsimpelei um ihrer selbst willen. Mit dem Podcast wuchs auch der Kreis der Menschen, die mitdenken, nachfragen und mitmachen wollten.

> „Sicherheit muss nichts kosten, nur weil große Unternehmen das sagen.“

Dieser Satz ist keine Marketingzeile, sondern der Kern dessen, was uns antreibt. Datenschutz und digitale Selbstbestimmung sollten kein Luxus sein, den man sich leisten können muss.

## Vom Hobby zum Verein

Irgendwann reichte ein loses Projekt nicht mehr. Wer Verantwortung für Dienste und Daten übernimmt, braucht klare Strukturen. Deshalb haben wir in der Schweiz einen Verein gegründet: die VylarisGroup, erreichbar unter vylaris.ch. Heute besteht er aus fünf Mitgliedern, drei davon bilden den Vorstand.

Die Vereinsform war eine bewusste Entscheidung. Sie macht transparent, wer Verantwortung trägt, und gibt dem Projekt einen festen Rahmen. Der Zweck steht dabei fest: freie, sichere und nachvollziehbare Technik für alle.

## Was daraus geworden ist

Aus dem Homelab-Gedanken sind Leitlinien geworden, an denen wir jede Entscheidung messen:

1. **Sicherheit ohne Paywall.** Unsere SaaS-Angebote sind und bleiben kostenlos. Dein Geld bleibt deins.
2. **Open Source und Eigenentwicklung.** Der Code ist einsehbar, es gibt keine proprietären Hintertüren.
3. **Datenschutz als Standard.** Kein Tracking, keine Datenweitergabe, keine versteckten Abhängigkeiten.

## Wie es weitergeht

Ein Verein mit fünf Mitgliedern lebt von Begeisterung, stößt aber an Grenzen, sobald Unternehmen und Organisationen verlässliche Infrastruktur und eine belastbare rechtliche Struktur in Europa brauchen. Wie wir diese Lücke schließen, erfährst du im nächsten Beitrag: Dort stellen wir VylarisGroupEurope vor – die europäische Ergänzung, die Hand in Hand mit dem Schweizer Verein arbeitet.

Bis dahin gilt: Der Anfang war ein Homelab. Die Neugier ist geblieben.`;

const POST_EUROPE = `Heute ist es so weit: VylarisGroupEurope ist offiziell gestartet. Wir sind die europäische Firma und die Zweitstelle der VylarisGroup – mit derselben Mission wie der Schweizer Verein, aber mit einer eigenen rechtlichen und technischen Struktur für Europa.

## Warum eine europäische Firma?

Der Verein vylaris.ch ist das ideelle Fundament unserer Arbeit. Er besteht aus fünf Mitgliedern, drei davon sind im Vorstand, und er ist aus einem Homelab und einem Podcast entstanden. Für viele Vorhaben ist diese Form ideal. Sobald es aber um verbindliche Verträge, hochverfügbaren Betrieb und die Zusammenarbeit mit Unternehmen geht, braucht es zusätzlich eine Struktur, die in Europa rechtlich tragfähig ist.

Genau das ist VylarisGroupEurope: die offizielle europäische Rechts- und Unternehmensstruktur der VylarisGroup.

## Hand in Hand mit der VylarisGroup Schweiz

Wir arbeiten nicht neben, sondern mit dem Schweizer Verein. Die Aufgaben sind klar verteilt:

- **Der Verein** bleibt Ursprung, Wertegeber und Gemeinschaft.
- **VylarisGroupEurope** stellt die Unternehmensstruktur und die hochverfügbare Hosting- und Server-Infrastruktur bereit.

So bleibt das Gemeinwohl-Versprechen unverändert, während der Betrieb professioneller und belastbarer wird.

## Wer das Unternehmen leitet

Die Leitung übernimmt Lucas Wilms. Er ist Experte für Webhosting und IT-Services und führt mit CircleUp-Wilms Webhosting & IT-Services ein eigenes Unternehmen in diesem Bereich. Diese Erfahrung bringt er in den Aufbau unserer Infrastruktur ein.

> „Verlässliche Infrastruktur ist die Voraussetzung dafür, dass Datenschutz im Alltag funktioniert – nicht nur auf dem Papier."

## Was sich nicht ändert

Mit dem Start der Firma ändern sich unsere Grundsätze nicht. Sie gelten für alles, was wir anbieten:

1. **Sicherheit ohne Paywall.** Alle SaaS-Angebote bleiben zu 100 % kostenlos.
2. **100 % Open Source.** Eigenentwicklung mit transparentem Code und ohne proprietäre Backdoors.
3. **Europäisches Hosting und Datenschutz.** Eigene, vertrauenswürdige Infrastruktur, kein Tracking und ein Betrieb, der sich an der DSGVO orientiert.

## Was du jetzt tun kannst

- Auf der Seite **Dienste** findest du unsere aktuellen Angebote.
- Auf der **Status-Seite** siehst du, wie es um Infrastruktur und Dienste steht. Die Angaben pflegen wir manuell und kennzeichnen, wann sie zuletzt aktualisiert wurden.
- Wenn du Hosting für dein Unternehmen suchst oder eine Sicherheitslücke melden möchtest, schreib uns über das **Kontaktformular**.

## Ausblick

Wir bauen Schritt für Schritt aus: mehr Redundanz, mehr Transparenz und weitere Dienste, die den Alltag sicherer machen. Wie bisher berichten wir offen darüber, was funktioniert und was nicht.

Danke an alle, die uns bis hierher begleitet haben. Das ist der Anfang eines neuen Kapitels – mit derselben Mission.`;

const posts = [
  {
    title: "Vom Homelab zum Verein: Wie die VylarisGroup entstanden ist",
    slug: "vom-homelab-zum-verein",
    excerpt:
      "Ein Homelab, ein Podcast und die Überzeugung, dass Sicherheit nichts kosten sollte: die Geschichte hinter der VylarisGroup und ihrem Schweizer Verein mit fünf Mitgliedern.",
    content: POST_HOMELAB,
    author: "Redaktion VylarisGroup",
    publishedAt: daysFromNow(-21, 8, 0),
  },
  {
    title: "VylarisGroupEurope startet: Europäische Struktur, gleiche Mission",
    slug: "vylarisgroupeurope-startet",
    excerpt:
      "Wir sind die offizielle europäische Firma und Zweitstelle der VylarisGroup: Hand in Hand mit dem Schweizer Verein, geleitet von Lucas Wilms, mit eigener Hosting-Infrastruktur.",
    content: POST_EUROPE,
    author: "Lucas Wilms",
    publishedAt: daysFromNow(-7, 8, 0),
  },
];

const metrics = [
  { name: "Primärer Server Europa", slug: "server-primaer", kind: "SERVER", location: "Europa", uptime: 99.98, responseMs: 42, sortOrder: 10 },
  { name: "Sekundärer Server Europa (Failover)", slug: "server-failover", kind: "SERVER", location: "Europa", uptime: 99.97, responseMs: 48, sortOrder: 20 },
  { name: "Netzwerk & DNS", slug: "netzwerk-dns", kind: "NETWORK", location: "Europa", uptime: 99.99, responseMs: 18, sortOrder: 30 },
  { name: "Datenbank-Cluster", slug: "datenbank-cluster", kind: "DATABASE", location: "Europa", uptime: 99.96, responseMs: 9, sortOrder: 40 },
  { name: "Backup-Speicher", slug: "backup-speicher", kind: "STORAGE", location: "Europa", uptime: 99.95, responseMs: 65, sortOrder: 50 },
];

const incidents = [
  {
    id: "seed-incident-resolved",
    title: "Kurzzeitig erhöhte Antwortzeiten bei Datei-Uploads",
    body:
      "Bei Datei-Uploads sind für einen kurzen Zeitraum erhöhte Antwortzeiten aufgetreten. Ursache war eine zu knapp bemessene Verbindungsgrenze zwischen Anwendung und Speicher. Wir haben die Grenze angehoben und die Verbindungen neu aufgebaut. Seitdem laufen Uploads wieder wie gewohnt. Es sind keine Daten verloren gegangen.",
    severity: "MINOR",
    status: "RESOLVED",
    startedAt: daysFromNow(-12, 9, 15),
    resolvedAt: daysFromNow(-12, 10, 40),
  },
  {
    id: "seed-incident-maintenance",
    title: "Geplante Wartung: Sicherheitsupdates und Neustart der Server",
    body:
      "Wir spielen reguläre Sicherheitsupdates auf unsere Server ein. Dabei kann es zu kurzen Unterbrechungen von wenigen Minuten kommen, während einzelne Systeme neu starten. Wir führen die Arbeiten nacheinander aus und nutzen den Failover-Server, um die Auswirkungen gering zu halten. Sobald die Wartung abgeschlossen ist, aktualisieren wir diese Meldung.",
    severity: "MAINTENANCE",
    status: "SCHEDULED",
    startedAt: daysFromNow(5, 22, 0),
    resolvedAt: null,
  },
];

// ---------------------------------------------------------------------------
// Englische Fassungen (vylaris.net)
// ---------------------------------------------------------------------------

type ServiceEn = { nameEn: string; taglineEn: string; descriptionEn: string };
type PostEn = { titleEn: string; excerptEn: string; contentEn: string };
type IncidentEn = { titleEn: string; bodyEn: string };

const servicesEn: Record<string, ServiceEn> = {
  vault: {
    nameEn: "Vylaris Vault",
    taglineEn: "Passwords and credentials – encrypted, open source, free.",
    descriptionEn:
      "Vylaris Vault is an open-source password manager for individuals, teams and clubs. Credentials, notes and recovery codes are encrypted on your device before they ever reach the server, so we cannot read your vault ourselves. You generate strong passwords, share individual entries with specific people and use your vault right in the browser. There is no paid tier, no feature throttling and no tracking.",
  },
  share: {
    nameEn: "Vylaris Share",
    taglineEn: "Share files with end-to-end encryption – no account required.",
    descriptionEn:
      "With Vylaris Share you send files through a link that only you and your recipients can decrypt. Encryption happens in the browser, and the key is part of the link and never sent to the server. You decide how long a link stays valid and how often it can be opened; after that, the data is deleted. The service is free, open source and works without tracking.",
  },
  alias: {
    nameEn: "Vylaris Alias",
    taglineEn: "Email aliases that protect your real address.",
    descriptionEn:
      "Vylaris Alias creates as many email addresses as you like, all forwarding messages to your inbox. You use a separate address for every sign-up, see who passes your data on, and switch an alias off with one click as soon as it attracts spam. Your real address stays hidden. The service is free and open source, forwarded messages are not analyzed and no user behavior is tracked.",
  },
  paste: {
    nameEn: "Vylaris Paste",
    taglineEn: "Encrypted snippets and notes for developers.",
    descriptionEn:
      "Vylaris Paste is a service for sharing code snippets, configurations and notes. Content is encrypted in the browser, syntax highlighting runs locally, and every entry can get an expiry date or a one-time view. That way logs, tokens and configuration excerpts do not end up permanently in other people's systems. Free, open source and without tracking.",
  },
};

const POST_HOMELAB_EN = `Every project has a beginning that is less spectacular than the story that follows. For the VylarisGroup, that beginning is a homelab of our own: a few self-hosted systems, plenty of curiosity and the wish to truly understand how services work instead of just consuming them.

## Try, fail, learn

A homelab is a protected playground. You can host services yourself, rebuild networks, restore backups on purpose and make mistakes without anyone suffering for it. That is exactly where the mindset that still shapes us today took root:

- **Run what you use.** If you host a service yourself, you understand it better and can trust it for good reasons.
- **Document openly.** What you have learned should make it easier for others to get started.
- **Think security from day one.** Not as an add-on, but as a prerequisite.

## The podcast: sharing knowledge

The experience from the homelab grew into a podcast. It gave us a place to talk about our topics – in plain language, without jargon for its own sake. As the podcast grew, so did the circle of people who wanted to think along, ask questions and take part.

> “Security shouldn't cost anything just because big companies say so.”

This sentence is not a marketing line but the core of what drives us. Privacy and digital self-determination should not be a luxury you have to be able to afford.

## From hobby to association

At some point a loose project was no longer enough. Anyone who takes responsibility for services and data needs clear structures. That is why we founded an association in Switzerland: the VylarisGroup, reachable at vylaris.ch. Today it has five members, three of whom form the board.

The association form was a deliberate choice. It makes transparent who is responsible and gives the project a firm framework. The purpose stays the same: free, secure and transparent technology for everyone.

## What it has become

The homelab spirit has turned into guidelines against which we measure every decision:

1. **Security without a paywall.** Our SaaS offerings are and will remain free. Your money stays yours.
2. **Open source and in-house development.** The code is open to inspection, with no proprietary backdoors.
3. **Privacy by default.** No tracking, no data sharing, no hidden dependencies.

## What comes next

An association with five members thrives on enthusiasm, but it reaches its limits as soon as companies and organizations need reliable infrastructure and a robust legal structure in Europe. How we close that gap is the subject of our next post, where we introduce VylarisGroupEurope – the European counterpart that works hand in hand with the Swiss association.

Until then, one thing holds true: it all began with a homelab. The curiosity is still here.`;

const POST_EUROPE_EN = `Today is the day: VylarisGroupEurope has officially launched. We are the European company and second location of the VylarisGroup – with the same mission as the Swiss association, but with a legal and technical structure of our own for Europe.

## Why a European company?

The association vylaris.ch is the ideological foundation of our work. It has five members, three of whom sit on the board, and it grew out of a homelab and a podcast. For many undertakings this form is ideal. But as soon as binding contracts, highly available operations and cooperation with companies come into play, a structure that is legally sound in Europe is needed as well.

That is exactly what VylarisGroupEurope is: the official European legal and corporate structure of the VylarisGroup.

## Hand in hand with VylarisGroup Switzerland

We do not work alongside the Swiss association, but together with it. The roles are clearly divided:

- **The association** remains the origin, the source of our values and the community.
- **VylarisGroupEurope** provides the corporate structure and the highly available hosting and server infrastructure.

This keeps our commitment to the common good unchanged, while operations become more professional and more robust.

## Who runs the company

Lucas Wilms takes over the management. He is an expert in web hosting and IT services and runs his own company in this field, CircleUp-Wilms Webhosting & IT-Services. He brings this experience to the build-out of our infrastructure.

> “Reliable infrastructure is the prerequisite for privacy to work in everyday life – not just on paper.”

## What does not change

With the launch of the company, our principles stay the same. They apply to everything we offer:

1. **Security without a paywall.** All SaaS offerings remain 100% free.
2. **100% open source.** In-house development with transparent code and no proprietary backdoors.
3. **European hosting and privacy.** Our own trustworthy infrastructure, no tracking and operations guided by the GDPR.

## What you can do now

- On the **Services** page you will find our current offerings.
- On the **Status** page you can see how our infrastructure and services are doing. We maintain this information manually and indicate when it was last updated.
- If you are looking for hosting for your company or want to report a security vulnerability, write to us through the **contact form**.

## Outlook

We are expanding step by step: more redundancy, more transparency and further services that make everyday life more secure. As before, we will report openly on what works and what does not.

Thank you to everyone who has accompanied us this far. This is the start of a new chapter – with the same mission.`;

const postsEn: Record<string, PostEn> = {
  "vom-homelab-zum-verein": {
    titleEn: "From Homelab to Association: How the VylarisGroup Came to Be",
    excerptEn:
      "A homelab, a podcast and the conviction that security shouldn't cost anything: the story behind the VylarisGroup and its Swiss association with five members.",
    contentEn: POST_HOMELAB_EN,
  },
  "vylarisgroupeurope-startet": {
    titleEn: "VylarisGroupEurope Launches: European Structure, Same Mission",
    excerptEn:
      "We are the official European company and second location of the VylarisGroup: hand in hand with the Swiss association, led by Lucas Wilms, with our own hosting infrastructure.",
    contentEn: POST_EUROPE_EN,
  },
};

const incidentsEn: Record<string, IncidentEn> = {
  "seed-incident-resolved": {
    titleEn: "Briefly elevated response times for file uploads",
    bodyEn:
      "File uploads briefly experienced elevated response times. The cause was a connection limit between the application and storage that was set too low. We raised the limit and re-established the connections. Uploads have been running normally since then. No data was lost.",
  },
  "seed-incident-maintenance": {
    titleEn: "Scheduled maintenance: security updates and server restarts",
    bodyEn:
      "We are applying regular security updates to our servers. Short interruptions of a few minutes may occur while individual systems restart. We carry out the work one system at a time and use the failover server to keep the impact low. As soon as the maintenance is complete, we will update this notice.",
  },
};

const ticket = {
  ticketNumber: "VGE-SEED-0001",
  name: "Mara Keller",
  email: "mara.keller@example.org",
  subject: "Frage zu Hosting für unseren Verein",
  category: "GENERAL",
  message:
    "Hallo zusammen,\n\nwir sind ein kleiner Sportverein und suchen eine datenschutzfreundliche Lösung für unsere Website und gemeinsame Dateiablage. Eure Dienste klingen interessant. Könnt ihr uns erklären, wie der Einstieg aussieht und ob ihr auch bei der Einrichtung unterstützt?\n\nViele Grüße\nMara Keller",
};

// ---------------------------------------------------------------------------
// Ablauf
// ---------------------------------------------------------------------------

async function seedAdmin(): Promise<void> {
  const existing = await db.adminUser.findUnique({ where: { email: adminEmail }, select: { id: true } });
  if (existing) {
    console.log(`Admin-User ${adminEmail} existiert bereits – Passwort bleibt unverändert.`);
    return;
  }
  const passwordHash = await bcrypt.hash(adminPassword, BCRYPT_COST);
  await db.adminUser.create({
    data: {
      email: adminEmail,
      name: "Lucas Wilms",
      role: "OWNER",
      passwordHash,
      mustChangePassword: true,
    },
  });
  console.log("Admin-User angelegt:");
  console.log(`  E-Mail:   ${adminEmail}`);
  if (usesDefaultPassword) {
    console.log(`  Passwort: ${DEFAULT_ADMIN_PASSWORD}   (Standard-Passwort!)`);
    console.warn("  WARNUNG: Es wird das öffentlich bekannte Standard-Passwort verwendet. Ändere es beim ersten Login");
    console.warn("           (mustChangePassword ist gesetzt) und setze in Produktion ADMIN_PASSWORD.");
  } else {
    console.log("  Passwort: aus ADMIN_PASSWORD (wird nicht ausgegeben)");
  }
  console.log("  Beim ersten Login muss das Passwort geändert werden.");
}

// Lizenz-Produkte. Beschreibungen bewusst neutral, ohne Funktions- oder Preisversprechen.
const products = [
  {
    slug: "webspace",
    code: "WEB",
    name: "VylarisGroup Webspace",
    nameEn: "VylarisGroup Webspace",
    description: "Webspace für deine Projekte – betrieben über VylarisGroup. Lizenzschlüssel für Firmenkunden, Konten für alle anderen.",
    descriptionEn: "Web space for your projects, operated through VylarisGroup. License keys for business customers, accounts for everyone else.",
    businessOnly: true,
    allowAccountRequest: true,
    approvalMode: "MANUAL",
    comingSoon: true,
    active: true,
    sortOrder: 10,
  },
  {
    slug: "autoinstaller",
    code: "AIN",
    name: "VylarisGroup Autoinstaller",
    nameEn: "VylarisGroup Autoinstaller",
    description: "Installiert ausgewählte VylarisGroup-Produkte automatisch auf deinem Server.",
    descriptionEn: "Automatically installs selected VylarisGroup products on your server.",
    businessOnly: false,
    allowAccountRequest: false,
    approvalMode: "AUTO",
    comingSoon: true,
    active: true,
    sortOrder: 20,
  },
] as const;

async function main(): Promise<void> {
  // Sicherheitsnetz zuerst, bevor irgendetwas geschrieben wird.
  if (process.env.NODE_ENV === "production" && usesDefaultPassword && process.env.ALLOW_DEFAULT_ADMIN_PASSWORD !== "true") {
    const existing = await db.adminUser.findUnique({ where: { email: adminEmail }, select: { id: true } });
    if (!existing) {
      console.error("FEHLER: Das Standard-Admin-Passwort darf in Produktion nicht verwendet werden.");
      console.error("       Setze ADMIN_PASSWORD (und ggf. ADMIN_EMAIL) oder bestätige bewusst mit ALLOW_DEFAULT_ADMIN_PASSWORD=true.");
      process.exit(1);
    }
  }

  console.log(`Seed startet (Basis-Domain: ${baseDomain})`);

  await seedAdmin();

  const force = process.env.SEED_FORCE === "true";
  const done = new Set((await db.siteSetting.findMany({ where: { key: { startsWith: "seed." } }, select: { key: true } })).map((r) => r.key));
  const mark = (key: string) => db.siteSetting.upsert({ where: { key }, update: { value: "true" }, create: { key, value: "true" } });
  const todo = (key: string) => force || !done.has(key);

  if (todo("seed.content.v1")) {
    for (const s of services) {
      await db.saasService.upsert({ where: { slug: s.slug }, update: {}, create: { ...s, ...servicesEn[s.slug], status: "OPERATIONAL" } });
    }
    console.log(`Dienste: ${services.length} geprüft/angelegt`);
    for (const p of posts) {
      await db.blogPost.upsert({ where: { slug: p.slug }, update: {}, create: { ...p, ...postsEn[p.slug], published: true } });
    }
    console.log(`Blogposts: ${posts.length} geprüft/angelegt`);
    for (const m of metrics) {
      await db.systemMetric.upsert({ where: { slug: m.slug }, update: {}, create: { ...m, status: "OPERATIONAL" } });
    }
    console.log(`Infrastruktur-Komponenten: ${metrics.length} geprüft/angelegt`);
    for (const i of incidents) {
      await db.incident.upsert({ where: { id: i.id }, update: {}, create: { ...i, ...incidentsEn[i.id] } });
    }
    console.log(`Vorfälle/Wartungen: ${incidents.length} geprüft/angelegt`);
    if (process.env.NODE_ENV !== "production" || process.env.SEED_EXAMPLE_TICKET === "true") {
      await db.contactTicket.upsert({ where: { ticketNumber: ticket.ticketNumber }, update: {}, create: { ...ticket, status: "OPEN" } });
      console.log(`Beispiel-Ticket ${ticket.ticketNumber} geprüft/angelegt`);
    }
    await mark("seed.content.v1");
  } else {
    console.log("Basisinhalte: bereits angelegt (übersprungen)");
  }

  if (todo("seed.en.v1")) {
    // Bestehende Datenbanken: englische Felder nur dort füllen, wo sie noch leer sind (einmalig).
    for (const s of services) {
      const en = servicesEn[s.slug];
      if (!en) continue;
      await db.saasService.updateMany({ where: { slug: s.slug, nameEn: null }, data: { nameEn: en.nameEn } });
      await db.saasService.updateMany({ where: { slug: s.slug, taglineEn: null }, data: { taglineEn: en.taglineEn } });
      await db.saasService.updateMany({ where: { slug: s.slug, descriptionEn: null }, data: { descriptionEn: en.descriptionEn } });
    }
    for (const p of posts) {
      const en = postsEn[p.slug];
      if (!en) continue;
      await db.blogPost.updateMany({ where: { slug: p.slug, titleEn: null }, data: { titleEn: en.titleEn } });
      await db.blogPost.updateMany({ where: { slug: p.slug, excerptEn: null }, data: { excerptEn: en.excerptEn } });
      await db.blogPost.updateMany({ where: { slug: p.slug, contentEn: null }, data: { contentEn: en.contentEn } });
    }
    for (const i of incidents) {
      const en = incidentsEn[i.id];
      if (!en) continue;
      await db.incident.updateMany({ where: { id: i.id, titleEn: null }, data: { titleEn: en.titleEn } });
      await db.incident.updateMany({ where: { id: i.id, bodyEn: null }, data: { bodyEn: en.bodyEn } });
    }
    await mark("seed.en.v1");
  }

  if (todo("seed.products.v1")) {
    for (const p of products) {
      await db.product.upsert({ where: { slug: p.slug }, update: {}, create: { ...p } });
    }
    console.log(`Lizenz-Produkte: ${products.length} geprüft/angelegt`);
    await mark("seed.products.v1");
  }

  console.log("Seed abgeschlossen.");
}

main()
  .then(async () => {
    await db.$disconnect();
  })
  .catch(async (err) => {
    console.error("Seed fehlgeschlagen:", err);
    await db.$disconnect();
    process.exit(1);
  });
