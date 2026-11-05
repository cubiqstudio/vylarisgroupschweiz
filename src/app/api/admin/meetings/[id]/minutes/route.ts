import { handle, requireAdmin } from "@/lib/api";
import { saveMinutes } from "@/lib/verein/meetings-data";
import { minutesSaveSchema } from "@/lib/verein/meetings-schemas";
import { idSchema } from "@/lib/verein/validation";
import { adminOk, readJson, type IdContext } from "../../../../_lib/http";

export const dynamic = "force-dynamic";

/** Protokolltext speichern. Ist das Protokoll genehmigt, braucht jede Änderung eine Begründung und steht im Änderungsprotokoll. */
export const PATCH = handle(async (req: Request, ctx: IdContext) => {
  const admin = await requireAdmin(req);
  const id = idSchema.parse((await ctx.params).id);
  const input = minutesSaveSchema.parse(await readJson(req));
  return adminOk(await saveMinutes(admin, id, input.minutes, input.amendReason));
});
