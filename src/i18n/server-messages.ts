// Übersetzung der deutschen Fehlermeldungen der REST-API (Routen, src/lib/validation.ts, Zod-Standardtexte).
// Die Routen werfen weiterhin deutsche Texte; `handle()` in src/lib/api.ts übersetzt sie für englische Domains.
// Unbekannte Meldungen bleiben unverändert. Abdeckung prüfen: `npx tsx scripts/check-api-messages.mts`.
import type { Locale } from "@/lib/sites";

/** Exakte Zuordnungen: deutscher Text -> englischer Text. */
const EXACT_EN: Record<string, string> = {
  // --- src/lib/api.ts und src/app/api/_lib/http.ts
  "Ungültige Eingabe.": "Invalid input.",
  "Ein Eintrag mit diesem eindeutigen Wert existiert bereits.": "An entry with this unique value already exists.",
  "Interner Serverfehler.": "Internal server error.",
  "Ungültiger Origin.": "Invalid origin.",
  "Cross-Origin-Anfrage abgelehnt.": "Cross-origin request rejected.",
  "Nicht angemeldet.": "You are not signed in.",
  "Ungültiger JSON-Body.": "Invalid JSON body.",
  "Bitte gib die Service-URL an (oder markiere den Dienst als „Bald verfügbar“).": "Please enter the service URL (or mark the service as “Coming soon”).",
  "Die Eingabe enthält ungültige Zeichen.": "The input contains invalid characters.",
  "Dieser Bereich ist Teammitgliedern vorbehalten.": "This area is reserved for team members.",
  "Du kannst ein Ticket nur dir selbst zuweisen oder freigeben.": "You can only assign a ticket to yourself or release it.",
  "Dieses Ticket ist bereits einem Kollegen zugewiesen.": "This ticket is already assigned to a colleague.",
  "Es ist kein Mailserver eingerichtet. Antworten werden per E-Mail versendet – bitte wende dich an einen Administrator.": "No mail server is set up. Replies are sent by email – please contact an administrator.",
  "Der Body muss ein JSON-Objekt sein.": "The body must be a JSON object.",

  // --- Anmeldung, Registrierung, Passwort, Token
  "E-Mail oder Passwort falsch.": "Incorrect email or password.",
  "Zu viele Anmeldeversuche. Bitte versuche es später erneut.": "Too many sign-in attempts. Please try again later.",
  "Dein Konto ist gesperrt. Bitte kontaktiere uns.": "Your account is suspended. Please contact us.",
  "Bitte bestätige zuerst deine E-Mail-Adresse (Link in der Bestätigungsmail).": "Please confirm your email address first (link in the confirmation email).",
  "Die Registrierung ist derzeit nicht verfügbar.": "Registration is currently unavailable.",
  "Die E-Mail konnte gerade nicht versendet werden. Bitte versuche es in ein paar Minuten erneut.":
    "The email could not be sent right now. Please try again in a few minutes.",
  "Der Link ist ungültig oder abgelaufen. Bitte fordere einen neuen an.": "The link is invalid or has expired. Please request a new one.",
  "Der Link ist ungültig oder abgelaufen.": "The link is invalid or has expired.",
  "Dieser Abmelde-Link ist nicht (mehr) gültig.": "This unsubscribe link is no longer valid.",
  "Zu viele Anfragen. Bitte versuche es später erneut.": "Too many requests. Please try again later.",

  // --- Konto
  "Passwort erforderlich.": "Password required.",
  "Aktuelles Passwort erforderlich.": "Current password required.",
  "Das Passwort ist falsch.": "The password is incorrect.",
  "Das aktuelle Passwort ist falsch.": "The current password is incorrect.",
  "Das neue Passwort muss sich vom aktuellen unterscheiden.": "The new password must be different from the current one.",
  "Groß-/Kleinbuchstaben und Ziffern verwenden.": "Use uppercase and lowercase letters and digits.",
  "Profilbilder sind Teammitgliedern vorbehalten.": "Profile pictures are reserved for team members.",
  "Das Bild ist zu groß (maximal 300 KB).": "The image is too large (300 KB maximum).",
  "Es wurde kein Bild übermittelt.": "No image was submitted.",
  "Bitte ein PNG-, JPEG- oder WebP-Bild verwenden.": "Please use a PNG, JPEG or WebP image.",

  // --- Newsletter, Kontakt
  "Der Newsletter ist derzeit nicht verfügbar.": "The newsletter is currently unavailable.",
  "Bitte stimme der Verarbeitung deiner Angaben zu.": "Please agree to the processing of your information.",
  "Bitte stimme den Datenschutzhinweisen zu.": "Please agree to the privacy notice.",
  "Bitte stimme dem Erhalt des Newsletters zu.": "Please agree to receive the newsletter.",
  "Bitte beschreibe dein Anliegen (mind. 10 Zeichen).": "Please describe your request (at least 10 characters).",
  "Bitte schreibe eine Antwort.": "Please write a reply.",

  // --- src/lib/validation.ts (Feldmeldungen)
  "Bitte eine gültige E-Mail-Adresse angeben.": "Please enter a valid email address.",
  "Bitte eine gültige Absender-Adresse angeben.": "Please enter a valid sender address.",
  "Bitte eine gültige http(s)-URL angeben.": "Please enter a valid http(s) URL.",
  "Nur Kleinbuchstaben, Ziffern und Bindestriche.": "Lowercase letters, digits and hyphens only.",
  "Ungültiger Link.": "Invalid link.",
  "Server angeben.": "Enter a server.",
  "Ungültiger Servername.": "Invalid server name.",

  // --- src/lib/mailer.ts
  "Es ist kein Mailserver eingerichtet.": "No mail server has been set up.",
  "Anmeldung am Mailserver fehlgeschlagen (Benutzername/Passwort prüfen).": "Sign-in to the mail server failed (check username and password).",
  "Verbindung zum Mailserver abgelehnt (Host/Port prüfen).": "Connection to the mail server was refused (check host and port).",
  "Zeitüberschreitung bzw. Verbindungsfehler (Host, Port und Verschlüsselung prüfen).": "Timeout or connection error (check host, port and encryption).",
  "Mailserver-Adresse nicht gefunden (Host prüfen).": "Mail server address not found (check host).",
  "Absender- oder Empfängeradresse wurde abgelehnt.": "The sender or recipient address was rejected.",
  "Versand fehlgeschlagen.": "Sending failed.",

  // --- Lizenzen: src/lib/licenses.ts, src/lib/validation-licenses.ts, Routen account/{licenses,webspace,business}
  "Dein Konto ist dafür nicht freigeschaltet.": "Your account is not enabled for this.",
  "Dieses Produkt gibt es nicht.": "This product does not exist.",
  "Für dieses Produkt gibt es Schlüssel nur für freigegebene Firmenkunden.": "License keys for this product are only available to approved business customers.",
  "Dieses Produkt ist derzeit nicht verfügbar.": "This product is currently not available.",
  "Für dieses Produkt gibt es Schlüssel nur für Firmenkunden. Du kannst stattdessen ein Konto beantragen.":
    "License keys for this product are only available to business customers. You can request an account instead.",
  "Dein Antrag für dieses Produkt wartet auf Freigabe.": "Your request for this product is awaiting approval.",
  "Dein Schlüssel für dieses Produkt wurde gesperrt. Bitte wende dich an den Support.": "Your key for this product has been revoked. Please contact support.",
  "Du hast für dieses Produkt bereits einen Schlüssel.": "You already have a key for this product.",
  "Für dieses Produkt kann kein Konto beantragt werden.": "You cannot request an account for this product.",
  "Als Firmenkunde beantragst du einen Lizenzschlüssel statt eines Kontos.": "As a business customer, you request a license key instead of an account.",
  "Dein Konto wurde bereits freigegeben.": "Your account has already been approved.",
  "Dein Antrag wartet auf Bearbeitung.": "Your request is awaiting processing.",
  "Dein Konto ist bereits als Firmenkunde freigegeben.": "Your account has already been approved as a business customer.",
  "Dein Antrag als Firmenkunde wartet auf Freigabe.": "Your business customer request is awaiting approval.",
  "Nur wartende Anträge können freigegeben werden.": "Only pending requests can be approved.",
  "Nur wartende Anträge können abgelehnt werden.": "Only pending requests can be rejected.",
  "Nur aktive Schlüssel können gesperrt werden.": "Only active keys can be revoked.",
  "Nur gesperrte Schlüssel können wieder aktiviert werden.": "Only revoked keys can be reactivated.",
  "Dieser Antrag wurde bereits entschieden.": "This request has already been decided.",
  "Produkt angeben.": "Enter a product.",
  "Ungültiges Produkt.": "Invalid product.",
  "Bitte gib den Firmennamen an.": "Please enter the company name.",
  "Ungültiger Nonce.": "Invalid nonce.",
  "3–4 Großbuchstaben.": "3–4 uppercase letters.",
  "Name angeben.": "Enter a name.",

  // --- Zod-Standardtexte (z.locales.de) ohne Parameter
  "Ungültige Eingabe": "Invalid input",
  "Ungültige Eingabe: erwartet true": "Invalid input: expected true",
  "Ungültig: E-Mail-Adresse": "Invalid email address",
  "Ungültig: URL": "Invalid URL",
};

