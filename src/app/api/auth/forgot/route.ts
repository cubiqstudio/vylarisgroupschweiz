import { getRequestMailCtx } from "@/lib/mail-ctx";
import { db } from "@/lib/db";
import { assertSameOrigin, handle } from "@/lib/api";
import { forgotSchema } from "@/lib/validation";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { runInBackground, sendResetMail, tooManyRequests } from "@/lib/account";
import { adminOk, readJson } from "../../_lib/http";

export const dynamic = "force-dynamic";

const WINDOW_MS = 60 * 60 * 1000;

export const POST = handle(async (req: Request) => {
  assertSameOrigin(req);

  const ip = clientIp(req);
  const flood = rateLimit(`forgot-any:${ip}`, 20, WINDOW_MS);
  if (!flood.ok) return tooManyRequests(flood.retryAfter);

  const { email } = forgotSchema.parse(await readJson(req));

  const rl = rateLimit(`forgot:${ip}:${email}`, 3, WINDOW_MS);
  if (!rl.ok) return tooManyRequests(rl.retryAfter);
  // Begrenzt Mails an ein einzelnes Postfach, auch wenn sie von vielen IPs ausgelöst werden.
  const perMail = rateLimit(`forgot-email:${email}`, 5, WINDOW_MS);
  if (!perMail.ok) return tooManyRequests(perMail.retryAfter);

  // Nur für bestehende, bestätigte, nicht gesperrte Website-Konten (nie für Admins).
  // Versand im Hintergrund, damit die Antwortzeit nichts verrät.
  runInBackground(async () => {
    const user = await db.user.findUnique({
      where: { email },
      select: { id: true, email: true, name: true, emailVerifiedAt: true, disabled: true, siteKey: true, locale: true },
    });
    if (!user || !user.emailVerifiedAt || user.disabled) return;
    await sendResetMail(user, await getRequestMailCtx());
  });

  return adminOk({ status: "check_mail" as const });
});
