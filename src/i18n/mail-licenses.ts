import { defineMessages } from "@/i18n";

/**
 * Texte der Lizenz-Mails: Entscheidungen an Nutzer und Hinweise an das Team.
 * Der Schlüssel selbst steht nie in einer Mail, nur der Hinweis, ihn im Konto anzusehen.
 */
export const mailLicenses = defineMessages({
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
        `Gute Nachrichten: Dein Antrag für «${what}» wurde freigegeben.`,
      extra:
        "Aus Sicherheitsgründen steht der Schlüssel nicht in dieser Mail. Du findest ihn in deinem Konto unter «Lizenzen».",
      button: "Schlüssel im Konto ansehen",
    },
    keyRejected: {
      subject: (what: string) => `Dein Antrag wurde abgelehnt – ${what}`,
      preheader: "Leider konnten wir deinen Antrag nicht freigeben.",
      heading: "Dein Antrag wurde abgelehnt",
      lead: (what: string) =>
        `Leider konnten wir deinen Antrag für «${what}» nicht freigeben.`,
      extra: "Bei Fragen melde dich gern über das Kontaktformular bei uns.",
      button: "Zu deinen Lizenzen",
    },
    keyRevoked: {
      subject: (what: string) =>
        `Dein Lizenzschlüssel wurde gesperrt – ${what}`,
      preheader: "Der Schlüssel ist nicht mehr gültig.",
      heading: "Dein Lizenzschlüssel wurde gesperrt",
      lead: (what: string) =>
        `Dein Schlüssel für «${what}» wurde gesperrt und ist nicht mehr gültig.`,
      extra:
        "Wenn du Fragen dazu hast, melde dich gern über das Kontaktformular bei uns.",
      button: "Zu deinen Lizenzen",
    },
    webspaceApproved: {
      subject: (what: string) => `Dein Konto ist freigegeben – ${what}`,
      preheader: "Dein Antrag wurde freigegeben.",
      heading: "Dein Konto wurde freigegeben",
      lead: (what: string) =>
        `Gute Nachrichten: Dein Antrag auf ein Konto für «${what}» wurde freigegeben.`,
      extra:
        "Den aktuellen Stand und weitere Hinweise findest du in deinem Konto unter «Lizenzen».",
      button: "Zu deinen Lizenzen",
    },
    webspaceRejected: {
      subject: (what: string) => `Dein Antrag wurde abgelehnt – ${what}`,
      preheader: "Leider konnten wir deinen Antrag nicht freigeben.",
      heading: "Dein Antrag wurde abgelehnt",
      lead: (what: string) =>
        `Leider konnten wir deinen Antrag auf ein Konto für «${what}» nicht freigeben.`,
      extra: "Bei Fragen melde dich gern über das Kontaktformular bei uns.",
      button: "Zu deinen Lizenzen",
    },
    businessApproved: {
      subject: () => "Du bist als Firmenkunde freigegeben",
      preheader: "Dein Konto hat jetzt den Status Firmenkunde.",
      heading: "Du bist als Firmenkunde freigegeben",
      lead: (what: string) =>
        what
          ? `Gute Nachrichten: Dein Konto wurde für «${what}» als Firmenkunde freigegeben.`
          : "Gute Nachrichten: Dein Konto wurde als Firmenkunde freigegeben.",
      extra:
        "Firmenkunden können Lizenzschlüssel für passende Produkte beantragen. Du findest sie in deinem Konto unter «Lizenzen».",
      button: "Zu deinen Lizenzen",
    },
    businessRejected: {
      subject: () => "Dein Antrag als Firmenkunde wurde abgelehnt",
      preheader: "Leider konnten wir deinen Antrag nicht freigeben.",
      heading: "Dein Antrag als Firmenkunde wurde abgelehnt",
      lead: (what: string) =>
        what
          ? `Leider konnten wir deinen Antrag als Firmenkunde für «${what}» nicht freigeben.`
          : "Leider konnten wir deinen Antrag als Firmenkunde nicht freigeben.",
      extra: "Bei Fragen melde dich gern über das Kontaktformular bei uns.",
      button: "Zu deinen Lizenzen",
    },
  },
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
});
