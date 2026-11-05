import { handle, requireAdmin } from "@/lib/api";
import { runMemberAction } from "@/lib/verein/members-data";
import { mailAfterAction } from "@/lib/verein/members-mail";
import { memberActionSchema } from "@/lib/verein/members-schemas";
import { adminOk, readJson, type IdContext } from "../../../../_lib/http";

export const dynamic = "force-dynamic";

/**
 * Aktionen auf einem Mitglied: aufnehmen, ablehnen, wieder aufnehmen, Austritt erfassen/zurücknehmen/vollziehen, ausschliessen,
 * als verstorben erfassen, Personendaten entfernen, Website-Konto verknüpfen/lösen. Schreibzugriff auf «Mitglieder» erforderlich.
 */
export const POST = handle(async (req: Request, { params }: IdContext) => {
  const admin = await requireAdmin(req);
  const { id } = await params;
  const input = memberActionSchema.parse(await readJson(req));
  const outcome = await runMemberAction(admin, id, input);
  const mail = await mailAfterAction(outcome);
  return adminOk({
    id: outcome.member.id,
    status: outcome.member.status,
    linked: outcome.linked ?? false,
    plan: outcome.plan ? { noticeAt: outcome.plan.noticeAt.toISOString(), earliest: outcome.plan.earliest.toISOString(), effective: outcome.plan.effective.toISOString() } : null,
    mail,
  });
});
