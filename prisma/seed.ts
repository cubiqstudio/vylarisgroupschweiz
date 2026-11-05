/**
 * VylarisGroup Schweiz – Seed
 *
 * Aufruf: `tsx prisma/seed.ts` bzw. `npm run db:seed`.
 *
 * Der Seed ist idempotent: Inhalte (Dienste, Blog, Metriken, Vorfälle, Produkte, Einstellungen) werden per
 * upsert mit `update: {}` angelegt und überschreiben daher NIE Änderungen aus dem Admin-Bereich.
 * Ausserdem läuft jeder Teil nur EINMAL (Marker "seed.*" in der Tabelle SiteSetting): Was ein Admin später löscht,
 * kommt beim nächsten Containerstart nicht wieder. Mit SEED_FORCE=true werden alle Teile erneut ausgeführt.
 * Das Beispiel-Ticket wird in Produktion nicht angelegt (ausser SEED_EXAMPLE_TICKET=true).
 * Der Admin-User wird nur angelegt, wenn seine E-Mail noch nicht existiert; ein bestehender
 * Passwort-Hash bleibt unangetastet.
 *
 * Die Dienste, Metriken und Vorfälle sind Beispieldaten und im Admin durch die echten Angaben zu ersetzen.
 * Die Anbieterangaben (Anschrift, Telefon, Kontakt-E-Mail) stammen aus den öffentlich bekannten Angaben des Vereins
 * und werden nur als Anfangswerte in die Einstellungen geschrieben (Admin → Einstellungen → Rechtliches hat Vorrang).
 *
 * Umgebungsvariablen:
 *   ADMIN_EMAIL                     Default: admin@vylaris.example
 *   ADMIN_PASSWORD                  Default: ChangeMe-Vylaris-2026!
 *   SEED_BASE_DOMAIN                Default: vylaris.example
 *   LEGAL_STREET, LEGAL_ZIP_CITY, LEGAL_COUNTRY, LEGAL_PHONE, CONTACT_EMAIL
 *                                   Anfangswerte der Anbieterangaben (sonst die Angaben des Vereins)
 *   SEED_FORCE                      "true" ignoriert die Marker und führt alle Teile erneut aus
 *   SEED_EXAMPLE_TICKET             "true" legt das Beispiel-Ticket auch in Produktion an
 *   ALLOW_DEFAULT_ADMIN_PASSWORD    "true" erlaubt das Default-Passwort auch bei NODE_ENV=production
 */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { FOUNDING_POST } from "../src/i18n/blog-seed";

const db = new PrismaClient();

const DEFAULT_ADMIN_EMAIL = "admin@vylaris.example";
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

// Der erste Blogbeitrag liegt als reine Datei ohne Importe unter src/i18n, damit der Seed ihn auch im Container einlesen kann
// (das Dockerfile kopiert sie ins Laufzeit-Image).
const posts = [
  {
    title: FOUNDING_POST.title,
    slug: FOUNDING_POST.slug,
    excerpt: FOUNDING_POST.excerpt,
    content: FOUNDING_POST.content,
    author: FOUNDING_POST.author,
    publishedAt: new Date(FOUNDING_POST.publishedAt),
  },
];

