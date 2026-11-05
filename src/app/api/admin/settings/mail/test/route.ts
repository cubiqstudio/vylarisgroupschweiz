import { ApiError, handle, parseJson, requireAdmin } from "@/lib/api";
import { rateLimit } from "@/lib/rate-limit";
import { getMailConfig } from "@/lib/settings";
import { sendMail } from "@/lib/mailer";
import { mailCtx } from "@/lib/mail-ctx";
import { mailTestSchema } from "@/lib/validation";
import { adminOk } from "../../../../_lib/http";

export const dynamic = "force-dynamic";

/** Sendet eine Testmail mit den GESPEICHERTEN SMTP-Einstellungen. */
export const POST = handle(async (req: Request) => {
  const admin = await requireAdmin(req);
  const rl = rateLimit(`mail-test:${admin.id}`, 10, 60 * 60 * 1000);
  if (!rl.ok) {
    throw new ApiError(429, "RATE_LIMITED", `Zu viele Testmails. Bitte versuche es in ${Math.ceil(rl.retryAfter / 60)} Minuten erneut.`);
  }
  const { to } = await parseJson(req, mailTestSchema);

  const config = await getMailConfig();
  if (!config) {
    throw new ApiError(409, "MAIL_NOT_CONFIGURED", "Es ist noch kein Mailserver gespeichert. Bitte zuerst die SMTP-Einstellungen speichern.");
  }

  const { site } = mailCtx();
  const result = await sendMail({
    to,
    config,
    subject: `Testmail von ${site.name}`,
    text: `Hallo,\n\ndiese Testmail bestätigt, dass der E-Mail-Versand von ${site.name} korrekt eingerichtet ist.\n\nDu musst nichts weiter tun.`,
  });
  if (!result.ok) throw new ApiError(502, "MAIL_SEND_FAILED", result.error);
  return adminOk({ sent: true, to });
});
