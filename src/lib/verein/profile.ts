// Vereinsstammdaten lesen und schreiben (Tabelle SiteSetting, Schlüssel «verein.profile.*»). Schema: ./profile-schema.ts.
import "server-only";
import { db } from "@/lib/db";
import { SITE } from "@/lib/sites";
import { auditActor, diffObjects, logAudit, type AuditActor } from "./audit";
import { parseVereinProfile, profileDisplayName, serializeVereinProfile, type VereinProfile } from "./profile-schema";

export * from "./profile-schema";

/** Stammdaten des Vereins (leer, was noch nicht eingetragen ist). */
export async function getVereinProfile(): Promise<VereinProfile> {
  const rows = await db.siteSetting.findMany({ where: { key: { startsWith: "verein.profile." } } });
  return parseVereinProfile(Object.fromEntries(rows.map((r) => [r.key, r.value])));
}

/** Name des Vereins für Ausweis und Mitteilungen: eingetragener Name, sonst der Rechtsträger der Website. */
export async function getVereinName(): Promise<string> {
  try {
    return profileDisplayName(await getVereinProfile(), SITE.legalName);
  } catch {
    return SITE.legalName;
  }
}

/** Speichert (Teil-)Stammdaten und schreibt in derselben Transaktion einen Protokolleintrag. `patch` muss vorher validiert sein. */
export async function saveVereinProfile(patch: Partial<VereinProfile>, actor: AuditActor | { id: string; name: string }): Promise<VereinProfile> {
  const who: AuditActor = "type" in actor ? actor : auditActor(actor);
  const values = serializeVereinProfile(patch);
  return db.$transaction(async (tx) => {
    const rows = await tx.siteSetting.findMany({ where: { key: { startsWith: "verein.profile." } } });
    const raw: Record<string, string> = Object.fromEntries(rows.map((r) => [r.key, r.value]));
    const before = parseVereinProfile(raw);
    for (const [key, value] of Object.entries(values)) {
      if (value === null) {
        await tx.siteSetting.deleteMany({ where: { key } });
        delete raw[key];
      } else {
        await tx.siteSetting.upsert({ where: { key }, create: { key, value }, update: { value } });
        raw[key] = value;
      }
    }
    const after = parseVereinProfile(raw);
    const diff = diffObjects(before, after);
    if (Object.keys(diff.after).length > 0 || Object.keys(diff.before).length > 0) {
      await logAudit(tx, {
        actor: who,
        action: "settings.update",
        objectType: "VereinProfile",
        summary: `Vereinsstammdaten geändert (${Object.keys(diff.after).join(", ")})`,
        before: diff.before,
        after: diff.after,
      });
    }
    return after;
  });
}
