import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { ApiError, handle } from "@/lib/api";
import { passwordChangeSchema } from "@/lib/validation";
import { rateLimit } from "@/lib/rate-limit";
import { SESSION_COOKIE, sessionCookieOptions, signSession } from "@/lib/session";
import { hashPassword, requireUser, tooManyRequests } from "@/lib/account";
import { adminOk, readJson } from "../../_lib/http";

export const dynamic = "force-dynamic";

export const PATCH = handle(async (req: Request) => {
  const current = await requireUser(req);

  const rl = rateLimit(`account-password:${current.id}`, 10, 15 * 60 * 1000);
  if (!rl.ok) return tooManyRequests(rl.retryAfter);

  const { currentPassword, newPassword } = passwordChangeSchema.parse(await readJson(req));

  const user = await db.user.findUnique({ where: { id: current.id }, select: { passwordHash: true } });
  if (!user) throw new ApiError(401, "UNAUTHORIZED", "Nicht angemeldet.");
  if (!(await bcrypt.compare(currentPassword, user.passwordHash))) {
    throw new ApiError(403, "INVALID_PASSWORD", "Das aktuelle Passwort ist falsch.", {
      currentPassword: "Das aktuelle Passwort ist falsch.",
    });
  }
  if (currentPassword === newPassword) {
    throw new ApiError(422, "VALIDATION_ERROR", "Das neue Passwort muss sich vom aktuellen unterscheiden.", {
      newPassword: "Das neue Passwort muss sich vom aktuellen unterscheiden.",
    });
  }

  // Sitzungsversion erhöhen: alle anderen Sitzungen (auch gestohlene Cookies) werden ungültig; diese Sitzung bekommt ein neues Token.
  const updated = await db.user.update({
    where: { id: current.id },
    data: { passwordHash: await hashPassword(newPassword), sessionVersion: { increment: 1 } },
    select: { sessionVersion: true },
  });
  const res = adminOk({ changed: true });
  res.cookies.set(
    SESSION_COOKIE,
    await signSession({ sub: current.id, email: current.email, name: current.name, role: "USER", kind: "user", sv: updated.sessionVersion }),
    sessionCookieOptions("user"),
  );
  return res;
});
