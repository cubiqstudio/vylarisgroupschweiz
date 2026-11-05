import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { handle, requireAdmin } from "@/lib/api";
import { containsCI } from "@/lib/search";
import { SUBSCRIBER_PAGE_SIZE, SUBSCRIBER_STATUSES } from "@/components/admin/newsletter/types";
import { adminOk } from "../../../_lib/http";

export const dynamic = "force-dynamic";

export const GET = handle(async (req: Request) => {
  await requireAdmin(req);
  const params = new URL(req.url).searchParams;
  const status = params.get("status") ?? "";
  const q = (params.get("q") ?? "").trim().slice(0, 100);
  const page = Math.max(1, Math.min(10_000, Number.parseInt(params.get("page") ?? "1", 10) || 1));

  const where: Prisma.NewsletterSubscriberWhereInput = {};
  if ((SUBSCRIBER_STATUSES as readonly string[]).includes(status)) where.status = status;
  if (q) where.OR = [{ email: containsCI(q) }, { name: containsCI(q) }];

  const [total, items, grouped] = await Promise.all([
    db.newsletterSubscriber.count({ where }),
    db.newsletterSubscriber.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * SUBSCRIBER_PAGE_SIZE,
      take: SUBSCRIBER_PAGE_SIZE,
      select: { id: true, email: true, name: true, status: true, consentAt: true, confirmedAt: true, unsubscribedAt: true, createdAt: true },
    }),
    db.newsletterSubscriber.groupBy({ by: ["status"], _count: { _all: true } }),
  ]);
  const counts = { active: 0, pending: 0, unsubscribed: 0 };
  for (const g of grouped) {
    if (g.status === "ACTIVE") counts.active = g._count._all;
    else if (g.status === "PENDING") counts.pending = g._count._all;
    else if (g.status === "UNSUBSCRIBED") counts.unsubscribed = g._count._all;
  }

  return adminOk({ items, total, page, pageSize: SUBSCRIBER_PAGE_SIZE, counts });
});
