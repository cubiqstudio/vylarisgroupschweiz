// Einstellbare Rollenrechte: Speicherformat und Eingabeprüfung (rein, ohne Datenbank). Die Auflösung zur wirksamen Matrix und die
// Schranken stehen in ./permissions.ts (resolveMatrix, isAllowedLevel); das Laden und Speichern in ./permissions-data.ts.
//
// Gespeichert werden nur Abweichungen von der Voreinstellung als JSON in SiteSetting «verein.permissions.v1»:
//   {"levels":{"KASSIER":{"ledger":"read"}},"flags":{"REVISOR":{"boardDocuments":true}}}
// «none» nimmt die Voreinstellungsstufe weg. Inhaber und Administration kommen nie vor.
import { z } from "zod";
import "@/lib/validation";
import {
  CONFIGURABLE_ROLES,
  DEFAULT_MATRIX,
  MODULE_LABEL,
  ROLE_FLAGS,
  VEREIN_MODULES,
  diffFromDefault,
  isAllowedLevel,
  resolveMatrix,
  ADMIN_ROLE_LABEL,
  type ConfigurableRole,
  type EffectiveMatrix,
  type PermissionOverrides,
} from "./permissions";

export const PERMISSIONS_SETTING_KEY = "verein.permissions.v1";
/** Obergrenze für den gespeicherten Text; alles darüber gilt als beschädigt (Voreinstellung). */
const MAX_STORED_LENGTH = 20_000;

const storedSchema = z.object({
  levels: z.record(z.string(), z.record(z.string(), z.string())).optional(),
  flags: z.record(z.string(), z.record(z.string(), z.boolean())).optional(),
});

/**
 * Liest den gespeicherten Text tolerant: kein Text, kaputtes JSON, falsche Form oder zu gross → keine Abweichungen
 * (Voreinstellung). Unbekannte Rollen und Module sowie unzulässige Werte werden verworfen (resolveMatrix).
 */
export function parseStoredOverrides(raw: string | null | undefined): PermissionOverrides {
  if (typeof raw !== "string" || raw.trim() === "" || raw.length > MAX_STORED_LENGTH) return {};
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return {};
  }
  const parsed = storedSchema.safeParse(json);
  if (!parsed.success) return {};
  return diffFromDefault(resolveMatrix(parsed.data));
}

/** Wirksame Matrix aus dem gespeicherten Text. Bei jedem Fehler gilt die Voreinstellung. */
export function matrixFromStored(raw: string | null | undefined): EffectiveMatrix {
  return resolveMatrix(parseStoredOverrides(raw));
}

/** Text zum Speichern; null, wenn nichts von der Voreinstellung abweicht (Eintrag wird gelöscht). */
export function serializeOverrides(overrides: PermissionOverrides): string | null {
  const levels = overrides.levels && Object.keys(overrides.levels).length > 0 ? overrides.levels : undefined;
  const flags = overrides.flags && Object.keys(overrides.flags).length > 0 ? overrides.flags : undefined;
  if (!levels && !flags) return null;
  return JSON.stringify({ ...(levels ? { levels } : {}), ...(flags ? { flags } : {}) });
}

// ---- Eingabe der Oberfläche -----------------------------------------------------------------------------------------------

const roleKey = z.enum(CONFIGURABLE_ROLES as unknown as [ConfigurableRole, ...ConfigurableRole[]], { error: "Unbekannte oder nicht einstellbare Rolle. Inhaber und Administration sind fest." });
const moduleKey = z.enum(VEREIN_MODULES, { error: "Unbekannter Bereich." });
const levelValue = z.enum(["none", "read", "write"], { error: "Bitte «Kein Zugriff», «Lesen» oder «Ändern» wählen." });

/**
 * Gewünschte Einstellung für die einstellbaren Rollen. Fehlende Angaben gelten als Voreinstellung. Streng: unbekannte Rollen, Bereiche
 * und Felder sind ein Fehler (422), ebenso jede Stufe, die die Schranken verletzt (z. B. «Ändern» für System).
 */
export const rolePermissionsInputSchema = z
  .object({
    levels: z.partialRecord(roleKey, z.partialRecord(moduleKey, levelValue)).default({}),
    flags: z.partialRecord(roleKey, z.strictObject(Object.fromEntries(ROLE_FLAGS.map((f) => [f, z.boolean().optional()])) as Record<(typeof ROLE_FLAGS)[number], z.ZodOptional<z.ZodBoolean>>)).default({}),
  })
  .strict()
  .superRefine((input, ctx) => {
    for (const [role, row] of Object.entries(input.levels)) {
      for (const [module, level] of Object.entries(row ?? {})) {
        if (!level || isAllowedLevel(role, module as (typeof VEREIN_MODULES)[number], level)) continue;
        const roleName = ADMIN_ROLE_LABEL[role as ConfigurableRole];
        const moduleName = MODULE_LABEL[module as (typeof VEREIN_MODULES)[number]];
        const message =
          module === "system"
            ? `«${moduleName}» darf für ${roleName} höchstens «Lesen» sein. Nur Inhaber und Administration dürfen hier ändern.`
            : module === "self"
              ? `«${moduleName}» muss für ${roleName} auf «Ändern» bleiben (eigenes Passwort).`
              : `«${moduleName}» braucht für ${roleName} mindestens «Lesen».`;
        ctx.addIssue({ code: "custom", path: ["levels", role, module], message });
      }
    }
  });
export type RolePermissionsInput = z.infer<typeof rolePermissionsInputSchema>;

/** Wirksame Matrix aus der geprüften Eingabe (fehlende Angaben = Voreinstellung). */
export function matrixFromInput(input: RolePermissionsInput): EffectiveMatrix {
  return resolveMatrix({ levels: input.levels, flags: input.flags });
}

/** Die einstellbaren Teile einer Matrix in der Form der Eingabe (für die Oberfläche): alle einstellbaren Rollen, alle Bereiche. */
export function matrixToInput(matrix: EffectiveMatrix): { levels: Record<string, Record<string, "none" | "read" | "write">>; flags: Record<string, Record<string, boolean>> } {
  const levels: Record<string, Record<string, "none" | "read" | "write">> = {};
  const flags: Record<string, Record<string, boolean>> = {};
  for (const role of CONFIGURABLE_ROLES) {
    levels[role] = Object.fromEntries(VEREIN_MODULES.map((m) => [m, matrix.levels[role][m] ?? "none"]));
    flags[role] = Object.fromEntries(ROLE_FLAGS.map((f) => [f, matrix.flags[role][f]]));
  }
  return { levels, flags };
}

export { DEFAULT_MATRIX };
