import { db } from "@/lib/db";
import { ProductManager } from "./product-manager";
import type { ProductRow } from "./types";

export async function ProductsTab() {
  const rows = await db.product.findMany({
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    include: { _count: { select: { keys: true, webspaceRequests: true } } },
  });
  const products: ProductRow[] = rows.map((p) => ({
    id: p.id,
    slug: p.slug,
    code: p.code,
    name: p.name,
    description: p.description,
    businessOnly: p.businessOnly,
    allowAccountRequest: p.allowAccountRequest,
    approvalMode: p.approvalMode === "MANUAL" ? "MANUAL" : "AUTO",
    comingSoon: p.comingSoon,
    active: p.active,
    sortOrder: p.sortOrder,
    keyCount: p._count.keys,
    requestCount: p._count.webspaceRequests,
  }));
  return <ProductManager products={products} />;
}
