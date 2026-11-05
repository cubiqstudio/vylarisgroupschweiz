/** Hilfsfunktionen für Blog-Beiträge (reine Funktionen, serverseitig und clientseitig nutzbar). */
import { hasEnglish, localized, type Locale } from "@/i18n";

export type PostListItem = {
  id: string;
  title: string;
  slug: string;
  excerpt: string;
  author: string;
  date: Date;
};

/** Felder, die Listen und Karten aus der DB brauchen (contentEn nur, um englische Beiträge zu erkennen). */
export const POST_LIST_SELECT = {
  id: true,
  title: true,
  titleEn: true,
  slug: true,
  excerpt: true,
  excerptEn: true,
  contentEn: true,
  author: true,
  publishedAt: true,
  createdAt: true,
} as const;

/** Geschätzte Lesezeit in Minuten (ca. 200 Wörter pro Minute, mindestens 1). */
export function readingMinutes(markdown: string): number {
  const words = markdown
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/[#>*_`~\[\]()!|-]+/g, " ")
    .split(/\s+/)
    .filter(Boolean).length;
  return Math.max(1, Math.round(words / 200));
}

type PostRow = {
  id: string;
  title: string;
  titleEn: string | null;
  slug: string;
  excerpt: string;
  excerptEn: string | null;
  contentEn: string | null;
  author: string;
  publishedAt: Date | null;
  createdAt: Date;
};

/**
 * Sortiert absteigend nach Veröffentlichungsdatum (Fallback: Erstellungsdatum).
 * Auf der englischen Seite erscheinen nur Beiträge mit englischem Inhalt (contentEn); Titel und Auszug in der Sprache der Seite.
 */
export function toListItems(rows: PostRow[], locale: Locale): PostListItem[] {
  return rows
    .filter((r) => locale !== "en" || hasEnglish(r, "content"))
    .map((r) => ({
      id: r.id,
      title: localized(r, "title", locale),
      slug: r.slug,
      excerpt: localized(r, "excerpt", locale),
      author: r.author,
      date: r.publishedAt ?? r.createdAt,
    }))
    .sort((a, b) => b.date.getTime() - a.date.getTime());
}
