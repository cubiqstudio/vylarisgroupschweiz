import { handle } from "@/lib/api";
import { requireUser, tooManyRequests } from "@/lib/account";
import { getLicenseOverview, requestKey } from "@/lib/licenses";
import { rateLimit } from "@/lib/rate-limit";
import { keyRequestSchema } from "@/lib/validation-licenses";
import { adminOk, readJson } from "../../_lib/http";

export const dynamic = "force-dynamic";

/** Dashboard-Daten: Produkte mit Berechtigung, eigene Schlüssel/Anträge, Firmenkunden-Status. */
export const GET = handle(async (req: Request) => {
  const user = await requireUser(req);
  return adminOk(await getLicenseOverview(user.id));
});

/** Schlüssel beantragen (je Produkt nur einer). */
export const POST = handle(async (req: Request) => {
  const user = await requireUser(req);
  const rl = rateLimit(`license-request:${user.id}`, 10, 60 * 60 * 1000);
  if (!rl.ok) return tooManyRequests(rl.retryAfter);
  const input = keyRequestSchema.parse(await readJson(req));
  return adminOk(await requestKey(user.id, input.product, input.message), 201);
});
