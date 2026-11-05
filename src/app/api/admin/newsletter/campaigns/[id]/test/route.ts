import { db } from "@/lib/db";
import { ApiError, handle, parseJson, requireAdmin } from "@/lib/api";
import { sendMail } from "@/lib/mailer";
import { mailCtx } from "@/lib/mail-ctx";
import { newsletterCampaignMail } from "@/lib/mail-templates";
import { unsubscribeUrl } from "@/lib/newsletter-links";
import { newsletterTestSchema } from "@/lib/validation";
import { pick } from "@/i18n";
import { mail } from "@/i18n/mail";
import { adminOk, notFound, type IdContext } from "../../../../../_lib/http";

export const dynamic = "force-dynamic";

/** Testmail an eine Adresse: Platzhalter-Name, Beispiel-Abmelde-Link, keine Zustellung wird angelegt. */
export const POST = handle(async (req: Request, ctx: IdContext) => {
  await requireAdmin(req);
  const { id } = await ctx.params;
  const { to } = await parseJson(req, newsletterTestSchema);
  const campaign = await db.newsletterCampaign.findUnique({ where: { id } });
  if (!campaign) notFound("Kampagne");

  const context = mailCtx();
  const rendered = newsletterCampaignMail(
    {
      subject: campaign.subject,
      preheader: campaign.preheader,
      markdown: campaign.content,
      name: pick(mail, context.locale).newsletter.testRecipient,
      unsubscribeUrl: unsubscribeUrl("beispiel-abmeldung-nur-test", context.baseUrl),
    },
    context,
  );
  const result = await sendMail({ to, ...rendered, subject: `[Test] ${rendered.subject}`.replace(/[\r\n]+/g, " ") });
  if (!result.ok) throw new ApiError(502, "MAIL_FAILED", result.error);
  return adminOk({ sent: true });
});
