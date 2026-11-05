import { ApiError, handle, requireAdmin } from "@/lib/api";
import { icsResponse } from "@/lib/verein/ics";
import { getMeetingForIcs } from "@/lib/verein/meetings-data";
import { meetingIcsEvent } from "@/lib/verein/meetings-lib";
import { idSchema } from "@/lib/verein/validation";
import type { IdContext } from "../../../../_lib/http";

export const dynamic = "force-dynamic";

/** Kalendereintrag der Sitzung (.ics). */
export const GET = handle(async (req: Request, ctx: IdContext) => {
  await requireAdmin(req);
  const m = await getMeetingForIcs(idSchema.parse((await ctx.params).id), { assemblyOnly: false });
  if (!m) throw new ApiError(404, "NOT_FOUND", "Sitzung nicht gefunden.");
  return icsResponse(`sitzung-${m.title}`, [meetingIcsEvent(m)], { calendarName: "Sitzungen des Vereins" });
});
