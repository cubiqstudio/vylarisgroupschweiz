import { handle, requireAdmin } from "@/lib/api";
import { createTaskFromResolution } from "@/lib/verein/meetings-data";
import { taskFromResolutionSchema } from "@/lib/verein/meetings-schemas";
import { requireAdminModule } from "@/lib/verein/guard";
import { idSchema } from "@/lib/verein/validation";
import { adminOk, readJson } from "../../../../../../_lib/http";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string; rid: string }> };

/** «Aufgabe aus Beschluss»: braucht Schreibrecht auf Versammlungen UND auf Aufgaben. */
export const POST = handle(async (req: Request, ctx: Ctx) => {
  await requireAdmin(req);
  const admin = await requireAdminModule(req, "tasks", "write");
  const p = await ctx.params;
  const input = taskFromResolutionSchema.parse(await readJson(req));
  const task = await createTaskFromResolution(admin, idSchema.parse(p.id), idSchema.parse(p.rid), input);
  return adminOk({ id: task.id }, 201);
});
