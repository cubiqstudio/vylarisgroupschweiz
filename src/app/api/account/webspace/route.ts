import { handle } from "@/lib/api";
import { requireUser, tooManyRequests } from "@/lib/account";
import { requestWebspaceAccount } from "@/lib/licenses";
import { rateLimit } from "@/lib/rate-limit";
import { keyRequestSchema } from "@/lib/validation-licenses";
import { adminOk, readJson } from "../../_lib/http";

export const dynamic = "force-dynamic";

/** Konto für den Webspace beantragen (alle, die keinen Firmenkunden-Schlüssel bekommen). */
export const POST = handle(async (req: Request) => {
  const user = await requireUser(req);
  const rl = rateLimit(`webspace-request:${user.id}`, 10, 60 * 60 * 1000);
  if (!rl.ok) return tooManyRequests(rl.retryAfter);
  const input = keyRequestSchema.parse(await readJson(req));
  const r = await requestWebspaceAccount(user.id, input.product, input.message);
  return adminOk({ status: r.status, message: r.message, adminNote: r.adminNote, createdAt: r.createdAt }, 201);
});
