import { handle, parseJson, requireAdmin } from "@/lib/api";
import { deletePeriod, updatePeriod } from "@/lib/verein/fees-ops";
import { periodUpdateSchema } from "@/lib/verein/fees-schemas";
import { idSchema } from "@/lib/verein/validation";
import { adminOk, type IdContext } from "../../../../_lib/http";

export const dynamic = "force-dynamic";

export const PATCH = handle(async (req: Request, { params }: IdContext) => {
  const admin = await requireAdmin(req);
  const id = idSchema.parse((await params).id);
  const patch = await parseJson(req, periodUpdateSchema);
  await updatePeriod(admin, id, patch);
  return adminOk({ id });
});

export const DELETE = handle(async (req: Request, { params }: IdContext) => {
  const admin = await requireAdmin(req);
  const id = idSchema.parse((await params).id);
  await deletePeriod(admin, id);
  return adminOk({ id });
});
