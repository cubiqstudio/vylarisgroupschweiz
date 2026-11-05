// Zod-Schemas für Zugänge und Rollen (Admin-Konten). Reine Definitionen; Fachregeln: ./access-lib.ts, Datenzugriff: ./access-data.ts.
import { z } from "zod";
import { ADMIN_ROLE_VALUES } from "./permissions";
import { emailSchema, idSchema, oneOf, text } from "./validation";

const roleSchema = oneOf(ADMIN_ROLE_VALUES, "Bitte eine gültige Rolle wählen.");

export const accessCreateSchema = z.object({
  email: emailSchema,
  name: text(2, 80, "Bitte einen Namen angeben."),
  role: roleSchema,
  extraRoles: z.array(roleSchema).max(ADMIN_ROLE_VALUES.length).default([]),
  /** Verknüpftes Mitglied (Vorstandsmitglied); optional */
  memberId: idSchema.nullable().default(null),
});
export type AccessCreateInput = z.infer<typeof accessCreateSchema>;

export const accessPatchSchema = z.object({
  name: text(2, 80, "Bitte einen Namen angeben."),
  role: roleSchema,
  extraRoles: z.array(roleSchema).max(ADMIN_ROLE_VALUES.length),
  memberId: idSchema.nullable(),
});
export type AccessPatchInput = Partial<z.infer<typeof accessPatchSchema>>;
