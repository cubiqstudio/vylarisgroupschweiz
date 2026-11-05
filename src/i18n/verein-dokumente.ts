import { defineMessages } from "@/i18n";

/** Texte zu Vereinsdokumenten für Besucher und Mitglieder: Portal «Dokumente» und die öffentliche Seite «Statuten». */
export const vereinDokumente = defineMessages({
  portal: {
    heading: "Dokumente",
    intro: "Statuten, Reglemente, Protokolle und weitere Unterlagen des Vereins. Es gelten die Statuten des Vereins.",
    notActive: "Die Dokumente des Vereins sehen nur aktuelle Mitglieder.",
    searchLabel: "Dokumente durchsuchen",
    searchPlaceholder: "Titel oder Beschreibung",
    searchButton: "Suchen",
    reset: "Zurücksetzen",
    categoriesLabel: "Kategorie wählen",
    allCategories: "Alle",
    emptyTitle: "Noch keine Dokumente",
    emptyText: "Der Verein hat noch keine Dokumente für Mitglieder veröffentlicht.",
    emptyFilteredTitle: "Keine passenden Dokumente",
    emptyFilteredText: "Zu dieser Auswahl gibt es keine Dokumente. Passe die Suche an oder wähle eine andere Kategorie.",
    download: "Herunterladen",
    publicBadge: "Öffentlich",
    version: (n: number) => `Version ${n}`,
    updated: (date: string) => `Aktualisiert am ${date}`,
  },
  statutes: {
    intro: "Die Statuten regeln, wie der Verein aufgebaut ist und wie er arbeitet.",
    download: "Statuten herunterladen",
    updated: (date: string) => `Stand: ${date}`,
    version: (n: number) => `Version ${n}`,
    emptyTitle: "Die Statuten sind noch nicht veröffentlicht",
    emptyText: "Sobald der Verein seine Statuten hier bereitstellt, kannst du sie an dieser Stelle herunterladen. Bei Fragen melde dich gerne über die Kontaktseite.",
    contact: "Zur Kontaktseite",
    otherTitle: "Weitere Fassungen",
    note: "Es gelten die Statuten des Vereins in der jeweils von der Mitgliederversammlung beschlossenen Fassung.",
  },
});
