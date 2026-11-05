import { ApiError, handle, parseJson, requireAdmin } from "@/lib/api";
import { getInvoiceDetail, updateInvoice } from "@/lib/verein/fees-data";
import { invoiceUpdateSchema } from "@/lib/verein/fees-schemas";
import { idSchema } from "@/lib/verein/validation";
import { adminOk, type IdContext } from "../../../_lib/http";

export const dynamic = "force-dynamic";

export const GET = handle(async (req: Request, { params }: IdContext) => {
  await requireAdmin(req);
  const id = idSchema.parse((await params).id);
  const invoice = await getInvoiceDetail(id);
  if (!invoice) throw new ApiError(404, "NOT_FOUND", "Rechnung nicht gefunden.");
  return adminOk(invoice);
});

export const PATCH = handle(async (req: Request, { params }: IdContext) => {
  const admin = await requireAdmin(req);
  const id = idSchema.parse((await params).id);
  const patch = await parseJson(req, invoiceUpdateSchema);
  await updateInvoice(admin, id, patch);
  return adminOk({ id });
});
