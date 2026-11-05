import { db } from "@/lib/db";
import { ApiError, assertSameOrigin, handle } from "@/lib/api";
import { tokenSchema } from "@/lib/validation";
import { consumeToken } from "@/lib/tokens";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { tooManyRequests } from "@/lib/account";
import { linkAccountByVerifiedEmail } from "@/lib/verein/members-data";
import { adminOk, readJson } from "../../_lib/http";

export const dynamic = "force-dynamic";

const INVALID = "Der Link ist ungültig oder abgelaufen.";

export const POST = handle(async (req: Request) => {
  assertSameOrigin(req);

  const rl = rateLimit(`verify:${clientIp(req)}`, 20, 15 * 60 * 1000);
  if (!rl.ok) return tooManyRequests(rl.retryAfter);

  const parsed = tokenSchema.safeParse(await readJson(req));
  if (!parsed.success) throw new ApiError(400, "INVALID_TOKEN", INVALID);

  const userId = await consumeToken(parsed.data.token, "EMAIL_VERIFY");
  if (!userId) throw new ApiError(400, "INVALID_TOKEN", INVALID);

  // Bereits gesetzte Bestätigungszeitpunkte nicht überschreiben.
  await db.user.updateMany({ where: { id: userId, emailVerifiedAt: null }, data: { emailVerifiedAt: new Date() } });
  // Gehört die bestätigte Adresse einem aktiven Mitglied, das Konto verknüpfen (best effort, nie blockierend).
  try {
    await linkAccountByVerifiedEmail(userId);
  } catch (e) {
    console.error("[verify] Mitglieder-Verknüpfung nicht möglich:", e instanceof Error ? e.name : "unbekannt");
  }
  return adminOk({ verified: true });
});
