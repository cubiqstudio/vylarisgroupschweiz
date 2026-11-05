// Änderungsprotokoll (Audit-Log) für sensible Änderungen: Mitglieder, Beiträge, Buchungen, Einstellungen, Rollen, Austritte.
// Der Eintrag wird mit demselben Prisma-Client geschrieben wie die Änderung selbst – innerhalb einer $transaction wird er also
// zusammen mit ihr gespeichert oder zurückgerollt:
//
//   await db.$transaction(async (tx) => {
//     const after = await tx.member.update({ ... });
//     await logAudit(tx, { actor: auditActor(admin), action: "member.update", objectType: "Member", objectId: id,
//                          summary: `Mitglied ${after.memberNumber} geändert`, ...diffForAudit(before, after) });
//   });
//
// Vorher/Nachher werden als JSON-Text ohne Geheimnisse (Passwörter, Tokens, Hashes, Schlüssel) und gekürzt abgelegt.
import type { Prisma } from "@prisma/client";
import type { AuditActorType } from "./constants";

export type AuditClient = Pick<Prisma.TransactionClient, "auditLog">;

export type AuditActor = { type: AuditActorType; id?: string | null; name: string };

/** Akteur aus einem angemeldeten Admin (CurrentAdmin). */
export const auditActor = (admin: { id: string; name: string }): AuditActor => ({ type: "ADMIN", id: admin.id, name: admin.name });
/** Akteur aus einem angemeldeten Mitglied (Portal). */
export const auditActorMember = (member: { id: string; firstName: string; lastName: string }): AuditActor => ({
  type: "MEMBER",
  id: member.id,
  name: `${member.firstName} ${member.lastName}`.trim(),
});
/** Systemvorgang ohne Person (z. B. Mahnlauf, Aufräumen). */
export const SYSTEM_ACTOR: AuditActor = { type: "SYSTEM", id: null, name: "System" };

export type AuditEntry = {
  actor: AuditActor;
  /** Kurzer Schlüssel, z. B. «member.update», «invoice.cancel», «settings.update», «role.change» */
  action: string;
  objectType: string;
  objectId?: string | null;
  /** Klartext für die Liste, z. B. «Mitglied 12 ausgetreten» */
  summary?: string;
  before?: unknown;
  after?: unknown;
};

/** Schlüssel, deren Werte nie ins Protokoll gelangen. */
const SECRET_KEY = /pass(word)?|secret|token|hash|api[-_]?key|private|credential|authorization/i;
const MAX_JSON = 8000;
const MAX_STRING = 500;
const MAX_DEPTH = 5;

function sanitize(value: unknown, depth: number, seen: WeakSet<object>): unknown {
  if (value === null || value === undefined) return value ?? null;
  switch (typeof value) {
    case "string":
      return value.length > MAX_STRING ? `${value.slice(0, MAX_STRING)}…` : value;
    case "number":
      return Number.isFinite(value) ? value : String(value);
    case "boolean":
      return value;
    case "bigint":
      return value.toString();
    case "function":
    case "symbol":
      return undefined;
    default:
      break;
  }
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value.toISOString();
  if (value instanceof Uint8Array) return `[${value.byteLength} Bytes]`;
  if (typeof value !== "object") return undefined;
  if (seen.has(value)) return "[Zirkelbezug]";
  if (depth >= MAX_DEPTH) return "[…]";
  seen.add(value);
  try {
    if (Array.isArray(value)) return value.slice(0, 50).map((v) => sanitize(v, depth + 1, seen));
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (SECRET_KEY.test(k)) {
        out[k] = "[verborgen]";
        continue;
      }
      const s = sanitize(v, depth + 1, seen);
      if (s !== undefined) out[k] = s;
    }
    return out;
  } finally {
    seen.delete(value);
  }
}

/** Serialisiert einen Wert für das Protokoll: JSON-Text, ohne Geheimnisse, Zirkelbezüge und übergrosse Daten. null bei leerem Wert. */
export function serializeAuditValue(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  const json = JSON.stringify(sanitize(value, 0, new WeakSet())) ?? null;
  if (json === null) return null;
  return json.length > MAX_JSON ? JSON.stringify({ gekuerzt: true, anfang: json.slice(0, MAX_JSON - 60) }) : json;
}

function same(a: unknown, b: unknown): boolean {
  if (a instanceof Date && b instanceof Date) return a.getTime() === b.getTime();
  if (typeof a === "object" && typeof b === "object" && a && b) return JSON.stringify(sanitize(a, 0, new WeakSet())) === JSON.stringify(sanitize(b, 0, new WeakSet()));
  return a === b;
}

/** Nur die geänderten Felder von `before` und `after` (zum Ablegen als vorher/nachher). Leer, wenn nichts geändert wurde. */
export function diffObjects(
  before: Record<string, unknown> | null | undefined,
  after: Record<string, unknown> | null | undefined,
  ignore: readonly string[] = ["updatedAt", "createdAt"],
): { before: Record<string, unknown>; after: Record<string, unknown> } {
  const b: Record<string, unknown> = {};
  const a: Record<string, unknown> = {};
  const keys = new Set([...Object.keys(before ?? {}), ...Object.keys(after ?? {})]);
  for (const k of keys) {
    if (ignore.includes(k)) continue;
    const bv = before?.[k];
    const av = after?.[k];
    if (!same(bv, av)) {
      if (bv !== undefined) b[k] = bv;
      if (av !== undefined) a[k] = av;
    }
  }
  return { before: b, after: a };
}

/** Kurzform für logAudit: nur die Änderungen als before/after. */
export const diffForAudit = (before: Record<string, unknown> | null | undefined, after: Record<string, unknown> | null | undefined) => diffObjects(before, after);

/** Schreibt einen Protokolleintrag. Wirft bei Fehlern (innerhalb einer Transaktion soll die Änderung dann ebenfalls scheitern). */
export async function logAudit(client: AuditClient, entry: AuditEntry): Promise<void> {
  await client.auditLog.create({
    data: {
      actorType: entry.actor.type,
      actorId: entry.actor.id ?? null,
      actorName: entry.actor.name.slice(0, 200),
      action: entry.action.slice(0, 100),
      objectType: entry.objectType.slice(0, 100),
      objectId: entry.objectId ?? null,
      summary: (entry.summary ?? "").slice(0, 500),
      before: serializeAuditValue(entry.before),
      after: serializeAuditValue(entry.after),
    },
  });
}

/** Wie logAudit, schluckt aber Fehler (nur für unkritische Hinweise ausserhalb von Transaktionen). */
export async function logAuditSafe(client: AuditClient, entry: AuditEntry): Promise<void> {
  try {
    await logAudit(client, entry);
  } catch (e) {
    console.error("[audit] Eintrag konnte nicht geschrieben werden:", e instanceof Error ? e.name : "unbekannt");
  }
}
