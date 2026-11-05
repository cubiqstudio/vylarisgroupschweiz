import { defineMessages } from "@/i18n";

/** Texte der Dienste-Seite (Portal, Filter, Karten). */
export const services = defineMessages(
  {
    meta: {
      title: "SaaS & Services Portal",
      description: (name: string) =>
        `Kostenlose, quelloffene Dienste von ${name} – gehostet auf eigener europäischer Infrastruktur, ohne Tracking und ohne Paywall.`,
    },
    hero: {
      eyebrow: "SaaS & Services Portal",
      titlePre: "Dienste, die",
      titleAccent: "dir gehören",
      titlePost: "– nicht dem Datenhändler.",
      description:
        "Unsere Anwendungen laufen auf eigener europäischer Infrastruktur, sind quelloffen und für dich vollständig kostenlos. Hier findest du alle Dienste samt aktuellem Betriebsstatus.",
      free: "Kostenlos",
      openSource: "Open Source",
      noTracking: "Ohne Tracking",
    },
    failed: {
      title: "Die Dienste sind gerade nicht erreichbar",
      text: "Wir konnten die Dienstübersicht nicht laden. Bitte versuche es in einem Moment erneut – den aktuellen Betriebsstatus findest du auf der Status-Seite.",
      retry: "Erneut versuchen",
      status: "Zum System-Status",
    },
    empty: {
      title: "Noch keine Dienste veröffentlicht",
      text: "Sobald unsere ersten Dienste live sind, findest du sie hier – mit Quellcode, Status und direktem Zugang.",
      contact: "Fragen? Schreib uns",
    },
    list: {
      countIn: (n: number, category: string) =>
        `${n} ${n === 1 ? "Dienst" : "Dienste"} in „${category}“`,
      countAll: (n: number) =>
        `${n} ${n === 1 ? "Dienst" : "Dienste"} insgesamt`,
      noneTitle: "Keine Dienste in dieser Kategorie",
      noneText: (category: string) =>
        `Die Kategorie „${category}“ gibt es bei uns nicht (mehr). Setze den Filter zurück, um alle Dienste zu sehen.`,
      reset: "Filter zurücksetzen",
      headingIn: (category: string) => `Dienste in der Kategorie ${category}`,
      headingAll: "Alle Dienste",
    },
    promise: {
      label: "Unser Versprechen",
      title: "Kostenlos. Open Source. Ohne Tracking.",
      text: "Dein Geld bleibt deins: Sicherheit muss nichts kosten, nur weil große Unternehmen das sagen. Der Quellcode ist offen einsehbar, deine Daten bleiben in Europa.",
      status: "Live-Status ansehen",
    },
    filter: { label: "Dienste nach Kategorie filtern", all: "Alle" },
    card: {
      availability: "Verfügbarkeit:",
      open: "Dienst öffnen",
      source: "Quellcode",
      sourceOf: (name: string) => `von ${name} (öffnet in neuem Tab)`,
      newTab: "(öffnet in neuem Tab)",
    },
  },
  {
    meta: {
      title: "SaaS & Services Portal",
      description: (name: string) =>
        `Free, open-source services from ${name}, hosted on our own European infrastructure, with no tracking and no paywall.`,
    },
    hero: {
      eyebrow: "SaaS & Services Portal",
      titlePre: "Services that",
      titleAccent: "belong to you",
      titlePost: "– not to the data broker.",
      description:
        "Our applications run on our own European infrastructure, are open source and completely free for you. Here you'll find all services along with their current operating status.",
      free: "Free",
      openSource: "Open source",
      noTracking: "No tracking",
    },
    failed: {
      title: "The services are currently unavailable",
      text: "We couldn't load the service overview. Please try again in a moment. You can find the current operating status on the status page.",
      retry: "Try again",
      status: "Go to system status",
    },
    empty: {
      title: "No services published yet",
      text: "As soon as our first services are live, you'll find them here, with source code, status and direct access.",
      contact: "Questions? Write to us",
    },
    list: {
      countIn: (n: number, category: string) =>
        `${n} ${n === 1 ? "service" : "services"} in “${category}”`,
      countAll: (n: number) =>
        `${n} ${n === 1 ? "service" : "services"} in total`,
      noneTitle: "No services in this category",
      noneText: (category: string) =>
        `The category “${category}” doesn't exist (anymore). Reset the filter to see all services.`,
      reset: "Reset filter",
      headingIn: (category: string) => `Services in the category ${category}`,
      headingAll: "All services",
    },
    promise: {
      label: "Our promise",
      title: "Free. Open source. No tracking.",
      text: "Your money stays yours: security shouldn't have to cost anything just because big companies say it does. The source code is openly available, and your data stays in Europe.",
      status: "View live status",
    },
    filter: { label: "Filter services by category", all: "All" },
    card: {
      availability: "Availability:",
      open: "Open service",
      source: "Source code",
      sourceOf: (name: string) => `of ${name} (opens in a new tab)`,
      newTab: "(opens in a new tab)",
    },
  },
);
