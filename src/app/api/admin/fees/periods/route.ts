import { handle, parseJson, requireAdmin } from "@/lib/api";
import { createPeriod, listFeeTypes, listPeriods } from "@/lib/verein/fees-ops";
import { periodCreateSchema } from "@/lib/verein/fees-schemas";
import { adminOk } from "../../../_lib/http";

export const dynamic = "force-dynamic";

export const GET = handle(async (req: Request) => {
  await requireAdmin(req);
  const [items, types] = await Promise.all([listPeriods(), listFeeTypes()]);
  return adminOk({ items, types });
});

export const POST = handle(async (req: Request) => {
  const admin = await requireAdmin(req);
  const input = await parseJson(req, periodCreateSchema);
  return adminOk(await createPeriod(admin, input), 201);
});