const metrics = [
  { name: "Primärer Server", slug: "server-primaer", kind: "SERVER", location: "", uptime: 99.98, responseMs: 42, sortOrder: 10 },
  { name: "Sekundärer Server (Failover)", slug: "server-failover", kind: "SERVER", location: "", uptime: 99.97, responseMs: 48, sortOrder: 20 },
  { name: "Netzwerk & DNS", slug: "netzwerk-dns", kind: "NETWORK", location: "", uptime: 99.99, responseMs: 18, sortOrder: 30 },
  { name: "Datenbank-Cluster", slug: "datenbank-cluster", kind: "DATABASE", location: "", uptime: 99.96, responseMs: 9, sortOrder: 40 },
  { name: "Backup-Speicher", slug: "backup-speicher", kind: "STORAGE", location: "", uptime: 99.95, responseMs: 65, sortOrder: 50 },
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

const ticket = {
  ticketNumber: "VGS-SEED-0001",
  name: "Mara Keller",
  email: "mara.keller@example.org",
  subject: "Frage zu Hosting für unseren Verein",
  category: "GENERAL",
  message:
    "Hallo zusammen,\n\nwir sind ein kleiner Sportverein und suchen eine datenschutzfreundliche Lösung für unsere Website und gemeinsame Dateiablage. Eure Dienste klingen interessant. Könnt ihr uns erklären, wie der Einstieg aussieht und ob ihr auch bei der Einrichtung unterstützt?\n\nFreundliche Grüsse\nMara Keller",
};

// Anbieterangaben des Vereins (öffentlich bekannt, Quelle: Datenschutzerklärung und Fusszeile von vylaris.ch).
// Umgebungsvariablen des Installers haben Vorrang; im Admin gespeicherte Werte werden nie überschrieben.
const envText = (key: string, fallback: string): string => process.env[key]?.trim() || fallback;
const legalDefaults: Record<string, string> = {
  "legal.street": envText("LEGAL_STREET", "Schützengasse 13"),
  "legal.zipCity": envText("LEGAL_ZIP_CITY", "9410 Heiden (AR)"),
  "legal.country": envText("LEGAL_COUNTRY", "Schweiz"),
  "legal.phone": envText("LEGAL_PHONE", "+41 78 322 21 39"),
  "legal.email": envText("CONTACT_EMAIL", "support@vylaris.ch"),
};
// Register- und MWST-Nummer sind nicht bekannt: nur übernehmen, wenn der Installer sie liefert.
const legalOptional: Record<string, string | undefined> = {
  "legal.register": process.env.LEGAL_REGISTER?.trim(),
  "legal.vatId": process.env.LEGAL_VAT_ID?.trim(),
};

// Entwurf für den ersten Newsletter. Er wird nicht versendet, sondern liegt als Entwurf im Admin bereit.
const newsletterDraft = {
  subject: "Willkommen bei der VylarisGroup",
  preheader: "Kleine Schritte, grosses Ziel: Neuigkeiten aus dem Verein.",
  content: `Hallo und willkommen bei der VylarisGroup!

Wir sind ein Verein ohne Gewinnabsicht und setzen auf Open Source oder eigene Lösungen. Unsere Angebote sind für alle vollständig kostenlos: Sicherheit muss nichts kosten.

## Neuigkeiten

Wie wir zum Verein geworden sind, erzählen wir in unserem Blog im Beitrag «In kleinen Schritten zum Ziel: Vereinsgründung».

Wenn du Fragen hast oder mitmachen möchtest, antworte einfach auf diese E-Mail oder schreib uns über das Kontaktformular.

Freundliche Grüsse
Dein Team der VylarisGroup`,
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
      name: "Administration",
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
    description: "Webspace für deine Projekte – betrieben über VylarisGroup. Lizenzschlüssel für Firmenkunden, Konten für alle anderen.",
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
    description: "Installiert ausgewählte VylarisGroup-Produkte automatisch auf deinem Server.",
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
      await db.saasService.upsert({ where: { slug: s.slug }, update: {}, create: { ...s, status: "OPERATIONAL" } });
    }
    console.log(`Dienste: ${services.length} geprüft/angelegt`);
    for (const p of posts) {
      await db.blogPost.upsert({ where: { slug: p.slug }, update: {}, create: { ...p, published: true } });
    }
    console.log(`Blogposts: ${posts.length} geprüft/angelegt`);
    for (const m of metrics) {
      await db.systemMetric.upsert({ where: { slug: m.slug }, update: {}, create: { ...m, status: "OPERATIONAL" } });
    }
    console.log(`Infrastruktur-Komponenten: ${metrics.length} geprüft/angelegt`);
    for (const i of incidents) {
      await db.incident.upsert({ where: { id: i.id }, update: {}, create: { ...i } });
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

  if (todo("seed.legal.v1")) {
    // Nur fehlende Einstellungen anlegen: was im Admin gespeichert wurde, bleibt unangetastet.
    for (const [key, value] of Object.entries(legalDefaults)) {
      await db.siteSetting.upsert({ where: { key }, update: {}, create: { key, value } });
    }
    for (const [key, value] of Object.entries(legalOptional)) {
      if (value) await db.siteSetting.upsert({ where: { key }, update: {}, create: { key, value } });
    }
    console.log("Anbieterangaben (Impressum/Datenschutz): als Anfangswerte angelegt");
    await mark("seed.legal.v1");
  }

  if (todo("seed.newsletter.v1")) {
    const exists = await db.newsletterCampaign.findFirst({ where: { subject: newsletterDraft.subject }, select: { id: true } });
    if (!exists) await db.newsletterCampaign.create({ data: { ...newsletterDraft, status: "DRAFT" } });
    console.log("Newsletter-Entwurf: geprüft/angelegt");
    await mark("seed.newsletter.v1");
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
