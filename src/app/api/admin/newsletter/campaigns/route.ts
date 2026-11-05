import { db } from "@/lib/db";
import { handle, parseJson, requireAdmin } from "@/lib/api";
import { serializeCampaign } from "@/lib/newsletter";
import { campaignSchema } from "@/lib/validation";
import { adminOk } from "../../../_lib/http";

export const dynamic = "force-dynamic";

export const GET = handle(async (req: Request) => {
  await requireAdmin(req);
  const campaigns = await db.newsletterCampaign.findMany({ orderBy: { createdAt: "desc" }, take: 200 });
  return adminOk(campaigns.map(serializeCampaign));
});

export const POST = handle(async (req: Request) => {
  await requireAdmin(req);
  const input = await parseJson(req, campaignSchema);
  const campaign = await db.newsletterCampaign.create({
    data: {
      subject: input.subject,
      preheader: input.preheader,
      content: input.content,
      subjectEn: input.subjectEn,
      preheaderEn: input.preheaderEn,
      contentEn: input.contentEn,
      status: "DRAFT",
    },
  });
  return adminOk(serializeCampaign(campaign), 201);
});
