import { ApiError, handle, requireAdmin } from "@/lib/api";
import { remindTask } from "@/lib/verein/tasks-data";
import { taskRemindSchema } from "@/lib/verein/tasks-schemas";
import { idSchema } from "@/lib/verein/validation";
import { adminOk, readJson, type IdContext } from "../../../../_lib/http";

export const dynamic = "force-dynamic";

/** Erinnerung per Mail an die verantwortliche Person (manuell ausgelöst). */
export const POST = handle(async (req: Request, { params }: IdContext) => {
  const admin = await requireAdmin(req);
  const id = idSchema.parse((await params).id);
  const raw = await readJson(req).catch(() => ({}));
  const input = taskRemindSchema.parse(raw ?? {});
  const res = await remindTask(admin, id, input.note);
  if (!res.ok) throw new ApiError(409, "REMINDER_NOT_SENT", res.error);
  return adminOk({ to: res.to });
});
