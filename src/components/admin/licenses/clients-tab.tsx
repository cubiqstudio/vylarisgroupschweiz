import { db } from "@/lib/db";
import { ApiClientManager } from "./api-client-manager";
import type { ApiClientRow } from "./types";

export async function ClientsTab() {
  const [rows, products] = await Promise.all([
    db.apiClient.findMany({
      orderBy: { createdAt: "desc" },
      select: { id: true, name: true, tokenHint: true, productSlugs: true, active: true, createdAt: true, lastUsedAt: true, revokedAt: true },
    }),
    db.product.findMany({ orderBy: [{ sortOrder: "asc" }, { name: "asc" }], select: { slug: true, name: true } }),
  ]);
  // Nie das Token oder dessen Hash an den Browser geben, nur den Anfang (tokenHint).
  const clients: ApiClientRow[] = rows.map((c) => ({
    id: c.id,
    name: c.name,
    tokenHint: c.tokenHint,
    productSlugs: c.productSlugs === "*" ? "*" : c.productSlugs.split(",").filter(Boolean),
    active: c.active && !c.revokedAt,
    revoked: Boolean(c.revokedAt),
    createdAt: c.createdAt.toISOString(),
    lastUsedAt: c.lastUsedAt ? c.lastUsedAt.toISOString() : null,
  }));
  return <ApiClientManager clients={clients} products={products} />;
}
