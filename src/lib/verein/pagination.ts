// Seitenweise Listen und Suche – das Muster der bestehenden Benutzer-/Ticketlisten (25 pro Seite, ?q=…&page=…) an einer Stelle.
//
//   const { q, page, pageSize, skip } = listParams(await searchParams);            // Seite
//   const { q, page, pageSize, skip } = listParams(new URL(req.url).searchParams); // API
//   const where = { ...(q ? searchWhere(q, ["lastName", "firstName", "email"]) : {}) };
//   const [items, total] = await Promise.all([db.member.findMany({ where, skip, take: pageSize }), db.member.count({ where })]);
//   const meta = pageMeta(total, page, pageSize);   // { totalPages, from, to, page } – Seite gegebenenfalls zurückgeklemmt
import type { Prisma } from "@prisma/client";
import { containsCI } from "@/lib/search";

export const DEFAULT_PAGE_SIZE = 25;
export const MAX_PAGE_SIZE = 100;
export const MAX_QUERY_LENGTH = 100;

type ParamSource = URLSearchParams | Record<string, string | string[] | undefined>;

/** Erster Wert eines Query-Parameters (Seiten: searchParams-Objekt, API: URLSearchParams). */
export function firstParam(source: ParamSource, key: string): string {
  if (source instanceof URLSearchParams) return source.get(key) ?? "";
  const v = source[key];
  return (Array.isArray(v) ? v[0] : v) ?? "";
}

/** Ganzzahl aus einem Parameter, in [min, max] geklemmt; sonst der Vorgabewert. */
export function intParam(value: string | null | undefined, fallback: number, min: number, max: number): number {
  const n = Number.parseInt(value ?? "", 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

export type ListParams = { q: string; page: number; pageSize: number; skip: number; take: number };

export function listParams(source: ParamSource, opts: { pageSize?: number } = {}): ListParams {
  const q = firstParam(source, "q").trim().slice(0, MAX_QUERY_LENGTH);
  const pageSize = intParam(firstParam(source, "pageSize"), opts.pageSize ?? DEFAULT_PAGE_SIZE, 1, MAX_PAGE_SIZE);
  const page = intParam(firstParam(source, "page"), 1, 1, 100_000);
  return { q, page, pageSize, skip: (page - 1) * pageSize, take: pageSize };
}

export type PageMeta = { page: number; totalPages: number; from: number; to: number; total: number; pageSize: number };

/** Kennzahlen für den Pager. Liegt `page` hinter der letzten Seite, wird sie zurückgeklemmt (dann skip neu berechnen: skipFor). */
export function pageMeta(total: number, page: number, pageSize: number, shown?: number): PageMeta {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const p = Math.min(Math.max(1, page), totalPages);
  const from = total === 0 ? 0 : (p - 1) * pageSize + 1;
  const count = shown ?? Math.min(pageSize, Math.max(0, total - (p - 1) * pageSize));
  return { page: p, totalPages, from, to: total === 0 ? 0 : from + count - 1, total, pageSize };
}

export const skipFor = (page: number, pageSize: number): number => (Math.max(1, page) - 1) * pageSize;

/**
 * OR-Suche über Textfelder (gross-/kleinschreibungsunabhängig in SQLite und PostgreSQL).
 * Der Suchbegriff wird in Wörter zerlegt; jedes Wort muss in mindestens einem Feld vorkommen (AND über Wörter).
 */
export function searchWhere<K extends string>(q: string, fields: readonly K[]): { AND: Array<{ OR: Array<Record<K, Prisma.StringFilter>> }> } {
  const words = q
    .trim()
    .slice(0, MAX_QUERY_LENGTH)
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 5);
  return { AND: words.map((w) => ({ OR: fields.map((f) => ({ [f]: containsCI(w) }) as Record<K, Prisma.StringFilter>) })) };
}

/** Link auf eine Listenseite mit Filtern; leere Werte und Seite 1 entfallen. */
export function listHref(base: string, params: Record<string, string | number | null | undefined>): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === null || v === undefined || v === "" || (k === "page" && Number(v) <= 1)) continue;
    sp.set(k, String(v));
  }
  const s = sp.toString();
  return s ? `${base}?${s}` : base;
}
