import { db } from "@/lib/db";
import { handle, requireAdmin } from "@/lib/api";
import { createApiClient } from "@/lib/licenses";
import { apiClientCreateSchema } from "@/lib/validation-licenses";
import { adminOk, readJson } from "../../_lib/http";

export const dynamic = "force-dynamic";

export const GET = handle(async (req: Request) => {
  await requireAdmin(req);
  const items = await db.apiClient.findMany({
    orderBy: { createdAt: "desc" },
    select: { id: true, name: true, tokenHint: true, productSlugs: true, active: true, createdAt: true, lastUsedAt: true, revokedAt: true },
  });
  return adminOk(items);
});

/** Legt einen API-Zugang an. Token und Signierschlüssel werden NUR in dieser Antwort ausgegeben. */
export const POST = handle(async (req: Request) => {
  await requireAdmin(req);
  const input = apiClientCreateSchema.parse(await readJson(req));
  const { client, token, signingKey } = await createApiClient(input.name, input.productSlugs);
  return adminOk({ id: client.id, name: client.name, productSlugs: client.productSlugs, token, signingKey }, 201);
});
