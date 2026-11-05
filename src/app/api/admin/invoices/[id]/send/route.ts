import { handle, parseJson, requireAdmin } from "@/lib/api";
import { sendInvoice } from "@/lib/verein/fees-data";
import { invoiceSendSchema } from "@/lib/verein/fees-schemas";
import { idSchema } from "@/lib/verein/validation";
import { adminOk, type IdContext } from "../../../../_lib/http";

export const dynamic = "force-dynamic";

/** Entwurf versenden (E-Mail oder «per Post zugestellt») bzw. offene Rechnung erneut per E-Mail senden. */
export const POST = handle(async (req: Request, { params }: IdContext) => {
  const admin = await requireAdmin(req);
  const id = idSchema.parse((await params).id);
  const { channel } = await parseJson(req, invoiceSendSchema);
  return adminOk(await sendInvoice(admin, id, channel));
});
