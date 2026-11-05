/**
 * VylarisGroup Schweiz – Seed
 *
 * Aufruf: `tsx prisma/seed.ts` bzw. `npm run db:seed`.
 *
 * Der Seed ist idempotent: Inhalte (Blog, Einstellungen, Newsletter-Entwurf) werden per
 * upsert mit `update: {}` angelegt und überschreiben daher NIE Änderungen aus dem Admin-Bereich.
 * Ausserdem läuft jeder Teil nur EINMAL (Marker "seed.*" in der Tabelle SiteSetting): Was ein Admin später löscht,
 * kommt beim nächsten Containerstart nicht wieder. Mit SEED_FORCE=true werden alle Teile erneut ausgeführt.
 * Der Admin-User wird nur angelegt, wenn seine E-Mail noch nicht existiert; ein bestehender
 * Passwort-Hash bleibt unangetastet.
 *
 * Dienste, Infrastruktur-Komponenten, Vorfälle und Lizenz-Produkte legt der Seed bewusst NICHT an: Sie werden im Admin
 * mit den echten Angaben erfasst, bis dahin zeigt die Seite die vorgesehenen Leerzustände.
 * Die Anbieterangaben (Anschrift, Telefon, Kontakt-E-Mail) stammen aus den öffentlich bekannten Angaben des Vereins
 * und werden nur als Anfangswerte in die Einstellungen geschrieben (Admin → Einstellungen → Rechtliches hat Vorrang).
 *
 * Umgebungsvariablen:
 *   ADMIN_EMAIL                     Default: admin@vylaris.example
 *   ADMIN_PASSWORD                  Default: ChangeMe-Vylaris-2026!
 *   LEGAL_STREET, LEGAL_ZIP_CITY, LEGAL_COUNTRY, LEGAL_PHONE, CONTACT_EMAIL
 *                                   Anfangswerte der Anbieterangaben (sonst die Angaben des Vereins)
 *   SEED_FORCE                      "true" ignoriert die Marker und führt alle Teile erneut aus
 *   ALLOW_DEFAULT_ADMIN_PASSWORD    "true" erlaubt das Default-Passwort auch bei NODE_ENV=production
 */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { FOUNDING_POST } from "../src/i18n/blog-seed";

const db = new PrismaClient();

const DEFAULT_ADMIN_EMAIL = "admin@vylaris.example";
const DEFAULT_ADMIN_PASSWORD = "ChangeMe-Vylaris-2026!";
const BCRYPT_COST = 12;

const adminEmail = (process.env.ADMIN_EMAIL?.trim() || DEFAULT_ADMIN_EMAIL).toLowerCase();
const adminPassword = process.env.ADMIN_PASSWORD || DEFAULT_ADMIN_PASSWORD;
const usesDefaultPassword = adminPassword === DEFAULT_ADMIN_PASSWORD;

// ---------------------------------------------------------------------------
// Inhalte
// ---------------------------------------------------------------------------

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

Wie wir zum Verein geworden sind, erzählen wir in unserem Blog im Beitrag «In kleinen Schritten zum Ziel – Vereinsgründung».

Wenn du Fragen hast oder mitmachen möchtest, schreib uns über das Kontaktformular auf vylaris.ch.

Freundliche Grüsse
Dein Team der VylarisGroup`,
};

// Mitgliedschaftsarten: nur die Struktur (Aktiv-/Passivmitglied). Die Beiträge legt der Verein selbst fest, bis dahin 0 Rappen.
// Stimmrecht und Vorstandsfähigkeit folgen der gesetzlichen Grundregel (ZGB Art. 67: gleiches Stimmrecht für alle Mitglieder) –
// bitte gemäss Statuten anpassen.
const membershipTypes = [
  {
    name: "Aktivmitglied",
    description: "Beitrag, Stimmrecht und weitere Rechte legt der Verein gemäss Statuten fest (Vorlage, bitte anpassen).",
    sortOrder: 10,
  },
  {
    name: "Passivmitglied",
    description: "Beitrag, Stimmrecht und weitere Rechte legt der Verein gemäss Statuten fest (Vorlage, bitte anpassen).",
    sortOrder: 20,
  },
];

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

  console.log("Seed startet");

  await seedAdmin();

  const force = process.env.SEED_FORCE === "true";
  const done = new Set((await db.siteSetting.findMany({ where: { key: { startsWith: "seed." } }, select: { key: true } })).map((r) => r.key));
  const mark = (key: string) => db.siteSetting.upsert({ where: { key }, update: { value: "true" }, create: { key, value: "true" } });
  const todo = (key: string) => force || !done.has(key);

  if (todo("seed.blog.v1")) {
    for (const p of posts) {
      await db.blogPost.upsert({ where: { slug: p.slug }, update: {}, create: { ...p, published: true } });
    }
    console.log(`Blogposts: ${posts.length} geprüft/angelegt`);
    await mark("seed.blog.v1");
  } else {
    console.log("Blogbeitrag: bereits angelegt (übersprungen)");
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

  if (todo("seed.verein.v1")) {
    // Nur fehlende Arten anlegen (nach Name); bestehende Änderungen aus dem Admin bleiben unangetastet.
    for (const t of membershipTypes) {
      await db.membershipType.upsert({
        where: { name: t.name },
        update: {},
        create: { ...t, annualFeeRappen: 0, votingRight: true, eligibleForBoard: true, selectable: true, active: true },
      });
    }
    console.log(`Mitgliedschaftsarten: ${membershipTypes.length} geprüft/angelegt (Beitrag 0 CHF, vom Verein festzulegen)`);
    await mark("seed.verein.v1");
  } else {
    console.log("Mitgliedschaftsarten: bereits angelegt (übersprungen)");
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
