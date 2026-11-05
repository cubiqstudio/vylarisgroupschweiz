import { handle, requireAdmin } from "@/lib/api";
import { addTaskComment } from "@/lib/verein/tasks-data";
import { taskCommentSchema } from "@/lib/verein/tasks-schemas";
import { idSchema } from "@/lib/verein/validation";
import { adminOk, readJson, type IdContext } from "../../../../_lib/http";

export const dynamic = "force-dynamic";

/** Kommentar zu einer Aufgabe (reiner Text; wird beim Anzeigen nicht als HTML ausgegeben). */
export const POST = handle(async (req: Request, { params }: IdContext) => {
  const admin = await requireAdmin(req);
  const id = idSchema.parse((await params).id);
  const input = taskCommentSchema.parse(await readJson(req));
  return adminOk(await addTaskComment(admin, id, input.body), 201);
});
