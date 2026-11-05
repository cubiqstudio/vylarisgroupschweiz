import { defineMessages } from "@/i18n";

/** Texte der Seite «Preise» (Angebote: kleines und individuelles Web-Tool). */
export const pricing = defineMessages({
  meta: {
    title: "Preise",
    description: (name: string) =>
      `Die Angebote von ${name}: ein kleines Web-Tool kostenlos, ein individuelles Web-Tool auf Anfrage.`,
  },
  hero: {
    eyebrow: "Preise",
    titlePre: "Anstelle von Problemen produzieren wir",
    titleAccent: "Möglichkeiten",
    titlePost: ".",
    description: "Erlebe uns aus erster Hand. Sag uns einfach, was du brauchst, und wir schauen uns das an.",
  },
  plans: {
    label: "Unsere Angebote",
    included: "Enthalten",
    items: [
      {
        name: "Kleines Web-Tool",
        price: "Kostenlos",
        text: "Sag uns einfach, was du brauchst und wir schauen uns das an.",
        features: [
          "Kontakt per Mail oder Discord",
          "Ein PHP-Web-Tool",
          "Zugriff zur eigenständigen Bearbeitung",
          "Ganz viel Spass",
        ],
        cta: "Kostenlos anfragen",
        featured: true,
      },
      {
        name: "Individuelles Web-Tool",
        price: "Auf Anfrage",
        text: "Du hast etwas Grösseres im Sinn, was eventuell einen eigenen Server erfordert? Auch hier helfen wir gerne!",
        features: [
          "Alles aus dem kleineren Paket",
          "Kontakt per Telefon (Schweiz)",
          "Stress – war nur ein Scherz",
          "Individuelles Tool",
        ],
        cta: "Anfrage stellen",
        featured: false,
      },
    ],
  },
  process: {
    eyebrow: "So geht es weiter",
    title: "Von der Anfrage zum Launch in vier Schritten",
    text: "Du reichst eine unverbindliche Anfrage ein, wir arbeiten einen Plan aus, besprechen ihn gemeinsam mit dir und setzen alles so auf, wie du es dir gewünscht hast.",
    link: "Den Ablauf ansehen",
  },
  aside: {
    label: "Kontakt",
    title: "Schreib uns an, wir beissen nicht!",
    text: "Per Mail, über das Kontaktformular oder direkt auf Discord: Wir freuen uns auf deine Idee.",
    contact: "Kontakt aufnehmen",
    discord: "Discord",
    discordNewTab: "(öffnet in neuem Tab)",
  },
});
