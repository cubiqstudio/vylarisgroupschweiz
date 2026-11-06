import { handle, parseJson, requireAdmin } from "@/lib/api";
import { DEFAULT_MATRIX } from "@/lib/verein/permissions";
import { getEffectiveMatrix } from "@/lib/verein/permissions-data";
import { matrixToInput, rolePermissionsInputSchema } from "@/lib/verein/permissions-config";
import { saveRolePermissions } from "@/lib/verein/permissions-save";
import { adminOk } from "../../../../_lib/http";

export const dynamic = "force-dynamic";

async function load() {
  const matrix = await getEffectiveMatrix({ fresh: true });
  return { current: matrixToInput(matrix), defaults: matrixToInput(DEFAULT_MATRIX) };
}

/**
 * Rollen und Rechte (Modul «system»: nur Inhaber und Administration dürfen ändern, andere Rollen höchstens lesen, falls ihnen das
 * gegeben wurde). Der Pfad ist in PATH_MODULES ausdrücklich dem Modul «system» zugeordnet.
 */
export const GET = handle(async (req: Request) => {
  await requireAdmin(req);
  return adminOk(await load());
});

/** Gesamte Einstellung speichern. Fehlende Angaben gelten als Voreinstellung, ein leeres Objekt setzt alles zurück. */
export const PUT = handle(async (req: Request) => {
  const admin = await requireAdmin(req);
  const input = await parseJson(req, rolePermissionsInputSchema);
  const { changed } = await saveRolePermissions(admin, input);
  return adminOk({ ...(await load()), changed });
});
