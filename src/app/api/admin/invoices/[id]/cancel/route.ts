import { handle, parseJson, requireAdmin } from "@/lib/api";
import { cancelInvoice } from "@/lib/verein/fees-data";
import { invoiceCancelSchema } from "@/lib/verein/fees-schemas";
import { idSchema } from "@/lib/verein/validation";
import { adminOk, type IdContext } from "../../../../_lib/http";

export const dynamic = "force-dynamic";

export const POST = handle(async (req: Request, { params }: IdContext) => {
  const admin = await requireAdmin(req);
  const id = idSchema.parse((await params).id);
  const { reason } = await parseJson(req, invoiceCancelSchema);
  await cancelInvoice(admin, id, reason);
  return adminOk({ id });
});
