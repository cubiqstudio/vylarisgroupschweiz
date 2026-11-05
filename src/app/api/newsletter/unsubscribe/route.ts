import { db } from "@/lib/db";
import { ApiError, assertSameOrigin, handle } from "@/lib/api";
import { tooManyRequests } from "@/lib/account";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { tokenSchema } from "@/lib/validation";
import { adminOk, readJson } from "../../_lib/http";

export const dynamic = "force-dynamic";

const UNKNOWN = "Dieser Abmelde-Link ist nicht (mehr) gültig.";

/**
 * Abmeldung per Token. Zwei Wege:
 *  - Seite /newsletter/unsubscribe: JSON {token} (Same-Origin-Prüfung wie bei allen schreibenden Browser-Requests).
 *  - One-Click (RFC 8058, List-Unsubscribe-Post): POST an die URL mit ?token=… und Form-Body "List-Unsubscribe=One-Click".
 *    Mailanbieter senden dabei serverseitig und ohne passenden Origin; das geheime Token ist hier der Berechtigungsnachweis.
 */
export const POST = handle(async (req: Request) => {
  const limit = rateLimit(`newsletter-unsubscribe:${clientIp(req)}`, 100, 60 * 60 * 1000);
  if (!limit.ok) return tooManyRequests(limit.retryAfter);

  const queryToken = new URL(req.url).searchParams.get("token");
  let candidate: unknown;
  if (queryToken !== null) {
    candidate = { token: queryToken };
  } else {
    assertSameOrigin(req);
    candidate = await readJson(req);
  }

  // Unbekannt/ungültig immer gleich beantworten – keine Details.
  const parsed = tokenSchema.safeParse(candidate);
  if (!parsed.success) throw new ApiError(404, "NOT_FOUND", UNKNOWN);

  const subscriber = await db.newsletterSubscriber.findUnique({ where: { unsubscribeToken: parsed.data.token } });
  if (!subscriber) throw new ApiError(404, "NOT_FOUND", UNKNOWN);

  // Idempotent: wiederholtes Abmelden ändert nichts mehr.
  if (subscriber.status !== "UNSUBSCRIBED") {
    await db.newsletterSubscriber.update({
      where: { id: subscriber.id },
      data: { status: "UNSUBSCRIBED", unsubscribedAt: new Date(), confirmTokenHash: null, confirmExpiresAt: null },
    });
  }

  return adminOk({ status: "unsubscribed" as const });
});
