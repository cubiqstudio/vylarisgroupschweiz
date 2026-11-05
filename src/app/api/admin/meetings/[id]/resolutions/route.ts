import { handle, requireAdmin } from "@/lib/api";
import { createResolution } from "@/lib/verein/meetings-data";
import { resolutionCreateSchema } from "@/lib/verein/meetings-schemas";
import { idSchema } from "@/lib/verein/validation";
import { adminOk, readJson, type IdContext } from "../../../../_lib/http";

export const dynamic = "force-dynamic";

export const POST = handle(async (req: Request, ctx: IdContext) => {
  const admin = await requireAdmin(req);
  const id = idSchema.parse((await ctx.params).id);
  const input = resolutionCreateSchema.parse(await readJson(req));
  const r = await createResolution(admin, id, input);
  return adminOk({ id: r.id, number: r.number }, 201);
});
