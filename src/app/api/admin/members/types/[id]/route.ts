import { handle, requireAdmin } from "@/lib/api";
import { deleteMembershipType, updateMembershipType } from "@/lib/verein/members-data";
import { membershipTypePatchSchema } from "@/lib/verein/members-schemas";
import { adminOk, parsePatch, type IdContext } from "../../../../_lib/http";

export const dynamic = "force-dynamic";

export const PATCH = handle(async (req: Request, { params }: IdContext) => {
  const admin = await requireAdmin(req);
  const { id } = await params;
  const patch = await parsePatch(req, membershipTypePatchSchema);
  const updated = await updateMembershipType(admin, id, patch);
  return adminOk({ id: updated.id });
});

/** Löschen nur, wenn die Art nirgends verwendet wird; sonst meldet der Server 409 und man deaktiviert sie. */
export const DELETE = handle(async (req: Request, { params }: IdContext) => {
  const admin = await requireAdmin(req);
  const { id } = await params;
  await deleteMembershipType(admin, id);
  return adminOk({ deleted: true });
});
