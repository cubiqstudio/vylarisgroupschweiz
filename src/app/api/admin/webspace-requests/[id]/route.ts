import { handle, requireAdmin } from "@/lib/api";
import { decideWebspace } from "@/lib/licenses";
import { webspaceActionSchema } from "@/lib/validation-licenses";
import { adminOk, readJson, type IdContext } from "../../../_lib/http";

export const dynamic = "force-dynamic";

export const PATCH = handle(async (req: Request, { params }: IdContext) => {
  await requireAdmin(req);
  const { id } = await params;
  const { action, adminNote } = webspaceActionSchema.parse(await readJson(req));
  const row = await decideWebspace(id, action, adminNote);
  return adminOk({ id: row.id, status: row.status, adminNote: row.adminNote });
});
