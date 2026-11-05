import { z } from "zod";
import { handle, parseJson, requireAdmin } from "@/lib/api";
import { mailCtxFor } from "@/lib/mail-ctx";
import { newsletterCampaignMail } from "@/lib/mail-templates";
import { unsubscribeUrl } from "@/lib/newsletter-links";
import { pick } from "@/i18n";
import { mail } from "@/i18n/mail";
import { adminOk } from "../../../_lib/http";

export const dynamic = "force-dynamic";

// Bewusst großzügiger als campaignSchema: die Vorschau soll auch bei unfertigem Text funktionieren.
const previewSchema = z.object({
  subject: z.string().trim().max(150).default(""),
  preheader: z.string().trim().max(200).default(""),
  content: z.string().max(100_000).default(""),
  // Sprache der Vorschau: "en" rendert die englische Fassung (Marke VylarisGroupAmerica, Links auf vylaris.net)
  locale: z.enum(["de", "en"]).optional(),
});

export const POST = handle(async (req: Request) => {
  await requireAdmin(req);
  const input = await parseJson(req, previewSchema);
  const queryLocale = new URL(req.url).searchParams.get("locale");
  const locale = input.locale ?? (queryLocale === "en" ? "en" : "de");
  const ctx = mailCtxFor(locale === "en" ? "net" : "eu", locale);
  const m = pick(mail, locale).newsletter;
  const rendered = newsletterCampaignMail(
    {
      subject: input.subject || m.previewSubject,
      preheader: input.preheader,
      markdown: input.content,
      name: m.testRecipient,
      unsubscribeUrl: unsubscribeUrl("beispiel-abmeldung-nur-vorschau", ctx.baseUrl),
    },
    ctx,
  );
  return adminOk({ subject: rendered.subject, html: rendered.html, text: rendered.text });
});
