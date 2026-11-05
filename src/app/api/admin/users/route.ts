import { db } from "@/lib/db";
import { containsCI } from "@/lib/search";
import { handle, requireAdmin } from "@/lib/api";
import { adminOk } from "../../_lib/http";

export const dynamic = "force-dynamic";

function intParam(value: string | null, fallback: number, min: number, max: number) {
  const n = Number.parseInt(value ?? "", 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

export const GET = handle(async (req: Request) => {
  await requireAdmin(req);
  const sp = new URL(req.url).searchParams;
  const q = (sp.get("q") ?? "").trim().slice(0, 100);
  const page = intParam(sp.get("page"), 1, 1, 100_000);
  const pageSize = intParam(sp.get("pageSize"), 25, 1, 100);

  // Hinweis: `contains` ist unter SQLite case-insensitive (ASCII); PostgreSQL bräuchte `mode: "insensitive"`.
  const where = q ? { OR: [{ name: containsCI(q) }, { email: containsCI(q) }] } : {};

  const [items, total] = await Promise.all([
    db.user.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: { id: true, name: true, email: true, emailVerifiedAt: true, disabled: true, lastLoginAt: true, createdAt: true },
    }),
    db.user.count({ where }),
  ]);

  return adminOk({ items, total, page, pageSize });
});
