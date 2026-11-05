import { handle, requireAdmin } from "@/lib/api";
import { approveMinutes } from "@/lib/verein/meetings-data";
import { minutesApproveSchema } from "@/lib/verein/meetings-schemas";
import { idSchema } from "@/lib/verein/validation";
import { adminOk, readJson, type IdContext } from "../../../../../_lib/http";

export const dynamic = "force-dynamic";

/** Protokoll genehmigen (Datum, wer). Danach ist es gesperrt. */
export const POST = handle(async (req: Request, ctx: IdContext) => {
  const admin = await requireAdmin(req);
  const id = idSchema.parse((await ctx.params).id);
  const input = minutesApproveSchema.parse(await readJson(req));
  await approveMinutes(admin, id, input);
  return adminOk({ approved: true });
});
