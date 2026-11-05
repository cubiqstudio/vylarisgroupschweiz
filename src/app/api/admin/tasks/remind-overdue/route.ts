import { handle, requireAdmin } from "@/lib/api";
import { remindOverdueTasks } from "@/lib/verein/tasks-data";
import { adminOk } from "../../../_lib/http";

export const dynamic = "force-dynamic";

/** Erinnert alle Verantwortlichen überfälliger Aufgaben (höchstens 50 Aufgaben, Sperrfrist je Aufgabe beachtet). */
export const POST = handle(async (req: Request) => {
  const admin = await requireAdmin(req);
  return adminOk(await remindOverdueTasks(admin));
});
