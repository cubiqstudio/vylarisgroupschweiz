import { defineMessages } from "@/i18n";
import type { SiteProfile } from "@/lib/sites";

/** Texte der Kontaktseite: Kopf, Formular, Erfolgsansicht und Hinweis-Spalte. */
export const contact = defineMessages({
  meta: {
    title: "Kontakt & Ticket-System",
    description:
      "Schreib uns über unser Kontakt- und Ticket-System: allgemeine Fragen, Mitgliedschaft, individuelle Web-Tools oder vertrauliche Security-Reports – ohne Tracking.",
  },
  hero: {
    eyebrow: "Kontakt",
    title: "Sicheres Kontakt- & Ticket-System",
    description: "Jede Anfrage bekommt eine eindeutige Ticket-ID. Du brauchst dafür kein Konto – und wir setzen dabei keine Tracker ein.",
  },
  form: {
    steps: ["Eingegangen", "In Bearbeitung", "Antwort"],
    /** Hilfetext unter den Kategorien. Unbekannte Kategorien bekommen keinen Hilfetext. */
    categoryHelp: {
      GENERAL: (s: SiteProfile) => `Fragen, Feedback oder Ideen rund um unsere Dienste und ${s.name}.`,
      MEMBERSHIP: () => "Fragen zur Mitgliedschaft im Verein oder dazu, wie du uns beitreten kannst.",
      BILLING: () => "Fragen zu Mitgliederbeiträgen, Rechnungen oder Zahlungen.",
      B2B_HOSTING: () =>
        "Anfragen zu individuellen Web-Tools, Hosting und IT-Services für Organisationen und Unternehmen. Wir schauen uns an, was im Bereich des Möglichen liegt.",
      SECURITY_REPORT: () => "Du hast eine Schwachstelle gefunden? Melde sie vertraulich und verantwortungsvoll an uns.",
    } as Record<string, (s: SiteProfile) => string>,
    categoryTagline: {
      GENERAL: "Fragen & Feedback",
      MEMBERSHIP: "Verein & Beitritt",
      BILLING: "Beitrag & Rechnung",
      B2B_HOSTING: "Web-Tools & Hosting",
      SECURITY_REPORT: "Vertraulich melden",
    } as Record<string, string>,
    success: {
      badge: "Ticket-System",
      headline: "Anfrage eingegangen",
      title: "Danke, deine Anfrage ist bei uns angekommen.",
      lead: "Wir melden uns so schnell wie möglich. Das ist deine Ticket-ID:",
      ticketLabel: "Deine Ticket-ID",
      ticketAria: (ticket: string) => `Ticket-ID ${ticket}`,
      copy: "Kopieren",
      copied: "Kopiert",
      copyFail: "Kopieren nicht möglich – bitte markiere die ID und kopiere sie manuell.",
      category: "Kategorie",
      subject: "Betreff",
      stepsLabel: "So geht es weiter",
      stepDone: " (erledigt)",
      stepNext: " (folgt)",
      keepStrong: "Bewahre die Ticket-ID auf.",
      keepRest: "Mit ihr können wir dein Anliegen bei Rückfragen eindeutig zuordnen.",
      confirmPre: "Wenn möglich, senden wir dir eine Bestätigung per E-Mail",
      confirmTo: "an",
      confirmPost: ".",
      another: "Weitere Anfrage",
    },
    fields: {
      name: "Name",
      email: "E-Mail-Adresse",
      subject: "Betreff",
      category: "Kategorie",
      message: "Nachricht",
      honeypot: "Website (bitte leer lassen)",
    },
    consentPre: "Ich stimme zu, dass meine Angaben zur Bearbeitung meiner Anfrage verarbeitet werden. Mehr dazu in der",
    consentLink: "Datenschutzerklärung",
    consentPost: ".",
    privacyHref: "/datenschutz",
    submit: "Anfrage senden",
    submitting: "Wird gesendet …",
    allRequired: "Alle Felder sind Pflichtfelder.",
    errors: {
      checkFields: "Bitte prüfe die markierten Felder.",
      tooMany: "Du hast in kurzer Zeit zu viele Anfragen gesendet. Bitte versuche es später noch einmal.",
      unexpected: "Beim Senden ist ein unerwarteter Fehler aufgetreten. Bitte versuche es erneut.",
      network: "Netzwerkfehler – bitte Verbindung prüfen.",
      requestFailed: (status: number) => `Anfrage fehlgeschlagen (${status}).`,
    },
  },
  aside: {
    label: "Hinweise zum Kontakt",
    privacy: {
      title: "Unser Datenschutz-Versprechen",
      text: "Keine Tracker und keine externen Skripte im Formular. Wir speichern nur die Felder, die du ausfüllst – und nutzen sie zur Bearbeitung deiner Anfrage. Details stehen in der",
      link: "Datenschutzerklärung",
      href: "/datenschutz",
    },
    channels: {
      title: "Weitere Kontaktwege",
      text: "Du erreichst uns auch direkt. Schreib uns an, wir beissen nicht!",
      whatsapp: "WhatsApp",
      whatsappAria: "Nachricht per WhatsApp schreiben (öffnet WhatsApp)",
      email: "E-Mail",
      discord: "Discord",
      discordAria: "Unserem Discord-Server beitreten (öffnet Discord)",
    },
    reply: {
      title: "Antwort per E-Mail",
      text: "Wenn möglich, senden wir dir nach dem Absenden eine Bestätigung. Unsere Antwort kommt an die E-Mail-Adresse, die du angibst – schau im Zweifel auch in deinen Spam-Ordner.",
    },
    security: {
      title: "Security-Reports",
      text: "Wir setzen auf verantwortungsvolle Offenlegung: Beschreibe die Schwachstelle sachlich und gib uns Gelegenheit, sie zu beheben, bevor sie öffentlich wird. Bitte sende keine Zugangsdaten, Schlüssel oder andere Geheimnisse im Klartext – ein Hinweis auf die Fundstelle reicht.",
    },
    custom: {
      title: "Individuelle Web-Tools",
      text: "Du hast etwas Grösseres im Sinn, das eventuell einen eigenen Server erfordert? Schildere kurz dein Vorhaben. Wir arbeiten einen Plan aus, was im Bereich des Möglichen liegt, und melden uns mit allen Infos, die du brauchst.",
    },
    status: {
      title: "Störung bei einem Dienst?",
      text: "Bevor du ein Ticket öffnest, lohnt ein Blick auf den aktuellen Betriebszustand unserer Dienste.",
      link: "Zur Statusseite",
    },
  },
});
