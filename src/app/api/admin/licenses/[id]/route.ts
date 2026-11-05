import { handle, requireAdmin } from "@/lib/api";
import { decideKey } from "@/lib/licenses";
import { keyActionSchema } from "@/lib/validation-licenses";
import { adminOk, readJson, type IdContext } from "../../../_lib/http";

export const dynamic = "force-dynamic";

/** Aktion auf einen Schlüssel: approve | reject | revoke | reactivate | reset-binding (+ optionaler Hinweis an den Nutzer). */
export const PATCH = handle(async (req: Request, { params }: IdContext) => {
  await requireAdmin(req);
  const { id } = await params;
  const { action, adminNote } = keyActionSchema.parse(await readJson(req));
  const row = await decideKey(id, action, adminNote);
  return adminOk({ id: row.id, status: row.status, adminNote: row.adminNote, boundInstance: row.boundInstance });
});
