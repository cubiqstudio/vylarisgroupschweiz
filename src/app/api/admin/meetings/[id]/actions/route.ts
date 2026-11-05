import { handle, requireAdmin } from "@/lib/api";
import { runMeetingAction } from "@/lib/verein/meetings-data";
import { meetingActionSchema } from "@/lib/verein/meetings-schemas";
import { idSchema } from "@/lib/verein/validation";
import { adminOk, readJson, type IdContext } from "../../../../_lib/http";

export const dynamic = "force-dynamic";

/** Status ändern: durchgeführt, absagen (optional mit Mail an die Eingeladenen), wieder öffnen, als eingeladen markieren. */
export const POST = handle(async (req: Request, ctx: IdContext) => {
  const admin = await requireAdmin(req);
  const id = idSchema.parse((await ctx.params).id);
  const input = meetingActionSchema.parse(await readJson(req));
  return adminOk(await runMeetingAction(admin, id, input));
});
