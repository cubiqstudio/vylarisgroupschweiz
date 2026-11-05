import { handle, requireAdmin } from "@/lib/api";
import { deleteMeeting, updateMeeting } from "@/lib/verein/meetings-data";
import { meetingPatchSchema } from "@/lib/verein/meetings-schemas";
import { idSchema } from "@/lib/verein/validation";
import { adminOk, parsePatch, type IdContext } from "../../../_lib/http";

export const dynamic = "force-dynamic";

/** Sitzung ändern (nur gesendete Felder). */
export const PATCH = handle(async (req: Request, ctx: IdContext) => {
  const admin = await requireAdmin(req);
  const id = idSchema.parse((await ctx.params).id);
  const patch = await parsePatch(req, meetingPatchSchema);
  const { meeting, changedSchedule } = await updateMeeting(admin, id, patch);
  return adminOk({ id: meeting.id, changedSchedule });
});

/** Sitzung löschen (nur geplant, ohne Einladung und ohne genehmigtes Protokoll). */
export const DELETE = handle(async (req: Request, ctx: IdContext) => {
  const admin = await requireAdmin(req);
  await deleteMeeting(admin, idSchema.parse((await ctx.params).id));
  return adminOk({ deleted: true });
});
