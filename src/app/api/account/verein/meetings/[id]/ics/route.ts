import { ApiError, handle } from "@/lib/api";
import { requireActiveMember } from "@/lib/verein/guard";
import { icsResponse } from "@/lib/verein/ics";
import { memberPortalUrl } from "@/lib/verein/links";
import { getMeetingForIcs } from "@/lib/verein/meetings-data";
import { meetingIcsEvent } from "@/lib/verein/meetings-lib";
import { idSchema } from "@/lib/verein/validation";
import type { IdContext } from "../../../../../_lib/http";

export const dynamic = "force-dynamic";

/** Kalendereintrag einer Versammlung, zu der eingeladen wurde. */
export const GET = handle(async (req: Request, ctx: IdContext) => {
  await requireActiveMember(req);
  const id = idSchema.parse((await ctx.params).id);
  const m = await getMeetingForIcs(id, { assemblyOnly: true });
  if (!m) throw new ApiError(404, "NOT_FOUND", "Versammlung nicht gefunden.");
  return icsResponse(`versammlung-${m.title}`, [meetingIcsEvent({ ...m, url: memberPortalUrl(`versammlungen/${m.id}`) })], { calendarName: "Versammlungen des Vereins" });
});
