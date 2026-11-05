import { db } from "@/lib/db";
import { containsCI } from "@/lib/search";
import { handle, requireAdmin } from "@/lib/api";
import { adminOk } from "../../_lib/http";

export const dynamic = "force-dynamic";

const PAGE = 25;
const STATUSES = ["PENDING", "ACTIVE", "REVOKED", "REJECTED"];

/** Liste der Schlüssel (ohne Klartext): ?status=&product=&q=&page= – q sucht in Name, E-Mail und den letzten 4 Zeichen. */
export const GET = handle(async (req: Request) => {
  await requireAdmin(req);
  const sp = new URL(req.url).searchParams;
  const status = sp.get("status") ?? "";
  const product = (sp.get("product") ?? "").slice(0, 60);
  const q = (sp.get("q") ?? "").trim().slice(0, 100);
  const page = Math.max(1, Number.parseInt(sp.get("page") ?? "1", 10) || 1);
  const where = {
    ...(STATUSES.includes(status) && { status }),
    ...(product && { product: { slug: product } }),
    ...(q && { OR: [{ keyHint: { contains: q.toUpperCase() } }, { user: { email: containsCI(q) } }, { user: { name: containsCI(q) } }, { user: { companyName: containsCI(q) } }] }),
  };
  const [total, items, pending] = await Promise.all([
    db.licenseKey.count({ where }),
    db.licenseKey.findMany({
      where,
      orderBy: [{ createdAt: "desc" }],
      skip: (page - 1) * PAGE,
      take: PAGE,
      select: {
        id: true, keyHint: true, status: true, message: true, adminNote: true, boundInstance: true, boundAt: true, createdAt: true,
        decidedAt: true, lastVerifiedAt: true, verifyCount: true,
        user: { select: { id: true, name: true, email: true, businessStatus: true, companyName: true } },
        product: { select: { slug: true, name: true } },
      },
    }),
    db.licenseKey.count({ where: { status: "PENDING" } }),
  ]);
  return adminOk({ items, total, page, pageSize: PAGE, pendingTotal: pending });
});
