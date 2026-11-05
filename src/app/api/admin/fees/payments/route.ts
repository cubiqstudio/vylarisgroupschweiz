import { handle, parseJson, requireAdmin } from "@/lib/api";
import { recordPayment } from "@/lib/verein/fees-data";
import { listPayments } from "@/lib/verein/fees-ops";
import { paymentCreateSchema } from "@/lib/verein/fees-schemas";
import { listParams, pageMeta } from "@/lib/verein/pagination";
import { adminOk } from "../../../_lib/http";

export const dynamic = "force-dynamic";

export const GET = handle(async (req: Request) => {
  await requireAdmin(req);
  const p = listParams(new URL(req.url).searchParams);
  const { items, total } = await listPayments(p.q, p.skip, p.take);
  return adminOk({ items, meta: pageMeta(total, p.page, p.pageSize, items.length) });
});

/** Zahlungseingang erfassen (mit oder ohne Rechnung). */
export const POST = handle(async (req: Request) => {
  const admin = await requireAdmin(req);
  const input = await parseJson(req, paymentCreateSchema);
  return adminOk(await recordPayment(admin, input), 201);
});
