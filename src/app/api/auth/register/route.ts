import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { ApiError, assertSameOrigin, handle } from "@/lib/api";
import { registerSchema } from "@/lib/validation";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { getRequestMailCtx } from "@/lib/mail-ctx";
import {
  hashPassword,
  isRegistrationAvailable,
  sendAccountExistsMail,
  sendVerificationMail,
  tooManyRequests,
} from "@/lib/account";
import { adminOk, readJson } from "../../_lib/http";

export const dynamic = "force-dynamic";

const LIMIT = 5;
const FLOOD_LIMIT = 30;
const PER_EMAIL_LIMIT = 3;
const WINDOW_MS = 60 * 60 * 1000;

const checkMail = () => adminOk({ status: "check_mail" as const }, 201);

export const POST = handle(async (req: Request) => {
  assertSameOrigin(req);

  const ip = clientIp(req);
  const flood = rateLimit(`register-any:${ip}`, FLOOD_LIMIT, WINDOW_MS);
  if (!flood.ok) return tooManyRequests(flood.retryAfter);

  const body = await readJson(req);
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    throw new ApiError(400, "BAD_JSON", "Der Body muss ein JSON-Objekt sein.");
  }

  // Honeypot: Bots füllen das versteckte Feld "website". Wir tun so, als wäre alles gut – ohne zu speichern.
  const trap = (body as Record<string, unknown>).website;
  if (typeof trap === "string" && trap !== "") return checkMail();

  if (!(await isRegistrationAvailable())) {
    throw new ApiError(403, "REGISTRATION_DISABLED", "Die Registrierung ist derzeit nicht verfügbar.");
  }

  const input = registerSchema.parse(body);

  const ipLimit = rateLimit(`register:${ip}`, LIMIT, WINDOW_MS);
  if (!ipLimit.ok) return tooManyRequests(ipLimit.retryAfter);
  // Schützt Postfächer Dritter davor, per Registrierung mit Mails überschüttet zu werden.
  const mailLimit = rateLimit(`register-email:${input.email}`, PER_EMAIL_LIMIT, WINDOW_MS);
  if (!mailLimit.ok) return tooManyRequests(mailLimit.retryAfter);

  // Der bcrypt-Hash wird immer berechnet (auch wenn das Konto schon existiert), damit die Antwortzeit nichts verrät.
  const passwordHash = await hashPassword(input.password);

  // Domain und Sprache der Registrierung: Bestätigungslink und Mails führen auf diese Seite.
  const mailCtx = await getRequestMailCtx();

  const [existing, admin] = await Promise.all([
    db.user.findUnique({
      where: { email: input.email },
      select: { id: true, email: true, name: true, emailVerifiedAt: true, disabled: true, siteKey: true, locale: true },
    }),
    db.adminUser.findUnique({ where: { email: input.email }, select: { id: true } }),
  ]);

  const mailFailed = () =>
    new ApiError(
      502,
      "MAIL_FAILED",
      "Die E-Mail konnte gerade nicht versendet werden. Bitte versuche es in ein paar Minuten erneut.",
    );

  if (admin) {
    // Bestehendes Konto: nichts verändern, identisch antworten.
    const sent = await sendAccountExistsMail({ email: input.email }, mailCtx);
    if (!sent.ok) throw mailFailed();
    return checkMail();
  }

  if (existing) {
    if (existing.disabled) return checkMail();
    const sent = existing.emailVerifiedAt
      ? await sendAccountExistsMail({ email: existing.email, name: existing.name }, mailCtx)
      : await sendVerificationMail(existing, mailCtx);
    if (!sent.ok) throw mailFailed();
    return checkMail();
  }

  let created: { id: string; email: string; name: string };
  try {
    created = await db.user.create({
      data: { email: input.email, name: input.name, passwordHash, siteKey: mailCtx.site.key, locale: mailCtx.locale },
      select: { id: true, email: true, name: true },
    });
  } catch (e) {
    // Parallele Registrierung mit derselben Adresse: wie ein bestehendes Konto behandeln.
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") return checkMail();
    throw e;
  }

  const sent = await sendVerificationMail(created, mailCtx);
  if (!sent.ok) throw mailFailed();
  return checkMail();
});
