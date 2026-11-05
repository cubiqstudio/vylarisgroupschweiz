import { defineMessages } from "@/i18n";

/**
 * Gemeinsame Texte der Rechtsseiten (Impressum, Datenschutzerklärung): Seitenrahmen, Inhaltsverzeichnis und Metadaten.
 * Die eigentlichen Rechtstexte stehen als Fassung je Sprache in src/components/legal (impressum.tsx, datenschutz.tsx);
 * kommt eine Sprache hinzu, braucht sie dort eine eigene Fassung.
 */
export const legalUi = defineMessages({
  eyebrow: "Rechtliches",
  toc: {
    label: "Inhaltsverzeichnis",
    labelMobile: "Inhaltsverzeichnis (mobil)",
    heading: "Inhalt",
  },
  missingValue: "Angabe ergänzen",
  imprint: {
    title: "Impressum",
    canonical: "/impressum",
    description: (name: string) => `Angaben zum Verein und Kontaktmöglichkeiten von ${name}.`,
    /** Wenn alle Elemente im Admin abgeschaltet sind */
    empty: "Zurzeit sind hier keine Angaben veröffentlicht.",
  },
  privacy: {
    title: "Datenschutzerklärung",
    canonical: "/datenschutz",
    description: (name: string) =>
      `Datenschutzerklärung von ${name}: welche Daten wir bearbeiten, wozu und welche Rechte du hast.`,
    standLabel: (date: string) => `Stand: ${date}`,
  },
});
