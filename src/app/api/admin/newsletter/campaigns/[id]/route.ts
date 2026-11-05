import { db } from "@/lib/db";
import { ApiError, handle, requireAdmin } from "@/lib/api";
import { serializeCampaign } from "@/lib/newsletter";
import { resolveSegmentInput } from "@/lib/verein/newsletter-segment-data";
import { campaignSchema } from "@/lib/validation";
import { adminOk, notFound, parsePatch, type IdContext } from "../../../../_lib/http";

export const dynamic = "force-dynamic";

const FAILURE_LIMIT = 50;

export const GET = handle(async (req: Request, ctx: IdContext) => {
  await requireAdmin(req);
  const { id } = await ctx.params;
  const campaign = await db.newsletterCampaign.findUnique({ where: { id } });
  if (!campaign) notFound("Kampagne");

  const failures =
    campaign.failedCount > 0
      ? await db.newsletterDelivery.findMany({
          where: { campaignId: id, status: "FAILED" },
          orderBy: { id: "asc" },
          take: FAILURE_LIMIT,
          select: { id: true, error: true, subscriber: { select: { email: true } } },
        })
      : [];

  return adminOk({
    ...serializeCampaign(campaign),
    failures: failures.map((f) => ({ id: f.id, email: f.subscriber.email, error: f.error })),
  });
});

export const PATCH = handle(async (req: Request, ctx: IdContext) => {
  await requireAdmin(req);
  const { id } = await ctx.params;
  const patch = await parsePatch(req, campaignSchema.partial());

  const existing = await db.newsletterCampaign.findUnique({ where: { id }, select: { status: true, segment: true, segmentTypeId: true } });
  if (!existing) notFound("Kampagne");
  if (existing.status !== "DRAFT") {
    throw new ApiError(409, "NOT_EDITABLE", "Nur Entwürfe können bearbeitet werden.");
  }

  // Empfängerkreis: gesendete und bisherige Angaben zusammen prüfen (Mitgliedschaftsart nur beim passenden Segment).
  const data: typeof patch = { ...patch };
  if (patch.segment !== undefined || patch.segmentTypeId !== undefined) {
    const selection = await resolveSegmentInput(patch.segment ?? existing.segment, patch.segmentTypeId !== undefined ? patch.segmentTypeId : existing.segmentTypeId);
    data.segment = selection.segment;
    data.segmentTypeId = selection.segmentTypeId;
  }

  // Atomar absichern: zwischen Prüfung und Schreiben könnte der Versand gestartet worden sein.
  const result = await db.newsletterCampaign.updateMany({ where: { id, status: "DRAFT" }, data });
  if (result.count === 0) throw new ApiError(409, "NOT_EDITABLE", "Nur Entwürfe können bearbeitet werden.");
  const campaign = await db.newsletterCampaign.findUnique({ where: { id } });
  if (!campaign) notFound("Kampagne");
  return adminOk(serializeCampaign(campaign));
});

export const DELETE = handle(async (req: Request, ctx: IdContext) => {
  await requireAdmin(req);
  const { id } = await ctx.params;
  const existing = await db.newsletterCampaign.findUnique({ where: { id }, select: { status: true } });
  if (!existing) notFound("Kampagne");
  const result = await db.newsletterCampaign.deleteMany({ where: { id, status: "DRAFT" } });
  if (result.count === 0) throw new ApiError(409, "NOT_DELETABLE", "Nur Entwürfe können gelöscht werden.");
  return adminOk({ id });
});
