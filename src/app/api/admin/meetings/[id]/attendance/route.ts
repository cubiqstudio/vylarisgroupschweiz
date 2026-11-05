import { handle, requireAdmin } from "@/lib/api";
import { attendanceAction } from "@/lib/verein/meetings-data";
import { attendanceActionSchema } from "@/lib/verein/meetings-schemas";
import { idSchema } from "@/lib/verein/validation";
import { adminOk, readJson, type IdContext } from "../../../../_lib/http";

export const dynamic = "force-dynamic";

/** Anwesenheitsliste: erstellen (init), Person hinzufügen (add) oder entfernen (remove), Angaben speichern (save). */
export const POST = handle(async (req: Request, ctx: IdContext) => {
  const admin = await requireAdmin(req);
  const id = idSchema.parse((await ctx.params).id);
  const input = attendanceActionSchema.parse(await readJson(req));
  return adminOk(await attendanceAction(admin, id, input));
});
