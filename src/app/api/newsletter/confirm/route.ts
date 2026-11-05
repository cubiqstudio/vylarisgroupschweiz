import { db } from "@/lib/db";
import { ApiError, assertSameOrigin, handle } from "@/lib/api";
import { tooManyRequests } from "@/lib/account";
import { hashToken } from "@/lib/newsletter-links";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { tokenSchema } from "@/lib/validation";
import { adminOk, readJson } from "../../_lib/http";

export const dynamic = "force-dynamic";

const INVALID = "Der Link ist ungültig oder abgelaufen.";

export const POST = handle(async (req: Request) => {
  assertSameOrigin(req);

  const limit = rateLimit(`newsletter-confirm:${clientIp(req)}`, 20, 15 * 60 * 1000);
  if (!limit.ok) return tooManyRequests(limit.retryAfter);

  const parsed = tokenSchema.safeParse(await readJson(req));
  if (!parsed.success) throw new ApiError(400, "INVALID_TOKEN", INVALID);

  const confirmTokenHash = hashToken(parsed.data.token);
  const subscriber = await db.newsletterSubscriber.findUnique({ where: { confirmTokenHash } });
  if (!subscriber || subscriber.status !== "PENDING" || !subscriber.confirmExpiresAt || subscriber.confirmExpiresAt.getTime() < Date.now()) {
    throw new ApiError(400, "INVALID_TOKEN", INVALID);
  }

  // Token einmalig verbrauchen: bei parallelem Doppelklick gewinnt genau eine Anfrage.
  const { count } = await db.newsletterSubscriber.updateMany({
    where: { id: subscriber.id, confirmTokenHash, status: "PENDING" },
    data: { status: "ACTIVE", confirmedAt: new Date(), confirmTokenHash: null, confirmExpiresAt: null, unsubscribedAt: null },
  });
  if (count === 0) throw new ApiError(400, "INVALID_TOKEN", INVALID);

  return adminOk({ status: "confirmed" as const });
});
