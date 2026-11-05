import { defineMessages } from "@/i18n";

/** Texte der Dienste-Seite (Portal, Filter, Karten). */
export const services = defineMessages({
  meta: {
    title: "SaaS- und Dienste-Portal",
    description: (name: string) =>
      `Kostenlose Dienste von ${name}: strikt auf Open Source oder eigene Lösungen gebaut, ohne Paywall.`,
  },
  hero: {
    eyebrow: "SaaS- und Dienste-Portal",
    titlePre: "Dienste, die",
    titleAccent: "dir gehören",
    titlePost: "– nicht dem Datenhändler.",
    description:
      "Unsere Anwendungen setzen auf Open Source oder eigene Lösungen und sind für jedermann vollständig kostenlos zugänglich. Hier findest du alle Dienste samt aktuellem Betriebsstatus.",
    free: "Kostenlos",
    openSource: "Open Source",
    privacy: "Privatsphäre zuerst",
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
      `${n} ${n === 1 ? "Dienst" : "Dienste"} in «${category}»`,
    countAll: (n: number) =>
      `${n} ${n === 1 ? "Dienst" : "Dienste"} insgesamt`,
    noneTitle: "Keine Dienste in dieser Kategorie",
    noneText: (category: string) =>
      `Die Kategorie «${category}» gibt es bei uns nicht (mehr). Setze den Filter zurück, um alle Dienste zu sehen.`,
    reset: "Filter zurücksetzen",
    headingIn: (category: string) => `Dienste in der Kategorie ${category}`,
    headingAll: "Alle Dienste",
  },
  promise: {
    label: "Unser Versprechen",
    title: "Kostenlos. Open Source. Privatsphäre zuerst.",
    text: "Dein Geld bleibt deins: Sicherheit muss nichts kosten, nur weil grosse Unternehmen das sagen. Wir setzen strikt auf Open Source oder eigene Lösungen.",
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
});
