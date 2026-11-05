import { defineMessages } from "@/i18n";

/** Texte von Blog-Übersicht, Beitragsseite und Karten. Beitragsinhalte kommen aus der Datenbank. */
export const blog = defineMessages({
  meta: {
    title: "Blog & Updates",
    description: (name: string) =>
      `Neuigkeiten, Einblicke und Updates von ${name}: transparent, quelloffen und ohne Werbesprache.`,
    notFound: "Beitrag nicht gefunden",
  },
  hero: {
    eyebrow: "Blog",
    title: "Blog & Updates",
    description: (name: string) =>
      `Was wir bauen, warum wir es so bauen und was sich bei ${name} bewegt – offen erzählt, in kleinen Schritten zum grossen Ziel.`,
  },
  failed: {
    title: "Beiträge sind gerade nicht erreichbar",
    text: "Die Beiträge konnten nicht geladen werden. Bitte versuche es in einem Moment erneut.",
  },
  empty: {
    title: "Noch keine Beiträge veröffentlicht",
    text: "Sobald wir etwas zu erzählen haben, erscheint es hier. Den aktuellen Betriebszustand unserer Dienste findest du in der Zwischenzeit auf der Statusseite.",
    status: "Zum Status",
  },
  more: "Weitere Beiträge",
  card: { latest: "Neuester Beitrag", readMore: "Weiterlesen" },
  post: {
    back: "Zurück zum Blog",
    readingTime: (minutes: number) => `${minutes} Min. Lesezeit`,
    feedbackTitle: "Fragen oder Feedback zu diesem Beitrag?",
    feedbackText: "Schreib uns über das Kontaktformular – wir melden uns so schnell wie möglich.",
    contact: "Kontakt aufnehmen",
  },
});
