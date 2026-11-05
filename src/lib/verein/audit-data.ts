// Änderungsprotokoll lesen (Seite «Änderungsprotokoll» und CSV-Export). Das Protokoll wird hier nur gelesen, nie geändert oder gelöscht.
import "server-only";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { AUDIT_ACTOR_TYPES } from "./constants";
import { addDays, parseDateOnly, startOfDayZurich } from "./dates";
import { LEGACY_BOARD_SUMMARY_MARKER } from "./documents-lib";
import { firstParam, searchWhere } from "./pagination";

type ParamSource = URLSearchParams | Record<string, string | string[] | undefined>;

export type AuditFilters = {
  q: string;
  /** Objekttyp, z. B. «Member» */
  objectType: string;
  /** Aktion, z. B. «member.update» */
  action: string;
  actorType: string;
  /** Kalendertage «JJJJ-MM-TT» (Zürcher Zeit), beide Grenzen eingeschlossen */
  from: string;
  to: string;
};

const SAFE = /^[A-Za-z0-9_.-]{1,100}$/;

/** Liest die Filter aus den Parametern; ungültige Werte entfallen. */
export function parseAuditFilters(source: ParamSource): AuditFilters {
  const pick = (key: string) => {
    const v = firstParam(source, key).trim();
    return SAFE.test(v) ? v : "";
  };
  const day = (key: string) => {
    const v = firstParam(source, key).trim();
    return parseDateOnly(v) ? v : "";
  };
  const actorType = pick("actor");
  return {
    q: firstParam(source, "q").trim().slice(0, 100),
    objectType: pick("object"),
    action: pick("action"),
    actorType: (AUDIT_ACTOR_TYPES as readonly string[]).includes(actorType) ? actorType : "",
    from: day("from"),
    to: day("to"),
  };
}

/**
 * Ältere Einträge zu Dokumenten «Nur Vorstand» nennen den Titel im Klartext (Zusammenfassung «Titel» (Kategorie, Nur Vorstand) oder
 * Vorher-Wert mit Sichtbarkeit VORSTAND). Wer das Einzelrecht nicht hat, bekommt sie nicht zu sehen (Liste, Suche, Zähler, Export).
 * Neuere Einträge sind neutral formuliert (documents-lib.ts, BOARD_DOCUMENT_AUDIT_LABEL) und bleiben sichtbar.
 */
export const legacyBoardDocumentRows: Prisma.AuditLogWhereInput = {
  objectType: "Document",
  OR: [{ summary: { contains: LEGACY_BOARD_SUMMARY_MARKER } }, { before: { contains: '"visibility":"VORSTAND"' } }, { before: { contains: '"sichtbarkeit":"VORSTAND"' } }],
};

/**
 * Das Gegenstück zu legacyBoardDocumentRows, ausgeschrieben statt mit NOT: `before` darf NULL sein, und `NOT (… OR NULL)` wäre in SQL
 * ebenfalls NULL, die Zeile fiele also fälschlich weg.
 */
const withoutLegacyBoardDocumentRows: Prisma.AuditLogWhereInput = {
  OR: [
    { objectType: { not: "Document" } },
    {
      AND: [
        { NOT: { summary: { contains: LEGACY_BOARD_SUMMARY_MARKER } } },
        { OR: [{ before: null }, { NOT: { before: { contains: '"visibility":"VORSTAND"' } } }] },
        { OR: [{ before: null }, { NOT: { before: { contains: '"sichtbarkeit":"VORSTAND"' } } }] },
      ],
    },
  ],
};

/** `canSeeBoardDocuments`: Einzelrecht «Dokumente „Nur Vorstand“ sehen» (permissions.ts). Ohne das Recht entfallen die alten Klartext-Einträge. */
export function auditWhere(f: AuditFilters, canSeeBoardDocuments: boolean): Prisma.AuditLogWhereInput {
  const and: Prisma.AuditLogWhereInput[] = [];
  if (!canSeeBoardDocuments) and.push(withoutLegacyBoardDocumentRows);
  if (f.q) and.push(searchWhere(f.q, ["summary", "actorName", "action", "objectId"] as const));
  if (f.objectType) and.push({ objectType: f.objectType });
  if (f.action) and.push({ action: f.action });
  if (f.actorType) and.push({ actorType: f.actorType });
  const from = f.from ? parseDateOnly(f.from) : null;
  const to = f.to ? parseDateOnly(f.to) : null;
  if (from) and.push({ createdAt: { gte: startOfDayZurich(from) } });
  if (to) and.push({ createdAt: { lt: startOfDayZurich(addDays(to, 1)) } });
  return and.length > 0 ? { AND: and } : {};
}

export const auditListSelect = {
  id: true,
  createdAt: true,
  actorType: true,
  actorName: true,
  action: true,
  objectType: true,
  objectId: true,
  summary: true,
  before: true,
  after: true,
} satisfies Prisma.AuditLogSelect;
export type AuditRow = Prisma.AuditLogGetPayload<{ select: typeof auditListSelect }>;

export async function listAuditLog(f: AuditFilters, canSeeBoardDocuments: boolean, skip: number, take: number): Promise<{ rows: AuditRow[]; total: number }> {
  const where = auditWhere(f, canSeeBoardDocuments);
  const [rows, total] = await Promise.all([
    db.auditLog.findMany({ where, orderBy: [{ createdAt: "desc" }, { id: "desc" }], skip, take, select: auditListSelect }),
    db.auditLog.count({ where }),
  ]);
  return { rows, total };
}

/** Objekttypen und Aktionen, die im Protokoll vorkommen (für die Filterlisten). */
export async function auditFacets(): Promise<{ objectTypes: string[]; actions: string[] }> {
  const [types, actions] = await Promise.all([
    db.auditLog.groupBy({ by: ["objectType"], orderBy: { objectType: "asc" } }),
    db.auditLog.groupBy({ by: ["action"], orderBy: { action: "asc" } }),
  ]);
  return { objectTypes: types.map((t) => t.objectType), actions: actions.map((a) => a.action) };
}

/** Zeilen für den Export (ohne Vorher/Nachher-Werte: im Export steht nur der Klartext), höchstens `limit`. */
export function listAuditForExport(f: AuditFilters, canSeeBoardDocuments: boolean, limit = 20000) {
  return db.auditLog.findMany({
    where: auditWhere(f, canSeeBoardDocuments),
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: limit,
    select: { createdAt: true, actorType: true, actorName: true, action: true, objectType: true, objectId: true, summary: true },
  });
}