/** Zod-Typnamen der deutschen Locale -> Englisch. */
const ZOD_TYPES: Record<string, string> = {
  Zahl: "number",
  Array: "array",
  int: "integer",
};
const zodType = (t: string) => ZOD_TYPES[t] ?? t;

/** Nomen aus `notFound("…")` bzw. "… nicht gefunden." */
const NOUNS: Record<string, string> = {
  Eintrag: "Entry",
  Beitrag: "Post",
  Kampagne: "Campaign",
  Ticket: "Ticket",
  Dienst: "Service",
  Vorfall: "Incident",
  Benutzer: "User",
  Nutzer: "User",
  Schlüssel: "Key",
  Antrag: "Request",
  Produkt: "Product",
  Konto: "Account",
  Abonnent: "Subscriber",
};

const plural = (n: string, one: string, many: string) => (n === "1" ? one : many);

type Rule = [RegExp, (m: RegExpMatchArray) => string];

/** Muster mit Capture-Gruppen für Meldungen mit eingesetzten Werten. */
const PATTERNS_EN: Rule[] = [
  // src/lib/validation.ts: trimmed(min, max), optText, percent
  [/^Mindestens (\d+) Zeichen\.$/, (m) => `At least ${m[1]} ${plural(m[1]!, "character", "characters")}.`],
  [/^Maximal (\d+) Zeichen\.$/, (m) => `No more than ${m[1]} ${plural(m[1]!, "character", "characters")}.`],
  [/^Mindestens (\d+)\.$/, (m) => `At least ${m[1]}.`],
  [/^Maximal (\d+)\.$/, (m) => `At most ${m[1]}.`],
  // notFound("Beitrag") -> "Beitrag nicht gefunden."
  [/^(.+) nicht gefunden\.$/, (m) => `${NOUNS[m[1]!] ?? m[1]} not found.`],
  // Zod-Standardtexte
  [/^Ungültige Eingabe: erwartet (.+), erhalten (.+)$/, (m) => `Invalid input: expected ${zodType(m[1]!)}, received ${zodType(m[2]!)}`],
  [/^Ungültige Eingabe: erwartet (.+)$/, (m) => `Invalid input: expected ${m[1]}`],
  [/^Ungültige Option: erwartet eine von (.+)$/, (m) => `Invalid option: expected one of ${m[1]}`],
  [/^Zu klein: erwartet, dass string >=(\d+) Zeichen hat$/, (m) => `At least ${m[1]} ${plural(m[1]!, "character", "characters")}.`],
  [/^Zu groß: erwartet, dass string <=(\d+) Zeichen hat$/, (m) => `No more than ${m[1]} ${plural(m[1]!, "character", "characters")}.`],
  [/^Zu klein: erwartet, dass (\w+) >=(\d+) (?:Elemente|Bytes) hat$/, (m) => `At least ${m[2]} ${m[1] === "file" ? "bytes" : "items"} required.`],
  [/^Zu klein: erwartet, dass (\w+) >(\d+) (?:Elemente|Bytes) hat$/, (m) => `More than ${m[2]} ${m[1] === "file" ? "bytes" : "items"} required.`],
  [/^Zu groß: erwartet, dass (\w+) <=(\d+) (?:Elemente|Bytes) hat$/, (m) => `No more than ${m[2]} ${m[1] === "file" ? "bytes" : "items"} allowed.`],
  [/^Zu groß: erwartet, dass (\w+) <(\d+) (?:Elemente|Bytes) hat$/, (m) => `Fewer than ${m[2]} ${m[1] === "file" ? "bytes" : "items"} allowed.`],
  [/^Zu klein: erwartet, dass (\w+) >=(-?[\d.]+) ist$/, (m) => `Must be at least ${m[2]}.`],
  [/^Zu klein: erwartet, dass (\w+) >(-?[\d.]+) ist$/, (m) => `Must be greater than ${m[2]}.`],
  [/^Zu groß: erwartet, dass (\w+) <=(-?[\d.]+) ist$/, (m) => `Must be at most ${m[2]}.`],
  [/^Zu groß: erwartet, dass (\w+) <(-?[\d.]+) ist$/, (m) => `Must be less than ${m[2]}.`],
  [/^Ungültiger String: muss dem Muster (.+) entsprechen$/, () => "Invalid format."],
  [/^Ungültiger String: muss mit "(.*)" beginnen$/, (m) => `Must start with "${m[1]}".`],
  [/^Ungültiger String: muss mit "(.*)" enden$/, (m) => `Must end with "${m[1]}".`],
  [/^Ungültiger String: muss "(.*)" enthalten$/, (m) => `Must contain "${m[1]}".`],
  [/^Ungültig: (.+)$/, (m) => `Invalid ${m[1]}`],
  [/^Ungültige Zahl: muss ein Vielfaches von (.+) sein$/, (m) => `Must be a multiple of ${m[1]}.`],
  [/^Unbekannter Schlüssel: (.+)$/, (m) => `Unrecognized key: ${m[1]}`],
  [/^Unbekannte Schlüssel: (.+)$/, (m) => `Unrecognized keys: ${m[1]}`],
  [/^Ungültiger Schlüssel in (.+)$/, (m) => `Invalid key in ${m[1]}`],
  [/^Ungültiger Wert in (.+)$/, (m) => `Invalid value in ${m[1]}`],
  // src/lib/mailer.ts: "Versand fehlgeschlagen (SMTP 550)."
  [/^Versand fehlgeschlagen \(SMTP (\d+)\)\.$/, (m) => `Sending failed (SMTP ${m[1]}).`],
];

/**
 * Übersetzt eine deutsche API-Meldung in die Sprache der Seite.
 * Deutsch und unbekannte Texte werden unverändert zurückgegeben.
 */
export function translateApiMessage(message: string, locale: Locale): string {
  if (locale !== "en" || !message) return message;
  const exact = EXACT_EN[message];
  if (exact !== undefined) return exact;
  for (const [re, fn] of PATTERNS_EN) {
    const m = message.match(re);
    if (m) return fn(m);
  }
  return message;
}

/** Übersetzt die Werte eines `fields`-Objekts. */
export function translateApiFields(fields: Record<string, string>, locale: Locale): Record<string, string> {
  if (locale !== "en") return fields;
  return Object.fromEntries(Object.entries(fields).map(([k, v]) => [k, typeof v === "string" ? translateApiMessage(v, locale) : v]));
}
