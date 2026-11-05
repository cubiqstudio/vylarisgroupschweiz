import { defineMessages } from "@/i18n";

/** Texte der Status-Seite (Banner, Meldungen, Infrastruktur, Vorfälle). Status-Beschriftungen selbst stehen in src/i18n/labels.ts. */
export const status = defineMessages(
  {
    meta: {
      title: "System-Status",
      description: (name: string) =>
        `Live-Infrastruktur und System-Status von ${name}: Betriebszustand unserer europäischen Infrastruktur und aller SaaS-Dienste, aktuelle Meldungen und vergangene Vorfälle.`,
    },
    hero: {
      eyebrow: "Live-Infrastruktur",
      titlePre: "Live-Infrastruktur &",
      titleAccent: "System-Status",
      description:
        "Transparent und ehrlich: So steht es gerade um unsere europäische Infrastruktur und um alle SaaS-Dienste.",
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
      title: "Europäische Infrastruktur",
      description:
        "Server, Netzwerk und Datenbanken, auf denen unsere Dienste laufen.",
      none: "Für die Infrastruktur sind noch keine Komponenten hinterlegt.",
      responseTime: "Antwortzeit:",
    },
    services: {
      title: "SaaS-Dienste",
      description: "Betriebszustand der Anwendungen aus unserem Portal.",
      none: "Es sind noch keine Dienste veröffentlicht.",
    },
    past: {
      title: "Vergangene Vorfälle",
      description: (days: number) =>
        `Behobene Störungen und Wartungen der letzten ${days} Tage.`,
      none: (days: number) =>
        `In den letzten ${days} Tagen gab es keine Vorfälle.`,
    },
    banner: {
      label: "Gesamtstatus",
      sub: {
        OPERATIONAL:
          "Alle erfassten Komponenten und Dienste laufen wie vorgesehen.",
        MAINTENANCE:
          "Für einzelne Komponenten oder Dienste laufen Wartungsarbeiten. Details findest du unten.",
        OUTAGE:
          "Mindestens eine Komponente oder ein Dienst ist gestört. Wir arbeiten daran – Details findest du unten.",
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
      hoursMin: (h: number, m: number) =>
        m ? `${h} Std. ${m} Min.` : `${h} Std.`,
      days: (d: number, h: number) => {
        const unit = d === 1 ? "Tag" : "Tage";
        return h ? `${d} ${unit} ${h} Std.` : `${d} ${unit}`;
      },
    },
  },
  {
    meta: {
      title: "System status",
      description: (name: string) =>
        `Live infrastructure and system status of ${name}: operating state of our European infrastructure and all SaaS services, current notices and past incidents.`,
    },
    hero: {
      eyebrow: "Live infrastructure",
      titlePre: "Live infrastructure &",
      titleAccent: "system status",
      description:
        "Transparent and honest: this is how our European infrastructure and all SaaS services are doing right now.",
    },
    failed: {
      title: "Status data currently unavailable",
      text: "The status page couldn't load its data. This is a problem on our end. Please try again shortly. For urgent matters, use the contact form.",
      retry: "Try again",
      contact: "Get in touch",
    },
    active: {
      title: "Current notices",
      description: "Ongoing outages and scheduled maintenance.",
      none: "There are currently no outages and no scheduled maintenance.",
    },
    infra: {
      title: "European infrastructure",
      description: "Servers, network and databases our services run on.",
      none: "No infrastructure components have been added yet.",
      responseTime: "Response time:",
    },
    services: {
      title: "SaaS services",
      description: "Operating state of the applications in our portal.",
      none: "No services have been published yet.",
    },
    past: {
      title: "Past incidents",
      description: (days: number) =>
        `Resolved outages and maintenance from the last ${days} days.`,
      none: (days: number) =>
        `There were no incidents in the last ${days} days.`,
    },
    banner: {
      label: "Overall status",
      sub: {
        OPERATIONAL:
          "All tracked components and services are running as intended.",
        MAINTENANCE:
          "Maintenance is underway for individual components or services. You'll find details below.",
        OUTAGE:
          "At least one component or service is down. We're working on it. You'll find details below.",
      } as Record<string, string>,
      asOf: "As of:",
    },
    uptime: { availability: (label: string) => `Availability ${label}` },
    incident: {
      scheduledFrom: "Scheduled from",
      since: "Since",
      affects: "Affects:",
      affected: "Affected:",
      duration: "Duration:",
      lessThanMinute: "less than 1 minute",
      min: (n: number) => `${n} min`,
      hoursMin: (h: number, m: number) => (m ? `${h} hr ${m} min` : `${h} hr`),
      days: (d: number, h: number) => {
        const unit = d === 1 ? "day" : "days";
        return h ? `${d} ${unit} ${h} hr` : `${d} ${unit}`;
      },
    },
  },
);
