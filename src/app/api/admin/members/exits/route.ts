import { handle, requireAdmin } from "@/lib/api";
import { completeDueExits } from "@/lib/verein/members-data";
import { adminOk } from "../../../_lib/http";

export const dynamic = "force-dynamic";

/** Vollzieht alle fälligen Austritte (der letzte Tag der Mitgliedschaft ist vorbei). */
export const POST = handle(async (req: Request) => {
  const admin = await requireAdmin(req);
  const done = await completeDueExits(admin);
  return adminOk({ count: done.length });
});
