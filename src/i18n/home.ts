import { defineMessages } from "@/i18n";

/** Texte der Startseite (Hero, Werte, Allianz-Teaser, Dienste-Vorschau, Freude an freiwilliger Arbeit, Call-to-Action). */
export const home = defineMessages({
  hero: {
    headingLead: "Wir sind die",
    lead: "Sicherheit muss nichts kosten, nur weil grosse Unternehmen das sagen.",
    body:
      "Wir sind ein nicht gewinnorientierter Verein aus der Schweiz und bauen kostenlose Web-Tools und SaaS-Dienste. " +
      "Dabei setzen wir strikt auf Open Source oder eigene Lösungen, und die Privatsphäre hat Vorrang.",
    ctaServices: "Kostenlose Dienste ansehen",
    ctaPricing: "Unser Angebot",
    teamAlt: "Das Team der VylarisGroup",
  },
  values: {
    eyebrow: "Warum VylarisGroup",
    boardPhotoAlt: "Der Vorstand der VylarisGroup: drei Vorstandsmitglieder",
    boardPhotoCaption: "Der Vorstand der VylarisGroup",
    heading: "In kleinen Schritten zum grossen Ziel.",
    items: [
      {
        title: "Open Source",
        text: "Wir setzen strikt auf Open Source oder eigene Lösungen. Durch die massenhafte Mitarbeit vieler an grossen Open-Source-Projekten sind Fehler fast auszuschliessen.",
      },
      {
        title: "Kostenlos",
        text: "Wir greifen nicht in dein Portemonnaie. Dein Geld ist deins. Und so soll es auch bleiben! All unsere SaaS-Angebote sind für jedermann vollständig kostenlos zugänglich.",
      },
      {
        title: "Kleines Team, grosses Engagement",
        text: "Auch wenn wir ein kleines Team sind, wir packen an! Erlebe die Zukunft von Privatsphäre, nur ohne Paywall.",
      },
    ],
  },
  alliance: {
    eyebrow: "Allianz",
    title: "Hier hat alles angefangen",
    description:
      "Die Schweiz ist der Ursprung der VylarisGroup: Von hier aus ist die Idee gewachsen. Wie wir mit weiteren Standorten und Einheiten zusammenarbeiten, steht auf der Allianz-Seite.",
    handBadge: "Hand in Hand",
    originName: "VylarisGroup Schweiz",
    originRole: (domain: string) => `Ursprungsverein · ${domain}`,
    association: "Verein",
    associationText: (members: number, board: number) => `${members} Mitglieder, davon ${board} im Vorstand`,
    origin: "Ursprung",
    originText:
      "Entstanden aus einem kleinen Homelab und einem Podcast – heute ein offizieller Verein mit eigener Webseite.",
    allianceName: "Die Allianz",
    allianceRole: "Zusammenarbeit der Standorte",
    mission: "Gemeinsame Mission",
    missionText: "Sicherheit und Privatsphäre für alle – ohne Paywall und mit offenem Quellcode.",
    structure: "Aufbau",
    structureText:
      "Wer zur Allianz gehört, wie die Aufgaben verteilt sind und wo du die einzelnen Standorte findest, zeigt dir die Allianz-Seite.",
    more: "Mehr über die Allianz",
  },
  services: {
    eyebrow: "SaaS-Dienste",
    title: "Werkzeuge, die du sofort nutzen kannst",
    description: "All unsere SaaS-Angebote sind für jedermann vollständig kostenlos zugänglich.",
    all: "Alle Dienste ansehen",
    failedTitle: "Dienste sind gerade nicht abrufbar",
    emptyTitle: "Noch keine Dienste veröffentlicht",
    failedText:
      "Die Dienste-Übersicht konnte nicht geladen werden. Bitte versuche es in einem Moment erneut oder prüfe unsere Status-Seite.",
    emptyText: "Sobald die ersten Dienste live sind, findest du sie hier. Schau gerne bald wieder vorbei oder sprich uns an.",
    toStatus: "Zum Status",
    toContact: "Kontakt aufnehmen",
    card: {
      fallbackTagline: "Kostenlos, quelloffen und von uns selbst betrieben.",
      open: "Öffnen",
      newTabOf: (name: string) => `${name} (öffnet in neuem Tab)`,
      source: "Quellcode",
      sourceNewTab: (name: string) => `von ${name} (öffnet in neuem Tab)`,
    },
  },
  volunteer: {
    eyebrow: "Freude an freiwilliger Arbeit",
    heading: "Wir sind nicht gewinnorientiert.",
    paragraphs: [
      "Wir haben die VylarisGroup aus reiner Freude an der Technologie und am Entwickeln und Implementieren von kleinen Systemen gegründet. Egal ob kleiner Anfang oder bereits Grösseres in Planung: Du kannst es schaffen.",
      "Wir haben ursprünglich mit einem kleinen Homelab und einem Podcast gestartet, und jetzt sind wir bei einem offiziellen Verein und einer eigenen Webseite angekommen. Was wir damit sagen wollen: Wenn du dir etwas vornimmst, kannst du es schaffen, so wie wir Vylaris möglich gemacht haben.",
    ],
    aboutLink: "Mehr über uns",
    blogLink: "Lies unseren Blog zu den neusten Updates.",
  },
  cta: {
    headingLead: "Erlebe die Kraft von ",
    headingEm: "Privatsphäre",
    headingTail: ".",
    text: "Schreib uns an, wir beissen nicht! Lies unseren Blog zu den neusten Updates oder sag uns, welches Web-Tool du dir wünschst.",
    contact: "Jetzt Kontakt aufnehmen",
    blog: "Zum Blog",
  },
});
