import { handle, requireAdmin } from "@/lib/api";
import { unapproveMinutes } from "@/lib/verein/meetings-data";
import { minutesUnapproveSchema } from "@/lib/verein/meetings-schemas";
import { idSchema } from "@/lib/verein/validation";
import { adminOk, readJson, type IdContext } from "../../../../../_lib/http";

export const dynamic = "force-dynamic";

/** Genehmigung aufheben (mit Begründung, steht im Änderungsprotokoll). */
export const POST = handle(async (req: Request, ctx: IdContext) => {
  const admin = await requireAdmin(req);
  const id = idSchema.parse((await ctx.params).id);
  const input = minutesUnapproveSchema.parse(await readJson(req));
  await unapproveMinutes(admin, id, input.reason);
  return adminOk({ approved: false });
});
