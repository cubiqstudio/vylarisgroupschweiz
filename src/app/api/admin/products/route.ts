import { db } from "@/lib/db";
import { handle, requireAdmin } from "@/lib/api";
import { productSchema } from "@/lib/validation-licenses";
import { adminOk, readJson } from "../../_lib/http";

export const dynamic = "force-dynamic";

export const GET = handle(async (req: Request) => {
  await requireAdmin(req);
  const products = await db.product.findMany({
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    include: { _count: { select: { keys: true, webspaceRequests: true } } },
  });
  return adminOk(products);
});

export const POST = handle(async (req: Request) => {
  await requireAdmin(req);
  const input = productSchema.parse(await readJson(req));
  const product = await db.product.create({
    data: input,
  });
  return adminOk(product, 201);
});
