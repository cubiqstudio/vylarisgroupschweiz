import { defineMessages } from "@/i18n";

/** Texte des Cookie-Hinweises und des Einstellungs-Dialogs. Namen der Speicher-Einträge stehen in consent-config.ts. */
export const consent = defineMessages(
  {
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
      closeLabel: "Dialog schließen, ohne zu speichern",
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
  },
  {
    privacyHref: "/privacy#cookies",
    privacyLink: "privacy policy",
    banner: {
      region: "Notice about cookies and privacy",
      title: "Cookies & Privacy",
      eyebrow: "Honest & transparent",
      body:
        "We only use technically necessary cookies: a session cookie is created only once you sign in. " +
        "There are no trackers, no analytics and no marketing services.",
      factsLabel: "What applies here",
      facts: ["No trackers", "No ads", "Cookie only after login"],
      accept: "Got it",
      settings: "Settings",
      moreBefore: "Learn more in our ",
      moreAfter: ".",
    },
    dialog: {
      title: "Cookie settings",
      subtitle: "Here you can see what is stored on this website.",
      closeLabel: "Close dialog without saving",
      colName: "Name",
      colPurpose: "Purpose",
      colDuration: "Duration",
      alwaysActive: "Always active",
      allow: "Allow",
      noOptional: "No other categories (analytics, marketing) are used.",
      cookieNote:
        "This is an HTTP cookie (httpOnly, SameSite=Lax, Secure). It is only set after a successful sign-in.",
      storageTitle: "Your choice in this browser",
      storageCaption: "Local storage of this notice",
      detailsBefore: "You can find all the details in our ",
      detailsAfter: ".",
      cancel: "Cancel",
      save: "Save",
      categoryCaption: (name: string) => `Cookies in the category ${name}`,
      necessaryCaption: "Cookies in the category Necessary",
    },
    necessary: {
      name: "Necessary",
      purpose:
        "These cookies are technically required to run the website. Visitors who are not signed in receive no cookies – " +
        "the session cookie is only set after you have signed in.",
      sessionPurpose: "Sign-in (keeps your session active after login)",
      sessionDuration: "14 days at most",
    },
    storage: {
      purpose: "Remembers your choice in this notice (local storage in your browser, not a cookie, nothing is sent to us)",
      duration: "until you delete it or reset your choice",
    },
    settingsButton: "Cookie settings",
  },
);

export type ConsentMessages = (typeof consent)["de"];
