import { z } from "zod";
import { db } from "@/lib/db";
import { ApiError, handle, parseJson, requireAdmin } from "@/lib/api";
import { sendMail } from "@/lib/mailer";
import { mailCtxFor } from "@/lib/mail-ctx";
import { newsletterCampaignMail } from "@/lib/mail-templates";
import { unsubscribeUrl } from "@/lib/newsletter-links";
import { newsletterTestSchema } from "@/lib/validation";
import { pick } from "@/i18n";
import { mail } from "@/i18n/mail";
import { adminOk, notFound, type IdContext } from "../../../../../_lib/http";

export const dynamic = "force-dynamic";

// Optional "locale": "en" verschickt die englische Fassung (Marke VylarisGroupAmerica, Links auf vylaris.net).
const testSchema = newsletterTestSchema.extend({ locale: z.enum(["de", "en"]).optional() });

/** Testmail an eine Adresse: Platzhalter-Name, Beispiel-Abmelde-Link, keine Zustellung wird angelegt. */
export const POST = handle(async (req: Request, ctx: IdContext) => {
  await requireAdmin(req);
  const { id } = await ctx.params;
  const { to, locale: bodyLocale } = await parseJson(req, testSchema);
  const locale = bodyLocale ?? (new URL(req.url).searchParams.get("locale") === "en" ? "en" : "de");
  const campaign = await db.newsletterCampaign.findUnique({ where: { id } });
  if (!campaign) notFound("Kampagne");

  const english = locale === "en";
  if (english && !campaign.contentEn?.trim()) {
    throw new ApiError(409, "NO_TRANSLATION", "Die Kampagne hat keine englische Fassung.");
  }

  const mailCtx = mailCtxFor(english ? "net" : "eu", locale);
  const rendered = newsletterCampaignMail(
    {
      subject: english && campaign.subjectEn?.trim() ? campaign.subjectEn : campaign.subject,
      preheader: english && campaign.preheaderEn?.trim() ? campaign.preheaderEn : campaign.preheader,
      markdown: english ? (campaign.contentEn ?? campaign.content) : campaign.content,
      name: pick(mail, locale).newsletter.testRecipient,
      unsubscribeUrl: unsubscribeUrl("beispiel-abmeldung-nur-test", mailCtx.baseUrl),
    },
    mailCtx,
  );
  const result = await sendMail({ to, ...rendered, subject: `[Test] ${rendered.subject}`.replace(/[\r\n]+/g, " ") });
  if (!result.ok) throw new ApiError(502, "MAIL_FAILED", result.error);
  return adminOk({ sent: true });
});
