import { handle, requireAdmin } from "@/lib/api";
import { deleteOffice, updateOffice } from "@/lib/verein/members-data";
import { officePatchSchema } from "@/lib/verein/members-schemas";
import { adminOk, parsePatch, type IdContext } from "../../../../_lib/http";

export const dynamic = "force-dynamic";

export const PATCH = handle(async (req: Request, { params }: IdContext) => {
  const admin = await requireAdmin(req);
  const { id } = await params;
  const patch = await parsePatch(req, officePatchSchema);
  const { office, warning } = await updateOffice(admin, id, patch);
  return adminOk({ id: office.id, warning: warning ?? null });
});

export const DELETE = handle(async (req: Request, { params }: IdContext) => {
  const admin = await requireAdmin(req);
  const { id } = await params;
  await deleteOffice(admin, id);
  return adminOk({ deleted: true });
});
