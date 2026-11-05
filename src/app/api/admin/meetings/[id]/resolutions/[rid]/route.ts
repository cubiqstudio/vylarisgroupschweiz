import { handle, requireAdmin } from "@/lib/api";
import { deleteResolution, updateResolution } from "@/lib/verein/meetings-data";
import { resolutionPatchSchema } from "@/lib/verein/meetings-schemas";
import { idSchema } from "@/lib/verein/validation";
import { adminOk, parsePatch } from "../../../../../_lib/http";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string; rid: string }> };

export const PATCH = handle(async (req: Request, ctx: Ctx) => {
  const admin = await requireAdmin(req);
  const p = await ctx.params;
  const patch = await parsePatch(req, resolutionPatchSchema);
  await updateResolution(admin, idSchema.parse(p.id), idSchema.parse(p.rid), patch);
  return adminOk({ updated: true });
});

export const DELETE = handle(async (req: Request, ctx: Ctx) => {
  const admin = await requireAdmin(req);
  const p = await ctx.params;
  await deleteResolution(admin, idSchema.parse(p.id), idSchema.parse(p.rid));
  return adminOk({ deleted: true });
});
