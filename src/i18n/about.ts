import { defineMessages } from "@/i18n";

/** Texte der Seite «Über uns» (Geschichte, Prozess, Werte, Vorstand, Haltung). */
export const about = defineMessages({
  meta: {
    title: "Über uns",
    description: (name: string) =>
      `Wer hinter ${name} steht: ein nicht gewinnorientierter Verein aus drei Informatik-Lehrlingen im Vorstand, der kostenlose Web-Tools baut.`,
  },
  hero: {
    eyebrow: "Über uns",
    titlePre: "Wir bringen deine",
    titleAccent: "Privatsphäre",
    titlePost: "auf ein neues Niveau!",
    description:
      "Die VylarisGroup ist ein nicht gewinnorientierter Verein aus der Schweiz. Wir mögen klein sein, aber wir sind ein starkes Team.",
  },
  story: {
    eyebrow: "Unsere Geschichte",
    title: "In kleinen Schritten zum grossen Ziel.",
    description: "Vom Homelab über die Vereinsgründung zur eigenen Webseite.",
    step: (n: number) => `Schritt ${n}: `,
    steps: {
      startLabel: "Der Anfang",
      startTitle: "Ein Homelab und ein Podcast",
      startBody:
        "Am Anfang stand kein Businessplan, sondern ein kleines Homelab und ein Podcast, aus reiner Freude an der Technologie und am Entwickeln und Implementieren von kleinen Systemen.",
      foundingLabel: "Die Gründung",
      foundingTitle: "Aus der Idee wird ein Verein",
      foundingBody:
        "Eine Vereinsgründung ist grundsätzlich kostenlos, hat uns aber Nerven und Verstand gekostet: Die Gründungsversammlung war schwierig, weil wir alle andere Jobs und Arbeitszeiten haben. Die Statuten müssen genau zum Verein passen, und eine Vorlage einfach anzupassen ist riskant. Wir haben die Statuten vollständig vollendet, auch wenn da ganz viel Herzblut reinfliessen musste.",
      todayLabel: "Heute",
      todayTitle: "Ein Verein und eine eigene Webseite",
      todayBody: (members: number, board: number) =>
        `Stand September 2026 besteht unser Verein aus insgesamt ${members} Mitgliedern, wovon ${board} im Vorstand tätig sind. Wir bieten kostenlose Web-Tools und SaaS-Dienste an und freuen uns über jede Anfrage.`,
    },
  },
  process: {
    eyebrow: "Wie wir arbeiten",
    title: "Der Prozess bringt uns dem Ziel schnell näher.",
    description: "Von deiner Anfrage bis zum Launch in vier Schritten.",
    steps: [
      {
        title: "Deine Anfrage",
        text: "Du reichst bei uns eine unverbindliche Anfrage für dein Wunsch-Tool ein.",
      },
      {
        title: "Unser Engagement",
        text: "Wir schauen uns deine Anfrage an und arbeiten einen Plan aus, was im Bereich des Möglichen liegt.",
      },
      {
        title: "Gemeinsame Besprechung",
        text: "Wir entscheiden nicht einfach, wir melden uns bei dir mit allen Infos, die benötigt werden.",
      },
      {
        title: "Gemeinsamer Launch",
        text: "Und Tadaa, ist alles aufgesetzt, so wie du es dir gewünscht hast. Ist das nicht toll?",
      },
    ],
    request: "Anfrage stellen",
    pricing: "Zu den Angeboten",
  },
  values: {
    eyebrow: "Unsere Werte",
    title: "Woran du uns messen kannst",
    description: "Sie gelten für jeden Dienst und jede Entscheidung.",
    items: [
      {
        title: "Customer-First Mentalität",
        text: "Bei uns sind Kunden wie Freunde. Gemeinsam bauen wir eine starke Community.",
      },
      {
        title: "Freude? Klar doch.",
        text: "Bei uns sollen sich alle wohlfühlen.",
      },
      {
        title: "Privatsphäre hat Vorrang.",
        text: "Sicherheit geht vor. Das gilt nicht nur im Strassenverkehr. Auch in der digitalen Welt ist nicht jeder gleich dein Freund. Sei lieber einmal zu skeptisch.",
      },
      {
        title: "Mit Vollgas Voraus.",
        text: "Erlebe die Kraft der Innovation.",
      },
    ],
  },
  board: {
    eyebrow: "Vorstand",
    title: "Die Menschen hinter der VylarisGroup",
    description:
      "Drei Informatik-Lehrlinge, zwei in der Plattformentwicklung und einer in der Applikationsentwicklung, bilden den Vorstand der VylarisGroup.",
    initialsOf: (name: string) => `Initialen von ${name}`,
    training: "i. A. = in Ausbildung",
    members: (members: number, board: number) => `Der Verein hat ${members} Mitglieder, davon ${board} im Vorstand.`,
  },
  funding: {
    eyebrow: "Haltung",
    title: "Warum ist das kostenlos?",
    description:
      "Weil wir überzeugt sind, dass Sicherheit und Privatsphäre nicht davon abhängen sollten, was du dir leisten kannst. Drei Gedanken dahinter:",
    principles: [
      {
        title: "Kostenlos bleibt kostenlos",
        body: "Wir greifen nicht in dein Portemonnaie. Dein Geld ist deins, und so soll es auch bleiben! All unsere SaaS-Angebote sind für jedermann vollständig kostenlos zugänglich.",
      },
      {
        title: "Ein Verein, keine Firma",
        body: "Wir sind nicht gewinnorientiert. Die VylarisGroup ist aus reiner Freude an der Technologie entstanden, und genauso läuft die freiwillige Arbeit im Verein bis heute.",
      },
      {
        title: "Grösseres auf Anfrage",
        body: "Du hast etwas Grösseres im Sinn, was eventuell einen eigenen Server erfordert? Auch hier helfen wir gerne. Schau bei unseren Angeboten vorbei oder sprich uns direkt an.",
      },
    ],
    cta: "Zu den Angeboten",
  },
  cta: {
    titlePre: "Schreib uns an,",
    titleAccent: "wir beissen nicht",
    titlePost: "!",
    description:
      "Probiere unsere kostenlosen Dienste aus, stell uns eine Anfrage für dein Wunsch-Tool oder lies im Blog, was es Neues gibt.",
    services: "Dienste entdecken",
    contact: "Kontakt aufnehmen",
  },
});
