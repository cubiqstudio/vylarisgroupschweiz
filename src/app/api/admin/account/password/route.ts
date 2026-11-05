import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { ApiError, handle, requireAdmin } from "@/lib/api";
import { passwordChangeSchema } from "@/lib/validation";
import { rateLimit, resetRateLimit } from "@/lib/rate-limit";
import { SESSION_COOKIE, sessionCookieOptions, signSession } from "@/lib/session";
import { adminOk, readJson } from "../../../_lib/http";

export const dynamic = "force-dynamic";

const BCRYPT_COST = 12;

export const PATCH = handle(async (req: Request) => {
  const admin = await requireAdmin(req);

  // Schutz gegen Durchprobieren des aktuellen Passworts mit gestohlener Session.
  const key = `pwchange:${admin.id}`;
  const rl = rateLimit(key, 8, 15 * 60 * 1000);
  if (!rl.ok) throw new ApiError(429, "RATE_LIMITED", "Zu viele Versuche. Bitte versuche es später erneut.");

  const { currentPassword, newPassword } = passwordChangeSchema.parse(await readJson(req));

  const user = await db.adminUser.findUnique({ where: { id: admin.id }, select: { passwordHash: true } });
  if (!user) throw new ApiError(401, "UNAUTHORIZED", "Nicht angemeldet.");

  // 422 statt 401, damit der Client einen falschen Wert nicht mit einer abgelaufenen Session verwechselt.
  if (!(await bcrypt.compare(currentPassword, user.passwordHash))) {
    throw new ApiError(422, "VALIDATION_ERROR", "Ungültige Eingabe.", { currentPassword: "Das aktuelle Passwort ist falsch." });
  }
  if (currentPassword === newPassword) {
    throw new ApiError(422, "VALIDATION_ERROR", "Ungültige Eingabe.", {
      newPassword: "Das neue Passwort muss sich vom aktuellen unterscheiden.",
    });
  }

  const updated = await db.adminUser.update({
    where: { id: admin.id },
    data: { passwordHash: await bcrypt.hash(newPassword, BCRYPT_COST), mustChangePassword: false, sessionVersion: { increment: 1 } },
    select: { sessionVersion: true },
  });
  resetRateLimit(key);

  // Andere Sitzungen sind damit ungültig; diese bekommt ein neues Token.
  const res = adminOk({ updated: true });
  res.cookies.set(
    SESSION_COOKIE,
    await signSession({ sub: admin.id, email: admin.email, name: admin.name, role: admin.role, kind: "admin", sv: updated.sessionVersion }),
    sessionCookieOptions("admin"),
  );
  return res;
});
