import { handle, requireAdmin } from "@/lib/api";
import { createTask, listTasks, parseTaskFilters } from "@/lib/verein/tasks-data";
import { taskCreateSchema } from "@/lib/verein/tasks-schemas";
import { adminOk, readJson } from "../../_lib/http";

export const dynamic = "force-dynamic";

/** Aufgaben für das Board (offene, in Arbeit, zuletzt erledigte). Filter: q, mine=1, priority, assignee, hideDone=1. */
export const GET = handle(async (req: Request) => {
  const admin = await requireAdmin(req);
  const filters = parseTaskFilters(new URL(req.url).searchParams);
  return adminOk(await listTasks(filters, { adminId: admin.id, memberId: admin.memberId }));
});

/** Neue Aufgabe. */
export const POST = handle(async (req: Request) => {
  const admin = await requireAdmin(req);
  const input = taskCreateSchema.parse(await readJson(req));
  const task = await createTask(admin, input);
  return adminOk({ id: task.id }, 201);
});
