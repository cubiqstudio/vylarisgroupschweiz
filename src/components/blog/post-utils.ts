/** Hilfsfunktionen für Blog-Beiträge (reine Funktionen, serverseitig und clientseitig nutzbar). */
export type PostListItem = {
  id: string;
  title: string;
  slug: string;
  excerpt: string;
  author: string;
  date: Date;
};

/** Felder, die Listen und Karten aus der DB brauchen. */
export const POST_LIST_SELECT = {
  id: true,
  title: true,
  slug: true,
  excerpt: true,
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
  slug: string;
  excerpt: string;
  author: string;
  publishedAt: Date | null;
  createdAt: Date;
};

/** Sortiert absteigend nach Veröffentlichungsdatum (Fallback: Erstellungsdatum). */
export function toListItems(rows: PostRow[]): PostListItem[] {
  return rows
    .map((r) => ({
      id: r.id,
      title: r.title,
      slug: r.slug,
      excerpt: r.excerpt,
      author: r.author,
      date: r.publishedAt ?? r.createdAt,
    }))
    .sort((a, b) => b.date.getTime() - a.date.getTime());
}
