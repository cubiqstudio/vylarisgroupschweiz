import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { ApiError, assertSameOrigin, fail, handle } from "@/lib/api";
import { loginSchema } from "@/lib/validation";
import { SESSION_COOKIE, sessionCookieOptions, signSession } from "@/lib/session";
import { clientIp, rateLimit, resetRateLimit } from "@/lib/rate-limit";
import { adminOk, readJson } from "../../_lib/http";

export const dynamic = "force-dynamic";

// Konstanter bcrypt-Hash (cost 12) für Timing-Gleichheit bei unbekannten Nutzern.
const DUMMY_HASH = "$2b$12$mwOZ3ak7lVWZQoplegz08eN8xdzUvYTJPqsDSy.triEQm9KpmaGAm";

const MAX_ATTEMPTS = 8;
const WINDOW_MS = 15 * 60 * 1000;
const INVALID = "E-Mail oder Passwort falsch.";

function tooMany(retryAfter: number) {
  return fail(
    429,
    "RATE_LIMITED",
    "Zu viele Anmeldeversuche. Bitte versuche es später erneut.",
    undefined,
    { "Retry-After": String(retryAfter), "Cache-Control": "no-store" },
  );
}

export const POST = handle(async (req: Request) => {
  assertSameOrigin(req);

  const ip = clientIp(req);
  const ipKey = `login:ip:${ip}`;
  const ipLimit = rateLimit(ipKey, MAX_ATTEMPTS, WINDOW_MS);
  if (!ipLimit.ok) return tooMany(ipLimit.retryAfter);

  const { email, password } = loginSchema.parse(await readJson(req));

  // Zusätzlich je Konto (unabhängig von der IP): Durchprobieren von vielen Adressen aus verteilten Quellen bremst auch dieses Limit.
  const acctLimit = rateLimit(`login:acct:${email}`, MAX_ATTEMPTS * 3, WINDOW_MS);
  if (!acctLimit.ok) return tooMany(acctLimit.retryAfter);

  const pairKey = `login:pair:${ip}:${email}`;
  const pairLimit = rateLimit(pairKey, MAX_ATTEMPTS, WINDOW_MS);
  if (!pairLimit.ok) return tooMany(pairLimit.retryAfter);

  const admin = await db.adminUser.findUnique({
    where: { email },
    select: { id: true, email: true, name: true, role: true, mustChangePassword: true, passwordHash: true, sessionVersion: true },
  });
  const account = admin
    ? null
    : await db.user.findUnique({
        where: { email },
        select: { id: true, email: true, name: true, passwordHash: true, disabled: true, emailVerifiedAt: true, sessionVersion: true },
      });

  // Immer genau ein bcrypt-Vergleich, damit die Antwortzeit nichts über die Existenz des Kontos verrät.
  const valid = await bcrypt.compare(password, admin?.passwordHash ?? account?.passwordHash ?? DUMMY_HASH);
  if ((!admin && !account) || !valid) throw new ApiError(401, "INVALID_CREDENTIALS", INVALID);

  // Ab hier ist das Passwort korrekt – Zustandshinweise verraten nichts mehr Unbefugten.
  if (account) {
    if (account.disabled) throw new ApiError(403, "ACCOUNT_DISABLED", "Dein Konto ist gesperrt. Bitte kontaktiere uns.");
    if (!account.emailVerifiedAt) {
      throw new ApiError(403, "EMAIL_NOT_VERIFIED", "Bitte bestätige zuerst deine E-Mail-Adresse (Link in der Bestätigungsmail).");
    }
  }

  const kind = admin ? "admin" : "user";
  const who = (admin ?? account)!;
  if (admin) await db.adminUser.update({ where: { id: admin.id }, data: { lastLoginAt: new Date() } });
  else await db.user.update({ where: { id: who.id }, data: { lastLoginAt: new Date() } });

  const token = await signSession({
    sub: who.id,
    email: who.email,
    name: who.name,
    role: admin ? admin.role : "USER",
    kind,
    sv: who.sessionVersion,
  });
  resetRateLimit(pairKey);
  resetRateLimit(ipKey);

  const res = adminOk({
    user: {
      id: who.id,
      email: who.email,
      name: who.name,
      kind,
      ...(admin ? { role: admin.role, mustChangePassword: admin.mustChangePassword } : { role: "USER" }),
    },
    redirect: admin ? "/admin" : "/account",
  });
  res.cookies.set(SESSION_COOKIE, token, sessionCookieOptions(kind));
  return res;
});
