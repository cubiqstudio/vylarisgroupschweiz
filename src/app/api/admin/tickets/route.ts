import { db } from "@/lib/db";
import { handle, requireAdmin } from "@/lib/api";
import { TICKET_CATEGORIES, TICKET_STATUSES } from "@/lib/constants";
import { adminOk } from "../../_lib/http";
import { containsCI } from "@/lib/search";

export const dynamic = "force-dynamic";

function intParam(value: string | null, fallback: number, min: number, max: number) {
  const n = Number.parseInt(value ?? "", 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

export const GET = handle(async (req: Request) => {
  await requireAdmin(req);
  const sp = new URL(req.url).searchParams;

  const status = sp.get("status") ?? "";
  const category = sp.get("category") ?? "";
  const q = (sp.get("q") ?? "").trim().slice(0, 100);
  const page = intParam(sp.get("page"), 1, 1, 100_000);
  const pageSize = intParam(sp.get("pageSize"), 25, 1, 100);

  const where = {
    ...((TICKET_STATUSES as readonly string[]).includes(status) ? { status } : {}),
    ...((TICKET_CATEGORIES as readonly string[]).includes(category) ? { category } : {}),
    ...(q
      ? {
          OR: [
            { ticketNumber: containsCI(q) },
            { name: containsCI(q) },
            { email: containsCI(q) },
            { subject: containsCI(q) },
          ],
        }
      : {}),
  };

  const [items, total] = await Promise.all([
    db.contactTicket.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: { assignedTo: { select: { id: true, name: true, avatarType: true } } },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    db.contactTicket.count({ where }),
  ]);

  return adminOk({ items, total, page, pageSize });
});
