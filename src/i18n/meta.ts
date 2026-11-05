import { defineMessages } from "@/i18n";

/** Slogan und Beschreibung für Titel/Meta-Tags (je Marke und Sprache). */
export const siteMeta = defineMessages(
  {
    tagline: "Europäische Privatsphäre. Ohne Paywall.",
    description: (name: string) =>
      `${name} gehört zur VylarisGroup – kostenlose, quelloffene SaaS-Dienste auf eigener, DSGVO-konformer Infrastruktur.`,
    skip: "Zum Inhalt springen",
  },
  {
    tagline: "Privacy first. No paywall.",
    description: (name: string) =>
      `${name} is part of VylarisGroup – free, open-source SaaS services with privacy at their core, running on infrastructure operated by VylarisGroupEurope in the EU.`,
    skip: "Skip to content",
  },
);
