import { db } from "@/lib/db";
import { ApiError, assertSameOrigin, handle } from "@/lib/api";
import { resetSchema } from "@/lib/validation";
import { consumeToken } from "@/lib/tokens";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { hashPassword, tooManyRequests } from "@/lib/account";
import { adminOk, readJson } from "../../_lib/http";

export const dynamic = "force-dynamic";

const INVALID = "Der Link ist ungültig oder abgelaufen. Bitte fordere einen neuen an.";

export const POST = handle(async (req: Request) => {
  assertSameOrigin(req);

  const rl = rateLimit(`reset:${clientIp(req)}`, 20, 15 * 60 * 1000);
  if (!rl.ok) return tooManyRequests(rl.retryAfter);

  const parsed = resetSchema.safeParse(await readJson(req));
  if (!parsed.success) {
    // Ein kaputtes Token ist ein Token-Fehler; Passwortregeln melden wir feldgenau, ohne das Token zu verbrauchen.
    const fields: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path.join(".") || "_";
      if (!fields[key]) fields[key] = issue.message;
    }
    if (fields.token) throw new ApiError(400, "INVALID_TOKEN", INVALID);
    throw new ApiError(422, "VALIDATION_ERROR", "Ungültige Eingabe.", fields);
  }
  const { token, password } = parsed.data;

  const userId = await consumeToken(token, "PASSWORD_RESET");
  if (!userId) throw new ApiError(400, "INVALID_TOKEN", INVALID);

  const passwordHash = await hashPassword(password);
  await db.$transaction([
    db.user.update({ where: { id: userId }, data: { passwordHash, sessionVersion: { increment: 1 } } }),
    // Der Reset beweist den Zugriff auf das Postfach.
    db.user.updateMany({ where: { id: userId, emailVerifiedAt: null }, data: { emailVerifiedAt: new Date() } }),
    // Alle weiteren offenen Tokens (auch Bestätigungslinks) entwerten.
    db.authToken.deleteMany({ where: { userId } }),
  ]);
  return adminOk({ reset: true });
});
