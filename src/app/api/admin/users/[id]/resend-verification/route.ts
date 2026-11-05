import { db } from "@/lib/db";
import { ApiError, handle, requireAdmin } from "@/lib/api";
import { sendVerificationMail } from "@/lib/account";
import { isMailConfigured } from "@/lib/mailer";
import { rateLimit } from "@/lib/rate-limit";
import { adminOk, notFound, type IdContext } from "../../../../_lib/http";

export const dynamic = "force-dynamic";

export const POST = handle(async (req: Request, { params }: IdContext) => {
  const admin = await requireAdmin(req);
  const { id } = await params;

  const rl = rateLimit(`resend-verification:${admin.id}`, 30, 60 * 60 * 1000);
  if (!rl.ok) {
    throw new ApiError(429, "RATE_LIMITED", `Zu viele Anfragen. Bitte versuche es in ${Math.ceil(rl.retryAfter / 60)} Minuten erneut.`);
  }

  const user = await db.user.findUnique({ where: { id }, select: { id: true, email: true, name: true, emailVerifiedAt: true, locale: true } });
  if (!user) notFound("Nutzer");
  if (user.emailVerifiedAt) throw new ApiError(409, "ALREADY_VERIFIED", "Die E-Mail-Adresse ist bereits bestätigt.");
  if (!(await isMailConfigured())) {
    throw new ApiError(409, "MAIL_NOT_CONFIGURED", "Zuerst E-Mail einrichten (Einstellungen → E-Mail).");
  }

  const result = await sendVerificationMail({ id: user.id, email: user.email, name: user.name, locale: user.locale });
  if (!result.ok) throw new ApiError(502, "MAIL_SEND_FAILED", result.error);
  return adminOk({ sent: true });
});
