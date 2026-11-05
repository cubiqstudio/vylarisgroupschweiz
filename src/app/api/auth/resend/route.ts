import { mailCtx } from "@/lib/mail-ctx";
import { db } from "@/lib/db";
import { assertSameOrigin, handle } from "@/lib/api";
import { forgotSchema } from "@/lib/validation";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { runInBackground, sendVerificationMail, tooManyRequests } from "@/lib/account";
import { adminOk, readJson } from "../../_lib/http";

export const dynamic = "force-dynamic";

const WINDOW_MS = 60 * 60 * 1000;

export const POST = handle(async (req: Request) => {
  assertSameOrigin(req);

  const ip = clientIp(req);
  const flood = rateLimit(`resend-any:${ip}`, 20, WINDOW_MS);
  if (!flood.ok) return tooManyRequests(flood.retryAfter);

  const { email } = forgotSchema.parse(await readJson(req));

  const rl = rateLimit(`resend:${ip}:${email}`, 3, WINDOW_MS);
  if (!rl.ok) return tooManyRequests(rl.retryAfter);

  // Versand im Hintergrund: Antwortzeit und -inhalt verraten nicht, ob ein Konto existiert.
  runInBackground(async () => {
    const user = await db.user.findUnique({
      where: { email },
      select: { id: true, email: true, name: true, emailVerifiedAt: true, disabled: true, locale: true },
    });
    if (!user || user.emailVerifiedAt || user.disabled) return;
    await sendVerificationMail(user, mailCtx(user.locale));
  });

  return adminOk({ status: "check_mail" as const });
});
