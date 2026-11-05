import { z } from "zod";
import { db } from "@/lib/db";
import { handle, parseJson, requireAdmin } from "@/lib/api";
import { adminOk, notFound, type IdContext } from "../../../../_lib/http";

export const dynamic = "force-dynamic";

const subscriberPatchSchema = z.object({ status: z.enum(["ACTIVE", "UNSUBSCRIBED"]) });

const SELECT = { id: true, email: true, name: true, status: true, consentAt: true, confirmedAt: true, unsubscribedAt: true, createdAt: true } as const;

/** Status manuell setzen. «Aktiv» nur mit nachweisbarer Einwilligung der Person verwenden. */
export const PATCH = handle(async (req: Request, ctx: IdContext) => {
  await requireAdmin(req);
  const { id } = await ctx.params;
  const { status } = await parseJson(req, subscriberPatchSchema);
  const existing = await db.newsletterSubscriber.findUnique({ where: { id }, select: { confirmedAt: true } });
  if (!existing) notFound("Abonnent");

  const now = new Date();
  const subscriber = await db.newsletterSubscriber.update({
    where: { id },
    data:
      status === "ACTIVE"
        ? { status, confirmedAt: existing.confirmedAt ?? now, unsubscribedAt: null, confirmTokenHash: null, confirmExpiresAt: null }
        : { status, unsubscribedAt: now, confirmTokenHash: null, confirmExpiresAt: null },
    select: SELECT,
  });
  return adminOk(subscriber);
});

/** Löschung auf Wunsch der betroffenen Person: entfernt die Person samt Zustellprotokoll. */
export const DELETE = handle(async (req: Request, ctx: IdContext) => {
  await requireAdmin(req);
  const { id } = await ctx.params;
  const result = await db.newsletterSubscriber.deleteMany({ where: { id } });
  if (result.count === 0) notFound("Abonnent");
  return adminOk({ id });
});
