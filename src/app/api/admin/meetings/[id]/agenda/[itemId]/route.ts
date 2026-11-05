import { handle, requireAdmin } from "@/lib/api";
import { deleteAgendaItem, updateAgendaItem } from "@/lib/verein/meetings-data";
import { agendaPatchSchema } from "@/lib/verein/meetings-schemas";
import { idSchema } from "@/lib/verein/validation";
import { adminOk, parsePatch } from "../../../../../_lib/http";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string; itemId: string }> };

/** Traktandum ändern oder um eine Stelle nach oben/unten verschieben (direction). */
export const PATCH = handle(async (req: Request, ctx: Ctx) => {
  const admin = await requireAdmin(req);
  const p = await ctx.params;
  const patch = await parsePatch(req, agendaPatchSchema);
  await updateAgendaItem(admin, idSchema.parse(p.id), idSchema.parse(p.itemId), patch);
  return adminOk({ updated: true });
});

export const DELETE = handle(async (req: Request, ctx: Ctx) => {
  const admin = await requireAdmin(req);
  const p = await ctx.params;
  await deleteAgendaItem(admin, idSchema.parse(p.id), idSchema.parse(p.itemId));
  return adminOk({ deleted: true });
});
