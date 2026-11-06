import { handle, parseJson, requireAdmin } from "@/lib/api";
import { bookExistingPayment } from "@/lib/verein/fees-data";
import { paymentBookSchema } from "@/lib/verein/fees-schemas";
import { requireAdminModule } from "@/lib/verein/guard";
import { idSchema } from "@/lib/verein/validation";
import { adminOk, type IdContext } from "../../../../../_lib/http";

export const dynamic = "force-dynamic";

/** Bereits erfasste, aber noch nicht gebuchte Zahlung in der Kasse nachbuchen (braucht Schreibrecht für Beiträge und Kasse). */
export const POST = handle(async (req: Request, { params }: IdContext) => {
  await requireAdmin(req);
  const admin = await requireAdminModule(req, "ledger", "write");
  const id = idSchema.parse((await params).id);
  const input = await parseJson(req, paymentBookSchema);
  return adminOk(await bookExistingPayment(admin, id, { assetAccountId: input.assetAccountId, incomeAccountId: input.incomeAccountId ?? null }));
});
