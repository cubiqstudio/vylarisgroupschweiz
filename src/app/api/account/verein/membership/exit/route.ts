import { handle } from "@/lib/api";
import { rateLimit } from "@/lib/rate-limit";
import { tooManyRequests } from "@/lib/account";
import { requireActiveMember } from "@/lib/verein/guard";
import { declareOwnExit } from "@/lib/verein/members-data";
import { sendExitConfirmed, sendExitNotice } from "@/lib/verein/members-mail";
import { portalExitSchema } from "@/lib/verein/members-schemas";
import { adminOk, readJson } from "../../../../_lib/http";

export const dynamic = "force-dynamic";

/** Austrittserklärung des angemeldeten Mitglieds. Der Termin richtet sich nach den Einstellungen des Vereins (Statuten gehen vor). */
export const POST = handle(async (req: Request) => {
  const { member } = await requireActiveMember(req);
  const rl = rateLimit(`member-exit:${member.id}`, 5, 15 * 60 * 1000);
  if (!rl.ok) return tooManyRequests(rl.retryAfter);
  const input = portalExitSchema.parse(await readJson(req));
  const { member: after, plan } = await declareOwnExit(member, input.reason);
  const [mail] = await Promise.all([sendExitConfirmed(after, plan), sendExitNotice(after, plan)]);
  return adminOk({ noticeAt: plan.noticeAt.toISOString(), effective: plan.effective.toISOString(), mailSent: mail.sent });
});
