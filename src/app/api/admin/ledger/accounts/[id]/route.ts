import { handle, requireAdmin } from "@/lib/api";
import { deleteAccount, updateAccount } from "@/lib/verein/ledger-data";
import { accountPatchSchema } from "@/lib/verein/ledger-schemas";
import { idSchema } from "@/lib/verein/validation";
import { adminOk, parsePatch, type IdContext } from "../../../../_lib/http";

export const dynamic = "force-dynamic";

export const PATCH = handle(async (req: Request, { params }: IdContext) => {
  const admin = await requireAdmin(req);
  const id = idSchema.parse((await params).id);
  const patch = await parsePatch(req, accountPatchSchema);
  await updateAccount(admin, id, patch);
  return adminOk({ id });
});

/** Löschen nur, solange das Konto nirgends verwendet wird; sonst deaktivieren. */
export const DELETE = handle(async (req: Request, { params }: IdContext) => {
  const admin = await requireAdmin(req);
  const id = idSchema.parse((await params).id);
  await deleteAccount(admin, id);
  return adminOk({ id });
});
