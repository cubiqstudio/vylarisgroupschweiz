import { defineMessages } from "@/i18n";
import { SITES, type SiteProfile } from "@/lib/sites";

/** Texte der Kontaktseite: Kopf, Formular, Erfolgsansicht und Hinweis-Spalte. */
const operator = SITES.eu.name;

export const contact = defineMessages(
  {
    meta: {
      title: "Kontakt & Ticket-System",
      description:
        "Schreib uns über unser sicheres Kontakt- und Ticket-System: allgemeine Fragen, B2B-Hosting oder vertrauliche Security-Reports – ohne Tracking.",
    },
    hero: {
      eyebrow: "Kontakt",
      title: "Sicheres Kontakt- & Ticket-System",
      description: "Jede Anfrage bekommt eine eindeutige Ticket-ID. Du brauchst dafür kein Konto – und wir setzen dabei keine Tracker ein.",
    },
    form: {
      steps: ["Eingegangen", "In Bearbeitung", "Antwort"],
      /** Hilfetext unter den Kategorien. B2B: auf vylaris.eu die Firma, sonst der Ansprechpartner der Domain. */
      categoryHelp: {
        GENERAL: (s: SiteProfile) => `Fragen, Feedback oder Ideen rund um unsere Dienste und ${s.name}.`,
        B2B_HOSTING: (s: SiteProfile) =>
          s.key === "eu"
            ? "Anfragen zu Webhosting und IT-Services für Unternehmen, betreut von CircleUp-Wilms."
            : `Anfragen zu Webhosting und IT-Services für Unternehmen, Ansprechpartner: ${s.leader.name}.`,
        SECURITY_REPORT: () => "Du hast eine Schwachstelle gefunden? Melde sie vertraulich und verantwortungsvoll an uns.",
      } as Record<string, (s: SiteProfile) => string>,
      categoryTagline: {
        GENERAL: "Fragen & Feedback",
        B2B_HOSTING: "Hosting & IT-Services",
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
      reply: {
        title: "Antwort per E-Mail",
        text: "Wenn möglich, senden wir dir nach dem Absenden eine Bestätigung. Unsere Antwort kommt an die E-Mail-Adresse, die du angibst – schau im Zweifel auch in deinen Spam-Ordner.",
      },
      security: {
        title: "Security-Reports",
        text: "Wir setzen auf verantwortungsvolle Offenlegung: Beschreibe die Schwachstelle sachlich und gib uns Gelegenheit, sie zu beheben, bevor sie öffentlich wird. Bitte sende keine Zugangsdaten, Schlüssel oder andere Geheimnisse im Klartext – ein Hinweis auf die Fundstelle reicht.",
      },
      b2b: {
        title: "B2B-Hosting",
        text: (s: SiteProfile) =>
          s.leader.company
            ? `Anfragen zu Webhosting und IT-Services für Unternehmen betreut ${s.leader.company} unter der Leitung von ${s.leader.name}. Schildere kurz dein Vorhaben – wir melden uns so schnell wie möglich.`
            : `Ansprechpartner für Anfragen zu Webhosting und IT-Services für Unternehmen ist ${s.leader.name}. Hosting und technischer Betrieb aller Seiten liegen zentral bei ${operator}. Schildere kurz dein Vorhaben – wir melden uns so schnell wie möglich.`,
      },
      status: {
        title: "Störung bei einem Dienst?",
        text: "Bevor du ein Ticket öffnest, lohnt ein Blick auf den aktuellen Betriebszustand unserer Dienste.",
        link: "Zur Statusseite",
      },
    },
  },
  {
    meta: {
      title: "Contact & ticket system",
      description:
        "Write to us through our secure contact and ticket system: general questions, B2B hosting or confidential security reports – no tracking.",
    },
    hero: {
      eyebrow: "Contact",
      title: "Secure contact & ticket system",
      description: "Every request gets a unique ticket ID. You don't need an account for it – and we don't use any trackers.",
    },
    form: {
      steps: ["Received", "In progress", "Reply"],
      categoryHelp: {
        GENERAL: (s: SiteProfile) => `Questions, feedback or ideas about our services and ${s.name}.`,
        B2B_HOSTING: (s: SiteProfile) => `Inquiries about web hosting and IT services for businesses. Your contact: ${s.leader.name}.`,
        SECURITY_REPORT: () => "Found a vulnerability? Report it to us confidentially and responsibly.",
      } as Record<string, (s: SiteProfile) => string>,
      categoryTagline: {
        GENERAL: "Questions & feedback",
        B2B_HOSTING: "Hosting & IT services",
        SECURITY_REPORT: "Report confidentially",
      } as Record<string, string>,
      success: {
        badge: "Ticket system",
        headline: "Request received",
        title: "Thanks, your request has reached us.",
        lead: "We'll get back to you as soon as possible. This is your ticket ID:",
        ticketLabel: "Your ticket ID",
        ticketAria: (ticket: string) => `Ticket ID ${ticket}`,
        copy: "Copy",
        copied: "Copied",
        copyFail: "Copying isn't possible – please select the ID and copy it manually.",
        category: "Category",
        subject: "Subject",
        stepsLabel: "What happens next",
        stepDone: " (done)",
        stepNext: " (upcoming)",
        keepStrong: "Keep your ticket ID.",
        keepRest: "It lets us match your request to the right ticket if we have follow-up questions.",
        confirmPre: "If possible, we'll send you a confirmation by email",
        confirmTo: "to",
        confirmPost: ".",
        another: "New request",
      },
      fields: {
        name: "Name",
        email: "Email address",
        subject: "Subject",
        category: "Category",
        message: "Message",
        honeypot: "Website (please leave empty)",
      },
      consentPre: "I agree to my details being processed to handle my request. For more, see the",
      consentLink: "privacy policy",
      consentPost: ".",
      privacyHref: "/privacy",
      submit: "Send request",
      submitting: "Sending …",
      allRequired: "All fields are required.",
      errors: {
        checkFields: "Please check the highlighted fields.",
        tooMany: "You've sent too many requests in a short time. Please try again later.",
        unexpected: "An unexpected error occurred while sending. Please try again.",
        network: "Network error – please check your connection.",
        requestFailed: (status: number) => `Request failed (${status}).`,
      },
    },
    aside: {
      label: "Notes on contacting us",
      privacy: {
        title: "Our privacy promise",
        text: "No trackers and no external scripts in the form. We only store the fields you fill in – and use them to handle your request. You'll find the details in our",
        link: "privacy policy",
        href: "/privacy",
      },
      reply: {
        title: "Reply by email",
        text: "If possible, we'll send you a confirmation after you submit. Our reply goes to the email address you provide – if in doubt, check your spam folder too.",
      },
      security: {
        title: "Security reports",
        text: "We believe in responsible disclosure: describe the vulnerability factually and give us a chance to fix it before it goes public. Please don't send credentials, keys or other secrets in plain text – a pointer to where you found the issue is enough.",
      },
      b2b: {
        title: "B2B hosting",
        text: (s: SiteProfile) =>
          `${s.leader.name} is responsible for ${s.name} and your point of contact for web hosting and IT services inquiries from businesses. Hosting and technical operation of all sites are handled centrally by ${operator}. Briefly describe your project – we'll get back to you as soon as possible.`,
      },
      status: {
        title: "Problem with a service?",
        text: "Before you open a ticket, it's worth checking the current operating status of our services.",
        link: "Go to the status page",
      },
    },
  },
);
