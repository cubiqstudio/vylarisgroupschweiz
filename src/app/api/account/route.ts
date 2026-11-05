import bcrypt from "bcryptjs";
import { z } from "zod";
import { db } from "@/lib/db";
import { ApiError, handle } from "@/lib/api";
import { accountUpdateSchema } from "@/lib/validation";
import { SESSION_COOKIE, sessionCookieOptions } from "@/lib/session";
import { rateLimit } from "@/lib/rate-limit";
import { requireUser, tooManyRequests } from "@/lib/account";
import { adminOk, parsePatch, readJson } from "../_lib/http";

export const dynamic = "force-dynamic";

const publicFields = { id: true, email: true, name: true, emailVerifiedAt: true, createdAt: true } as const;

const deleteSchema = z.object({ password: z.string().min(1, "Passwort erforderlich.").max(200) });

export const GET = handle(async (req: Request) => {
  const current = await requireUser(req);
  const user = await db.user.findUnique({ where: { id: current.id }, select: publicFields });
  if (!user) throw new ApiError(401, "UNAUTHORIZED", "Nicht angemeldet.");
  return adminOk({ user });
});

export const PATCH = handle(async (req: Request) => {
  const current = await requireUser(req);
  const patch = await parsePatch(req, accountUpdateSchema);
  const user = await db.user.update({ where: { id: current.id }, data: { name: patch.name }, select: publicFields });
  return adminOk({ user });
});

export const DELETE = handle(async (req: Request) => {
  const current = await requireUser(req);

  const rl = rateLimit(`account-delete:${current.id}`, 5, 15 * 60 * 1000);
  if (!rl.ok) return tooManyRequests(rl.retryAfter);

  const { password } = deleteSchema.parse(await readJson(req));
  const user = await db.user.findUnique({ where: { id: current.id }, select: { passwordHash: true } });
  if (!user) throw new ApiError(401, "UNAUTHORIZED", "Nicht angemeldet.");
  if (!(await bcrypt.compare(password, user.passwordHash))) {
    throw new ApiError(403, "INVALID_PASSWORD", "Das Passwort ist falsch.", { password: "Das Passwort ist falsch." });
  }

  // Tokens werden per Cascade mitgelöscht.
  await db.user.delete({ where: { id: current.id } });

  const res = adminOk({ deleted: true });
  res.cookies.set(SESSION_COOKIE, "", { ...sessionCookieOptions("user"), maxAge: 0 });
  return res;
});
