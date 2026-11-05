import { defineMessages } from "@/i18n";

/** Texte der Vereinsbereiche, die Besucher und Mitglieder sehen: Mitgliederportal, «Mitglied werden», Anlässe, Statuten. Verwaltungstexte stehen direkt in den Admin-Komponenten. */
export const verein = defineMessages({
  portal: {
    tabLabel: "Verein",
    tabsLabel: "Vereinsbereiche",
    tabs: {
      overview: "Übersicht",
      membership: "Mitgliedschaft",
      fees: "Beiträge",
      events: "Anlässe",
      meetings: "Versammlungen",
      documents: "Dokumente",
    },
    tile: {
      title: "Verein",
      text: "Mitgliedschaft, Beiträge, Anlässe und Dokumente des Vereins.",
    },
    meta: {
      overview: "Verein",
      membership: "Mitgliedschaft",
      fees: "Beiträge",
      events: "Anlässe",
      meetings: "Versammlungen",
      documents: "Dokumente",
    },
  },
  inProgress: {
    badge: "In Arbeit",
    title: "In Arbeit",
    text: "Dieser Bereich wird gerade aufgebaut und ist bald verfügbar.",
    back: "Zurück zur Übersicht",
  },
  public: {
    join: {
      metaTitle: "Mitglied werden",
      metaDescription: "Werde Mitglied im Verein und unterstütze unsere nicht gewinnorientierte Arbeit.",
      eyebrow: "Verein",
      heading: "Mitglied werden",
    },
    events: {
      metaTitle: "Anlässe",
      metaDescription: "Anlässe und Veranstaltungen des Vereins.",
      eyebrow: "Verein",
      heading: "Anlässe",
    },
    statutes: {
      metaTitle: "Statuten",
      metaDescription: "Die Statuten des Vereins.",
      eyebrow: "Verein",
      heading: "Statuten",
    },
  },
  notice: {
    // Sachlicher Hinweis zu Voreinstellungen aus dem Gesetz; keine Rechtsberatung
    statutesFirst: "Es gelten die Statuten des Vereins. Die Voreinstellungen entsprechen dem Gesetz (ZGB) und sind gemäss Statuten anzupassen.",
  },
});
