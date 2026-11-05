import { ApiError, handle, requireAdmin } from "@/lib/api";
import { db } from "@/lib/db";
import { invitationOverview, sendInvitations } from "@/lib/verein/meetings-data";
import { invitationSendSchema } from "@/lib/verein/meetings-schemas";
import { idSchema } from "@/lib/verein/validation";
import { requireAdminModule } from "@/lib/verein/guard";
import { adminOk, readJson, type IdContext } from "../../../../_lib/http";

export const dynamic = "force-dynamic";

/** Empfänger, Fristprüfung und Versandprotokoll. */
export const GET = handle(async (req: Request, ctx: IdContext) => {
  await requireAdmin(req);
  await requireAdminModule(req, "members", "read"); // die Empfängerliste ist eine Mitgliederliste
  const id = idSchema.parse((await ctx.params).id);
  const m = await db.meeting.findUnique({ where: { id }, select: { id: true, kind: true, startsAt: true, invitationSentAt: true } });
  if (!m) throw new ApiError(404, "NOT_FOUND", "Sitzung nicht gefunden.");
  const includeNonVoting = new URL(req.url).searchParams.get("alle") === "1";
  const o = await invitationOverview(m, { includeNonVoting });
  return adminOk({
    timing: { state: o.timing.state, text: o.timing.text, latest: o.timing.latest?.toISOString() ?? null },
    blockedByMissingSetting: o.blockedByMissingSetting,
    recipients: o.recipients.map((r) => ({ memberId: r.memberId, name: r.name, channel: r.channel, rsvp: r.rsvp })),
  });
});

/** Einladung oder Erinnerung versenden (Frist wird geprüft; bei Unterschreitung nur mit Bestätigung). */
export const POST = handle(async (req: Request, ctx: IdContext) => {
  const admin = await requireAdmin(req);
  await requireAdminModule(req, "members", "read");
  const id = idSchema.parse((await ctx.params).id);
  const input = invitationSendSchema.parse(await readJson(req));
  return adminOk(await sendInvitations(admin, id, input));
});
