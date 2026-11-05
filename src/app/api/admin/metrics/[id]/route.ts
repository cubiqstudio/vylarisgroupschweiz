import { db } from "@/lib/db";
import { handle, requireAdmin } from "@/lib/api";
import { metricUpdateSchema } from "@/lib/validation";
import { adminOk, notFound, parsePatch, type IdContext } from "../../../_lib/http";

export const dynamic = "force-dynamic";

export const GET = handle(async (req: Request, ctx: IdContext) => {
  await requireAdmin(req);
  const { id } = await ctx.params;
  const metric = await db.systemMetric.findUnique({ where: { id } });
  if (!metric) notFound("Komponente");
  return adminOk(metric);
});

export const PATCH = handle(async (req: Request, ctx: IdContext) => {
  await requireAdmin(req);
  const { id } = await ctx.params;
  const data = await parsePatch(req, metricUpdateSchema);
  const metric = await db.systemMetric.update({ where: { id }, data });
  return adminOk(metric);
});

export const DELETE = handle(async (req: Request, ctx: IdContext) => {
  await requireAdmin(req);
  const { id } = await ctx.params;
  await db.systemMetric.delete({ where: { id } });
  return adminOk({ id });
});
