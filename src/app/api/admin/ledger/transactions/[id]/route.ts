import { handle, requireAdmin } from "@/lib/api";
import { updateTransaction } from "@/lib/verein/ledger-data";
import { transactionPatchSchema } from "@/lib/verein/ledger-schemas";
import { idSchema } from "@/lib/verein/validation";
import { adminOk, parsePatch, type IdContext } from "../../../../_lib/http";

export const dynamic = "force-dynamic";

/** Buchung ändern: nur im offenen Geschäftsjahr, nicht bei Gegenbuchungen, stornierten Buchungen und Buchungen aus Zahlungseingängen. */
export const PATCH = handle(async (req: Request, { params }: IdContext) => {
  const admin = await requireAdmin(req);
  const id = idSchema.parse((await params).id);
  const patch = await parsePatch(req, transactionPatchSchema);
  await updateTransaction(admin, id, patch);
  return adminOk({ id });
});
