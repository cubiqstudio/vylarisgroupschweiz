import { defineMessages } from "@/i18n";

/** Texte von Blog-Übersicht, Beitragsseite und Karten. Beitragsinhalte kommen aus der DB (titleEn/excerptEn/contentEn). */
export const blog = defineMessages(
  {
    meta: {
      title: "Blog & Updates",
      description: (name: string) =>
        `Neuigkeiten, Einblicke und Updates von ${name} – transparent, quelloffen und ohne Werbesprache.`,
      notFound: "Beitrag nicht gefunden",
    },
    hero: {
      eyebrow: "Blog",
      title: "Blog & Updates",
      description: (name: string) =>
        `Was wir bauen, warum wir es so bauen und was sich bei ${name} bewegt – offen erzählt, ohne Marketing-Nebel.`,
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
      feedbackText:
        "Schreib uns über das Kontaktformular – wir melden uns so schnell wie möglich.",
      contact: "Kontakt aufnehmen",
    },
  },
  {
    meta: {
      title: "Blog & Updates",
      description: (name: string) =>
        `News, insights and updates from ${name}: transparent, open source and free of marketing speak.`,
      notFound: "Post not found",
    },
    hero: {
      eyebrow: "Blog",
      title: "Blog & Updates",
      description: (name: string) =>
        `What we build, why we build it that way and what's moving at ${name}, told openly and without the marketing fog.`,
    },
    failed: {
      title: "Posts are currently unavailable",
      text: "The posts couldn't be loaded. Please try again in a moment.",
    },
    empty: {
      title: "No posts published yet",
      text: "As soon as we have something to tell, it will show up here. In the meantime, you can find the current operating state of our services on the status page.",
      status: "Go to status",
    },
    more: "More posts",
    card: { latest: "Latest post", readMore: "Read more" },
    post: {
      back: "Back to blog",
      readingTime: (minutes: number) => `${minutes} min read`,
      feedbackTitle: "Questions or feedback about this post?",
      feedbackText:
        "Write to us through the contact form and we'll get back to you as soon as we can.",
      contact: "Get in touch",
    },
  },
);
