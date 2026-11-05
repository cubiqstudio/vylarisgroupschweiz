import { db } from "@/lib/db";
import { handle, requireAdmin } from "@/lib/api";
import { adminOk } from "../../_lib/http";

export const dynamic = "force-dynamic";

/** Webspace-Konto-Anträge: ?status=PENDING|APPROVED|REJECTED (ohne Angabe alle, wartende zuerst). */
export const GET = handle(async (req: Request) => {
  await requireAdmin(req);
  const status = new URL(req.url).searchParams.get("status") ?? "";
  const items = await db.webspaceRequest.findMany({
    where: ["PENDING", "APPROVED", "REJECTED"].includes(status) ? { status } : {},
    orderBy: [{ createdAt: "desc" }],
    take: 200,
    select: {
      id: true, status: true, message: true, adminNote: true, createdAt: true, decidedAt: true,
      user: { select: { id: true, name: true, email: true, companyName: true } },
      product: { select: { slug: true, name: true } },
    },
  });
  items.sort((a, b) => Number(b.status === "PENDING") - Number(a.status === "PENDING"));
  return adminOk({ items, pendingTotal: items.filter((i) => i.status === "PENDING").length });
});
