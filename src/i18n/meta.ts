import { defineMessages } from "@/i18n";

/** Slogan und Beschreibung für Titel und Meta-Tags. */
export const siteMeta = defineMessages({
  tagline: "Sicherheit muss nichts kosten.",
  description: (name: string) =>
    `${name} ist ein nicht gewinnorientierter Verein aus der Schweiz: kostenlose Web-Tools und SaaS-Dienste, strikt auf Open Source oder eigene Lösungen gebaut, mit Privatsphäre als Grundsatz.`,
  skip: "Zum Inhalt springen",
});
