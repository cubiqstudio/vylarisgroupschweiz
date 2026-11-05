import { defineMessages } from "@/i18n";

/** Texte des Cookie-Hinweises und des Einstellungs-Dialogs. Namen der Speicher-Einträge stehen in consent-config.ts. */
export const consent = defineMessages({
  privacyHref: "/datenschutz#cookies",
  privacyLink: "Datenschutzerklärung",
  banner: {
    region: "Hinweis zu Cookies und Datenschutz",
    title: "Cookies & Datenschutz",
    eyebrow: "Ehrlich & transparent",
    body:
      "Wir verwenden nur technisch notwendige Cookies: Ein Sitzungs-Cookie entsteht erst, wenn du dich anmeldest. " +
      "Es gibt keine Tracker, keine Analyse- und keine Marketing-Dienste.",
    factsLabel: "Das gilt bei uns",
    facts: ["Keine Tracker", "Keine Werbung", "Cookie nur nach Login"],
    accept: "Verstanden",
    settings: "Einstellungen",
    moreBefore: "Mehr dazu in der ",
    moreAfter: ".",
  },
  dialog: {
    title: "Cookie-Einstellungen",
    subtitle: "Hier siehst du, was auf dieser Website gespeichert wird.",
    closeLabel: "Dialog schliessen, ohne zu speichern",
    colName: "Name",
    colPurpose: "Zweck",
    colDuration: "Laufzeit",
    alwaysActive: "Immer aktiv",
    allow: "Erlauben",
    noOptional: "Weitere Kategorien (Statistik, Marketing) werden nicht eingesetzt.",
    cookieNote:
      "Es handelt sich um einen HTTP-Cookie (httpOnly, SameSite=Lax, Secure). Er wird erst nach einer erfolgreichen Anmeldung gesetzt.",
    storageTitle: "Deine Auswahl in diesem Browser",
    storageCaption: "Lokaler Speicher dieses Hinweises",
    detailsBefore: "Alle Details findest du in der ",
    detailsAfter: ".",
    cancel: "Abbrechen",
    save: "Speichern",
    categoryCaption: (name: string) => `Cookies der Kategorie ${name}`,
    necessaryCaption: "Cookies der Kategorie Notwendig",
  },
  necessary: {
    name: "Notwendig",
    purpose:
      "Diese Cookies sind für den Betrieb der Website technisch erforderlich. Besucher ohne Anmeldung erhalten keine Cookies – " +
      "der Sitzungs-Cookie wird erst gesetzt, nachdem du dich angemeldet hast.",
    sessionPurpose: "Anmeldung (hält deine Sitzung nach dem Login aufrecht)",
    sessionDuration: "höchstens 14 Tage",
  },
  storage: {
    purpose: "Merkt sich deine Auswahl in diesem Hinweis (lokaler Speicher im Browser, kein Cookie, keine Übertragung an uns)",
    duration: "bis du ihn löschst oder die Auswahl zurücksetzt",
  },
  settingsButton: "Cookie-Einstellungen",
});

export type ConsentMessages = (typeof consent)["de"];
