// Rollenrechte speichern (nur auf dem Server). Laden mit Zwischenspeicher: ./permissions-data.ts.
import "server-only";
import { ApiError } from "@/lib/api";
import { db } from "@/lib/db";
import { auditActor, logAudit, type AuditActor } from "./audit";
import { PERMISSIONS_SETTING_KEY, matrixFromInput, matrixFromStored, serializeOverrides, type RolePermissionsInput } from "./permissions-config";
import { invalidatePermissionsCache } from "./permissions-data";
import {
  ADMIN_ROLE_LABEL,
  CONFIGURABLE_ROLES,
  ROLE_FLAGS,
  VEREIN_MODULES,
  canAccess,
  diffFromDefault,
  type EffectiveMatrix,
} from "./permissions";

type ChangeSet = { before: Record<string, string | boolean>; after: Record<string, string | boolean> };

/** Geänderte Stufen und Einzelrechte als flache Liste («KASSIER.ledger»: «write»); ohne Personendaten. */
export function describeMatrixChange(before: EffectiveMatrix, after: EffectiveMatrix): ChangeSet {
  const out: ChangeSet = { before: {}, after: {} };
  for (const role of CONFIGURABLE_ROLES) {
    for (const mod of VEREIN_MODULES) {
      const b = before.levels[role][mod] ?? "none";
      const a = after.levels[role][mod] ?? "none";
      if (a !== b) {
        out.before[`${role}.${mod}`] = b;
        out.after[`${role}.${mod}`] = a;
      }
    }
    for (const flag of ROLE_FLAGS) {
      if (before.flags[role][flag] !== after.flags[role][flag]) {
        out.before[`${role}.${flag}`] = before.flags[role][flag];
        out.after[`${role}.${flag}`] = after.flags[role][flag];
      }
    }
  }
  return out;
}

/**
 * Rollenrechte speichern (ersetzt alle bisherigen Abweichungen). `input` ist mit rolePermissionsInputSchema geprüft; fehlende
 * Angaben gelten als Voreinstellung. Nur wer das Modul «system» ändern darf (Inhaber, Administration), darf speichern – auch
 * hier erzwungen, nicht nur in der Route. Schreibt in derselben Transaktion einen Eintrag ins Änderungsprotokoll.
 */
export async function saveRolePermissions(
  admin: { id: string; name: string; roles: readonly string[] },
  input: RolePermissionsInput,
  actor?: AuditActor,
): Promise<{ matrix: EffectiveMatrix; changed: boolean }> {
  if (!canAccess(admin.roles, "system", "write")) {
    throw new ApiError(403, "FORBIDDEN", "Rollen und Rechte dürfen nur Inhaber und Administration ändern.");
  }
  const next = matrixFromInput(input);
  const result = await db.$transaction(async (tx) => {
    const row = await tx.siteSetting.findUnique({ where: { key: PERMISSIONS_SETTING_KEY }, select: { value: true } });
    const before = matrixFromStored(row?.value ?? null);
    const change = describeMatrixChange(before, next);
    const value = serializeOverrides(diffFromDefault(next));
    const same = (row?.value ?? null) === value;
    if (Object.keys(change.after).length === 0 && same) return { before, changed: false };
    if (value === null) await tx.siteSetting.deleteMany({ where: { key: PERMISSIONS_SETTING_KEY } });
    else await tx.siteSetting.upsert({ where: { key: PERMISSIONS_SETTING_KEY }, create: { key: PERMISSIONS_SETTING_KEY, value }, update: { value } });
    if (Object.keys(change.after).length > 0) {
      const roles = [...new Set(Object.keys(change.after).map((k) => k.split(".")[0] as keyof typeof ADMIN_ROLE_LABEL))];
      await logAudit(tx, {
        actor: actor ?? auditActor(admin),
        action: "permissions.update",
        objectType: "RolePermissions",
        summary: `Rollen und Rechte geändert (${roles.map((r) => ADMIN_ROLE_LABEL[r]).join(", ")})`,
        before: change.before,
        after: change.after,
      });
    }
    return { before, changed: true };
  });
  invalidatePermissionsCache();
  return { matrix: next, changed: result.changed };
}
