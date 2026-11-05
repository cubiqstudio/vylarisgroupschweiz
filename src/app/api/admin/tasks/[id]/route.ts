import { ApiError, handle, requireAdmin } from "@/lib/api";
import { deleteTask, getTask, updateTask } from "@/lib/verein/tasks-data";
import { taskPatchSchema } from "@/lib/verein/tasks-schemas";
import { idSchema } from "@/lib/verein/validation";
import { adminOk, parsePatch, type IdContext } from "../../../_lib/http";

export const dynamic = "force-dynamic";

/** Eine Aufgabe mit Kommentaren. */
export const GET = handle(async (req: Request, { params }: IdContext) => {
  await requireAdmin(req);
  const task = await getTask(idSchema.parse((await params).id));
  if (!task) throw new ApiError(404, "NOT_FOUND", "Aufgabe nicht gefunden.");
  return adminOk(task);
});

/** Aufgabe ändern (nur gesendete Felder), auch der Statuswechsel. */
export const PATCH = handle(async (req: Request, { params }: IdContext) => {
  const admin = await requireAdmin(req);
  const id = idSchema.parse((await params).id);
  const patch = await parsePatch(req, taskPatchSchema);
  return adminOk(await updateTask(admin, id, patch));
});

/** Aufgabe löschen (steht im Änderungsprotokoll). */
export const DELETE = handle(async (req: Request, { params }: IdContext) => {
  const admin = await requireAdmin(req);
  return adminOk(await deleteTask(admin, idSchema.parse((await params).id)));
});
