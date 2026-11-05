import { db } from "@/lib/db";
import { handle, parseJson, requireAdmin } from "@/lib/api";
import { serviceCreateSchema } from "@/lib/validation";
import { adminOk } from "../../_lib/http";

export const dynamic = "force-dynamic";

export const GET = handle(async (req: Request) => {
  await requireAdmin(req);
  const services = await db.saasService.findMany({ orderBy: [{ sortOrder: "asc" }, { name: "asc" }] });
  return adminOk(services);
});

export const POST = handle(async (req: Request) => {
  await requireAdmin(req);
  const input = await parseJson(req, serviceCreateSchema);
  const service = await db.saasService.create({ data: input });
  return adminOk(service, 201);
});
