import { handle, requireAdmin } from "@/lib/api";
import { createAccount } from "@/lib/verein/ledger-data";
import { accountSchema } from "@/lib/verein/ledger-schemas";
import { adminOk, readJson } from "../../../_lib/http";

export const dynamic = "force-dynamic";

/** Konto (Kategorie) anlegen. */
export const POST = handle(async (req: Request) => {
  const admin = await requireAdmin(req);
  const input = accountSchema.parse(await readJson(req));
  return adminOk(await createAccount(admin, input), 201);
});
