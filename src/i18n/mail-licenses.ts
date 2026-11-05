import { defineMessages } from "@/i18n";

/**
 * Texte der Lizenz-Mails: Entscheidungen an Nutzer (Sprache und Marke der Registrierungsseite) und Hinweise an das Team.
 * Der Schlüssel selbst steht nie in einer Mail, nur der Hinweis, ihn im Konto anzusehen.
 */
export const mailLicenses = defineMessages(
  {
    productLabel: "Produkt",
    companyLabel: "Firma",
    noteLabel: "Hinweis des Teams",
    footer: (brand: string) =>
      `Du erhältst diese Mail, weil du ein Konto bei ${brand} hast und dort einen Antrag gestellt bzw. einen Schlüssel erhalten hast.`,
    decision: {
      keyApproved: {
        subject: (what: string) =>
          `Dein Lizenzschlüssel ist freigegeben – ${what}`,
        preheader: "Du kannst den Schlüssel jetzt in deinem Konto ansehen.",
        heading: "Dein Lizenzschlüssel ist freigegeben",
        lead: (what: string) =>
          `Gute Nachrichten: Dein Antrag für „${what}“ wurde freigegeben.`,
        extra:
          "Aus Sicherheitsgründen steht der Schlüssel nicht in dieser Mail. Du findest ihn in deinem Konto unter „Lizenzen“.",
        button: "Schlüssel im Konto ansehen",
      },
      keyRejected: {
        subject: (what: string) => `Dein Antrag wurde abgelehnt – ${what}`,
        preheader: "Leider konnten wir deinen Antrag nicht freigeben.",
        heading: "Dein Antrag wurde abgelehnt",
        lead: (what: string) =>
          `Leider konnten wir deinen Antrag für „${what}“ nicht freigeben.`,
        extra: "Bei Fragen melde dich gern über das Kontaktformular bei uns.",
        button: "Zu deinen Lizenzen",
      },
      keyRevoked: {
        subject: (what: string) =>
          `Dein Lizenzschlüssel wurde gesperrt – ${what}`,
        preheader: "Der Schlüssel ist nicht mehr gültig.",
        heading: "Dein Lizenzschlüssel wurde gesperrt",
        lead: (what: string) =>
          `Dein Schlüssel für „${what}“ wurde gesperrt und ist nicht mehr gültig.`,
        extra:
          "Wenn du Fragen dazu hast, melde dich gern über das Kontaktformular bei uns.",
        button: "Zu deinen Lizenzen",
      },
      webspaceApproved: {
        subject: (what: string) => `Dein Konto ist freigegeben – ${what}`,
        preheader: "Dein Antrag wurde freigegeben.",
        heading: "Dein Konto wurde freigegeben",
        lead: (what: string) =>
          `Gute Nachrichten: Dein Antrag auf ein Konto für „${what}“ wurde freigegeben.`,
        extra:
          "Den aktuellen Stand und weitere Hinweise findest du in deinem Konto unter „Lizenzen“.",
        button: "Zu deinen Lizenzen",
      },
      webspaceRejected: {
        subject: (what: string) => `Dein Antrag wurde abgelehnt – ${what}`,
        preheader: "Leider konnten wir deinen Antrag nicht freigeben.",
        heading: "Dein Antrag wurde abgelehnt",
        lead: (what: string) =>
          `Leider konnten wir deinen Antrag auf ein Konto für „${what}“ nicht freigeben.`,
        extra: "Bei Fragen melde dich gern über das Kontaktformular bei uns.",
        button: "Zu deinen Lizenzen",
      },
      businessApproved: {
        subject: () => "Du bist als Firmenkunde freigegeben",
        preheader: "Dein Konto hat jetzt den Status Firmenkunde.",
        heading: "Du bist als Firmenkunde freigegeben",
        lead: (what: string) =>
          what
            ? `Gute Nachrichten: Dein Konto wurde für „${what}“ als Firmenkunde freigegeben.`
            : "Gute Nachrichten: Dein Konto wurde als Firmenkunde freigegeben.",
        extra:
          "Firmenkunden können Lizenzschlüssel für passende Produkte beantragen. Du findest sie in deinem Konto unter „Lizenzen“.",
        button: "Zu deinen Lizenzen",
      },
      businessRejected: {
        subject: () => "Dein Antrag als Firmenkunde wurde abgelehnt",
        preheader: "Leider konnten wir deinen Antrag nicht freigeben.",
        heading: "Dein Antrag als Firmenkunde wurde abgelehnt",
        lead: (what: string) =>
          what
            ? `Leider konnten wir deinen Antrag als Firmenkunde für „${what}“ nicht freigeben.`
            : "Leider konnten wir deinen Antrag als Firmenkunde nicht freigeben.",
        extra: "Bei Fragen melde dich gern über das Kontaktformular bei uns.",
        button: "Zu deinen Lizenzen",
      },
    },
    // Hinweise an das Team sind immer deutsch; der englische Zweig hält nur die Form gleich.
    team: {
      subject: {
        key: (product: string) =>
          `Neuer Schlüssel-Antrag wartet auf Freigabe: ${product}`,
        webspace: (product: string) => `Neuer Konto-Antrag: ${product}`,
        business: (company: string) =>
          company
            ? `Neuer Firmenkunden-Antrag: ${company}`
            : "Neuer Firmenkunden-Antrag",
      },
      heading: {
        key: "Schlüssel-Antrag wartet auf Freigabe",
        webspace: "Neuer Webspace-Konto-Antrag",
        business: "Neuer Firmenkunden-Antrag",
      },
      button: {
        key: "Anträge im Dashboard öffnen",
        webspace: "Anträge im Dashboard öffnen",
        business: "Nutzer im Dashboard öffnen",
      },
      from: "Von",
      site: "Seite",
      messageLabel: "Nachricht",
      footer:
        "Du erhältst diese Hinweise, weil diese Adresse in den Ticket-Einstellungen für neue Tickets hinterlegt ist.",
    },
  },
  {
    productLabel: "Product",
    companyLabel: "Company",
    noteLabel: "Note from the team",
    footer: (brand: string) =>
      `You are receiving this email because you have an account with ${brand} and submitted a request there or received a key.`,
    decision: {
      keyApproved: {
        subject: (what: string) =>
          `Your license key has been approved – ${what}`,
        preheader: "You can now view the key in your account.",
        heading: "Your license key has been approved",
        lead: (what: string) =>
          `Good news: your request for "${what}" has been approved.`,
        extra:
          'For security reasons, the key is not included in this email. You can find it in your account under "Licenses".',
        button: "View key in your account",
      },
      keyRejected: {
        subject: (what: string) => `Your request was declined – ${what}`,
        preheader: "Unfortunately, we couldn't approve your request.",
        heading: "Your request was declined",
        lead: (what: string) =>
          `Unfortunately, we couldn't approve your request for "${what}".`,
        extra:
          "If you have questions, feel free to reach out through the contact form.",
        button: "Go to your licenses",
      },
      keyRevoked: {
        subject: (what: string) =>
          `Your license key has been revoked – ${what}`,
        preheader: "The key is no longer valid.",
        heading: "Your license key has been revoked",
        lead: (what: string) =>
          `Your key for "${what}" has been revoked and is no longer valid.`,
        extra:
          "If you have questions, feel free to reach out through the contact form.",
        button: "Go to your licenses",
      },
      webspaceApproved: {
        subject: (what: string) => `Your account has been approved – ${what}`,
        preheader: "Your request has been approved.",
        heading: "Your account has been approved",
        lead: (what: string) =>
          `Good news: your request for an account for "${what}" has been approved.`,
        extra:
          'You can find the current status and further details in your account under "Licenses".',
        button: "Go to your licenses",
      },
      webspaceRejected: {
        subject: (what: string) => `Your request was declined – ${what}`,
        preheader: "Unfortunately, we couldn't approve your request.",
        heading: "Your request was declined",
        lead: (what: string) =>
          `Unfortunately, we couldn't approve your request for an account for "${what}".`,
        extra:
          "If you have questions, feel free to reach out through the contact form.",
        button: "Go to your licenses",
      },
      businessApproved: {
        subject: () => "You have been approved as a business customer",
        preheader: "Your account now has business customer status.",
        heading: "You have been approved as a business customer",
        lead: (what: string) =>
          what
            ? `Good news: your account has been approved as a business customer for "${what}".`
            : "Good news: your account has been approved as a business customer.",
        extra:
          'Business customers can request license keys for eligible products. You can find them in your account under "Licenses".',
        button: "Go to your licenses",
      },
      businessRejected: {
        subject: () => "Your business customer request was declined",
        preheader: "Unfortunately, we couldn't approve your request.",
        heading: "Your business customer request was declined",
        lead: (what: string) =>
          what
            ? `Unfortunately, we couldn't approve your business customer request for "${what}".`
            : "Unfortunately, we couldn't approve your business customer request.",
        extra:
          "If you have questions, feel free to reach out through the contact form.",
        button: "Go to your licenses",
      },
    },
    team: {
      subject: {
        key: (product: string) =>
          `New key request waiting for approval: ${product}`,
        webspace: (product: string) => `New account request: ${product}`,
        business: (company: string) =>
          company
            ? `New business customer request: ${company}`
            : "New business customer request",
      },
      heading: {
        key: "Key request waiting for approval",
        webspace: "New webspace account request",
        business: "New business customer request",
      },
      button: {
        key: "Open requests in dashboard",
        webspace: "Open requests in dashboard",
        business: "Open users in dashboard",
      },
      from: "From",
      site: "Site",
      messageLabel: "Message",
      footer:
        "You are receiving this notice because this address is set up for new tickets in the ticket settings.",
    },
  },
);
