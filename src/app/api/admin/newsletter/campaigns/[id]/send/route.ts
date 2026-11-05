import { db } from "@/lib/db";
import { handle, requireAdmin } from "@/lib/api";
import { sendCampaign } from "@/lib/newsletter";
import { auditActor, logAuditSafe } from "@/lib/verein/audit";
import { segmentLabel } from "@/lib/verein/newsletter-segment";
import { adminOk, type IdContext } from "../../../../../_lib/http";

export const dynamic = "force-dynamic";

/** Startet den Versand im Hintergrund und antwortet sofort mit 202 und den aktuellen Zählern. Der Versand steht im Änderungsprotokoll. */
export const POST = handle(async (req: Request, ctx: IdContext) => {
  const admin = await requireAdmin(req);
  const { id } = await ctx.params;
  const progress = await sendCampaign(id);
  const campaign = await db.newsletterCampaign.findUnique({ where: { id }, select: { subject: true, segment: true, segmentType: { select: { name: true } } } });
  if (campaign) {
    await logAuditSafe(db, {
      actor: auditActor(admin),
      action: "newsletter.send",
      objectType: "NewsletterCampaign",
      objectId: id,
      summary: `Newsletter «${campaign.subject}» an ${progress.recipientCount} Abonnenten gesendet (${segmentLabel(campaign.segment, campaign.segmentType?.name)})`,
    });
  }
  return adminOk(progress, 202);
});
