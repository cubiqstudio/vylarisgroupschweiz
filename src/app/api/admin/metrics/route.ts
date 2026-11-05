import { db } from "@/lib/db";
import { handle, parseJson, requireAdmin } from "@/lib/api";
import { metricCreateSchema } from "@/lib/validation";
import { adminOk } from "../../_lib/http";

export const dynamic = "force-dynamic";

export const GET = handle(async (req: Request) => {
  await requireAdmin(req);
  const metrics = await db.systemMetric.findMany({ orderBy: [{ sortOrder: "asc" }, { name: "asc" }] });
  return adminOk(metrics);
});

export const POST = handle(async (req: Request) => {
  await requireAdmin(req);
  const input = await parseJson(req, metricCreateSchema);
  const metric = await db.systemMetric.create({ data: input });
  return adminOk(metric, 201);
});
