import { handle, parseJson, requireAdmin } from "@/lib/api";
import { invoiceCreateSchema } from "@/lib/verein/fees-schemas";
import { createInvoice, listInvoices } from "@/lib/verein/fees-data";
import { listParams, pageMeta } from "@/lib/verein/pagination";
import { adminOk } from "../../_lib/http";

export const dynamic = "force-dynamic";

export const GET = handle(async (req: Request) => {
  await requireAdmin(req);
  const sp = new URL(req.url).searchParams;
  const p = listParams(sp);
  const { items, total } = await listInvoices({ q: p.q, status: sp.get("status") ?? undefined, periodId: sp.get("periodId") ?? undefined }, p.skip, p.take);
  return adminOk({ items, meta: pageMeta(total, p.page, p.pageSize, items.length) });
});

export const POST = handle(async (req: Request) => {
  const admin = await requireAdmin(req);
  const input = await parseJson(req, invoiceCreateSchema);
  const created = await createInvoice(admin, input);
  return adminOk(created, 201);
});
