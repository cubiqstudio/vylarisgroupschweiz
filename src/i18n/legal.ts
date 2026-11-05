import { defineMessages } from "@/i18n";

/**
 * Gemeinsame Texte der Rechtsseiten (Impressum / Legal Notice, Datenschutz / Privacy Policy):
 * Seitenrahmen, Inhaltsverzeichnis und Metadaten. Die eigentlichen Rechtstexte stehen
 * als Fassungen je Sprache in src/components/legal (impressum-*.tsx, datenschutz-*.tsx).
 */
export const legalUi = defineMessages(
  {
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
      description: (name: string) =>
        `Anbieterkennzeichnung nach § 5 DDG für ${name}.`,
    },
    privacy: {
      title: "Datenschutzerklärung",
      canonical: "/datenschutz",
      description: (name: string) =>
        `Datenschutzerklärung von ${name}: welche Daten wir verarbeiten, wozu und welche Rechte du hast.`,
    },
  },
  {
    eyebrow: "Legal",
    toc: {
      label: "Table of contents",
      labelMobile: "Table of contents (mobile)",
      heading: "Contents",
    },
    missingValue: "Information required",
    imprint: {
      title: "Legal Notice",
      canonical: "/imprint",
      description: (name: string) =>
        `Legal notice and contact information for ${name}.`,
    },
    privacy: {
      title: "Privacy Policy",
      canonical: "/privacy",
      description: (name: string) =>
        `Privacy policy of ${name}: which data we process, why, and what rights you have.`,
    },
  },
);
