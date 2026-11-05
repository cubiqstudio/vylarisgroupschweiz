import { handle } from "@/lib/api";
import { requireUser, tooManyRequests } from "@/lib/account";
import { requestBusiness } from "@/lib/licenses";
import { rateLimit } from "@/lib/rate-limit";
import { businessRequestSchema } from "@/lib/validation-licenses";
import { adminOk, readJson } from "../../_lib/http";

export const dynamic = "force-dynamic";

/** Firmenkunden-Status beantragen (Freigabe durch das Team). */
export const POST = handle(async (req: Request) => {
  const user = await requireUser(req);
  const rl = rateLimit(`business-request:${user.id}`, 5, 60 * 60 * 1000);
  if (!rl.ok) return tooManyRequests(rl.retryAfter);
  const input = businessRequestSchema.parse(await readJson(req));
  return adminOk(await requestBusiness(user.id, input.companyName), 201);
});
