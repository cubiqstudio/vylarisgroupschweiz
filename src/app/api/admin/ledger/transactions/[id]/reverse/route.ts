import { handle, requireAdmin } from "@/lib/api";
import { reverseTransaction } from "@/lib/verein/ledger-data";
import { reverseSchema } from "@/lib/verein/ledger-schemas";
import { idSchema } from "@/lib/verein/validation";
import { adminOk, readJson, type IdContext } from "../../../../../_lib/http";

export const dynamic = "force-dynamic";

/** Buchung stornieren: erzeugt eine Gegenbuchung (statt zu löschen) und schreibt ins Änderungsprotokoll. */
export const POST = handle(async (req: Request, { params }: IdContext) => {
  const admin = await requireAdmin(req);
  const id = idSchema.parse((await params).id);
  const input = reverseSchema.parse(await readJson(req));
  return adminOk(await reverseTransaction(admin, id, input), 201);
});
