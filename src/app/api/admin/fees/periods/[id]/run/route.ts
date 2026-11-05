import { handle, parseJson, requireAdmin } from "@/lib/api";
import { runPeriod } from "@/lib/verein/fees-ops";
import { periodRunSchema } from "@/lib/verein/fees-schemas";
import { idSchema } from "@/lib/verein/validation";
import { adminOk, type IdContext } from "../../../../../_lib/http";

export const dynamic = "force-dynamic";

/** Sammelrechnungen für alle aktiven Mitglieder: mit dryRun nur berechnen, sonst als Entwürfe anlegen. */
export const POST = handle(async (req: Request, { params }: IdContext) => {
  const admin = await requireAdmin(req);
  const id = idSchema.parse((await params).id);
  const o = await parseJson(req, periodRunSchema);
  return adminOk(await runPeriod(admin, id, { dryRun: o.dryRun, prorate: o.prorate, roundToFive: o.roundToFive, categoryId: o.categoryId ?? null, issueDate: o.issueDate }));
});
