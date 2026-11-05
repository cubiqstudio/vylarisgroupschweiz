import { handle, requireAdmin } from "@/lib/api";
import { saveBudget } from "@/lib/verein/ledger-data";
import { budgetSchema } from "@/lib/verein/ledger-schemas";
import { adminOk, readJson } from "../../../_lib/http";

export const dynamic = "force-dynamic";

/** Budget eines Jahres speichern. Leere Beträge entfernen das Budget der Zeile. */
export const PUT = handle(async (req: Request) => {
  const admin = await requireAdmin(req);
  const input = budgetSchema.parse(await readJson(req));
  return adminOk(await saveBudget(admin, input));
});
