// Vereinseinstellungen lesen und schreiben (Tabelle SiteSetting, Schlüssel «verein.*»). Schema und Voreinstellungen: ./settings-schema.ts.
import "server-only";
import { db } from "@/lib/db";
import { auditActor, diffObjects, logAudit, type AuditActor } from "./audit";
import { parseVereinSettings, serializeVereinSettings, type VereinSettings } from "./settings-schema";

export * from "./settings-schema";

/** Alle Vereinseinstellungen (mit Voreinstellungen für nicht gesetzte Werte). */
export async function getVereinSettings(): Promise<VereinSettings> {
  const rows = await db.siteSetting.findMany({ where: { key: { startsWith: "verein." } } });
  return parseVereinSettings(Object.fromEntries(rows.map((r) => [r.key, r.value])));
}

/**
 * Speichert (Teil-)Einstellungen und schreibt in derselben Transaktion einen Protokolleintrag mit den geänderten Feldern.
 * `patch` muss vorher mit vereinSettingsPatchSchema geprüft sein. Gibt die neuen Einstellungen zurück.
 */
export async function saveVereinSettings(patch: Partial<VereinSettings>, actor: AuditActor | { id: string; name: string }): Promise<VereinSettings> {
  const who: AuditActor = "type" in actor ? actor : auditActor(actor);
  const values = serializeVereinSettings(patch);
  return db.$transaction(async (tx) => {
    const rows = await tx.siteSetting.findMany({ where: { key: { startsWith: "verein." } } });
    const raw: Record<string, string> = Object.fromEntries(rows.map((r) => [r.key, r.value]));
    const before = parseVereinSettings(raw);
    for (const [key, value] of Object.entries(values)) {
      if (value === null) {
        await tx.siteSetting.deleteMany({ where: { key } });
        delete raw[key];
      } else {
        await tx.siteSetting.upsert({ where: { key }, create: { key, value }, update: { value } });
        raw[key] = value;
      }
    }
    const after = parseVereinSettings(raw);
    const diff = diffObjects(before, after);
    if (Object.keys(diff.after).length > 0 || Object.keys(diff.before).length > 0) {
      await logAudit(tx, {
        actor: who,
        action: "settings.update",
        objectType: "VereinSettings",
        summary: `Vereinseinstellungen geändert (${Object.keys(diff.after).join(", ")})`,
        before: diff.before,
        after: diff.after,
      });
    }
    return after;
  });
}
