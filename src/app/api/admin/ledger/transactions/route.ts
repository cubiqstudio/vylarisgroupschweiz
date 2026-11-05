import { handle, requireAdmin } from "@/lib/api";
import { createTransaction } from "@/lib/verein/ledger-data";
import { transactionCreateSchema } from "@/lib/verein/ledger-schemas";
import { adminOk, readJson } from "../../../_lib/http";

export const dynamic = "force-dynamic";

/** Buchung erfassen (Kassier). Die Belegnummer vergibt der Server. */
export const POST = handle(async (req: Request) => {
  const admin = await requireAdmin(req);
  const input = transactionCreateSchema.parse(await readJson(req));
  return adminOk(await createTransaction(admin, input), 201);
});
