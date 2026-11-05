import type { Prisma } from "@prisma/client";

/**
 * "Enthält"-Filter, der in beiden Datenbanken Groß-/Kleinschreibung ignoriert:
 * SQLite (LIKE) tut das für ASCII ohnehin, PostgreSQL braucht `mode: "insensitive"`,
 * das SQLite nicht kennt – deshalb nur bei einer postgres(ql)://-DATABASE_URL setzen.
 */
export function containsCI(q: string): Prisma.StringFilter {
  const isPostgres = /^postgres(ql)?:\/\//i.test(process.env.DATABASE_URL ?? "");
  return (isPostgres ? { contains: q, mode: "insensitive" } : { contains: q }) as Prisma.StringFilter;
}
