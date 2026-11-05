import { defineMessages } from "@/i18n";

/** Texte der Status-Seite (Banner, Meldungen, Infrastruktur, Vorfälle). Status-Beschriftungen selbst stehen in src/i18n/labels.ts. */
export const status = defineMessages({
  meta: {
    title: "System-Status",
    description: (name: string) =>
      `Live-Infrastruktur und System-Status von ${name}: Betriebszustand unserer Infrastruktur und aller Dienste, aktuelle Meldungen und vergangene Vorfälle.`,
  },
  hero: {
    eyebrow: "Live-Infrastruktur",
    titlePre: "Live-Infrastruktur &",
    titleAccent: "System-Status",
    description: "Transparent und ehrlich: So steht es gerade um unsere Infrastruktur und um alle Dienste.",
  },
  failed: {
    title: "Statusdaten momentan nicht abrufbar",
    text: "Die Statusseite konnte ihre Daten nicht laden. Das ist ein Problem auf unserer Seite – bitte versuche es gleich noch einmal. Dringende Anliegen erreichst du über das Kontaktformular.",
    retry: "Erneut versuchen",
    contact: "Kontakt aufnehmen",
  },
  active: {
    title: "Aktuelle Meldungen",
    description: "Laufende Störungen und geplante Wartungen.",
    none: "Aktuell liegen keine Störungen und keine geplanten Wartungen vor.",
  },
  infra: {
    title: "Infrastruktur",
    description: "Server, Netzwerk und Datenbanken, auf denen unsere Dienste laufen.",
    none: "Für die Infrastruktur sind noch keine Komponenten hinterlegt.",
    responseTime: "Antwortzeit:",
  },
  services: {
    title: "Dienste",
    description: "Betriebszustand der Anwendungen aus unserem Portal.",
    none: "Es sind noch keine Dienste veröffentlicht.",
  },
  past: {
    title: "Vergangene Vorfälle",
    description: (days: number) => `Behobene Störungen und Wartungen der letzten ${days} Tage.`,
    none: (days: number) => `In den letzten ${days} Tagen gab es keine Vorfälle.`,
  },
  banner: {
    label: "Gesamtstatus",
    sub: {
      OPERATIONAL: "Alle erfassten Komponenten und Dienste laufen wie vorgesehen.",
      MAINTENANCE: "Für einzelne Komponenten oder Dienste laufen Wartungsarbeiten. Details findest du unten.",
      OUTAGE: "Mindestens eine Komponente oder ein Dienst ist gestört. Wir arbeiten daran – Details findest du unten.",
    } as Record<string, string>,
    asOf: "Stand:",
  },
  uptime: { availability: (label: string) => `Verfügbarkeit ${label}` },
  incident: {
    scheduledFrom: "Geplant ab",
    since: "Seit",
    affects: "Betrifft:",
    affected: "Betraf:",
    duration: "Dauer:",
    lessThanMinute: "weniger als 1 Minute",
    min: (n: number) => `${n} Min.`,
    hoursMin: (h: number, m: number) => (m ? `${h} Std. ${m} Min.` : `${h} Std.`),
    days: (d: number, h: number) => {
      const unit = d === 1 ? "Tag" : "Tage";
      return h ? `${d} ${unit} ${h} Std.` : `${d} ${unit}`;
    },
  },
});
