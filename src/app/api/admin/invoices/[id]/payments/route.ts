import { handle, parseJson, requireAdmin } from "@/lib/api";
import { recordPayment } from "@/lib/verein/fees-data";
import { paymentCreateSchema } from "@/lib/verein/fees-schemas";
import { idSchema } from "@/lib/verein/validation";
import { adminOk, type IdContext } from "../../../../_lib/http";

export const dynamic = "force-dynamic";

/** Zahlungseingang zu dieser Rechnung erfassen (Teilzahlung und Überzahlung möglich) und in der Kasse buchen. */
export const POST = handle(async (req: Request, { params }: IdContext) => {
  const admin = await requireAdmin(req);
  const invoiceId = idSchema.parse((await params).id);
  const input = await parseJson(req, paymentCreateSchema);
  return adminOk(await recordPayment(admin, { ...input, invoiceId }), 201);
});
