import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { ApiError, assertSameOrigin, handle } from "@/lib/api";
import { runInBackground, tooManyRequests } from "@/lib/account";
import { sendMail } from "@/lib/mailer";
import { mailCtx } from "@/lib/mail-ctx";
import { newsletterConfirmMail } from "@/lib/mail-templates";
import { confirmUrl, hashToken, newToken, unsubscribeUrl } from "@/lib/newsletter-links";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { getMailConfig, getNewsletterEnabled } from "@/lib/settings";
import { newsletterSubscribeSchema } from "@/lib/validation";
import { adminOk, readJson } from "../../_lib/http";

export const dynamic = "force-dynamic";

const HOUR = 60 * 60 * 1000;
const CONFIRM_TTL_MS = 48 * HOUR;

// Antwort ist IMMER identisch (neu, bereits angemeldet, ausstehend, abgemeldet) – verrät nichts über bestehende Adressen.
const checkMail = () => adminOk({ status: "check_mail" as const });

export const POST = handle(async (req: Request) => {
  assertSameOrigin(req);

  const ipLimit = rateLimit(`newsletter-subscribe:ip:${clientIp(req)}`, 5, HOUR);
  if (!ipLimit.ok) return tooManyRequests(ipLimit.retryAfter);

  const raw = await readJson(req);

  // Honeypot: Bots füllen das versteckte Feld. Gleiche Antwort wie bei Erfolg, aber nichts speichern.
  if (typeof raw === "object" && raw !== null && typeof (raw as Record<string, unknown>).website === "string" && (raw as Record<string, unknown>).website !== "") {
    return checkMail();
  }

  // Nur aktiv, wenn Mailversand eingerichtet UND der Newsletter im Dashboard eingeschaltet ist.
  const [enabled, mailConfig] = await Promise.all([getNewsletterEnabled(), getMailConfig()]);
  if (!enabled || !mailConfig) {
    throw new ApiError(403, "NEWSLETTER_DISABLED", "Der Newsletter ist derzeit nicht verfügbar.");
  }

  const input = newsletterSubscribeSchema.parse(raw);

  const emailLimit = rateLimit(`newsletter-subscribe:email:${input.email}`, 3, HOUR);
  if (!emailLimit.ok) return tooManyRequests(emailLimit.retryAfter);

  // Sprache der Anmeldung (wird am Abonnenten gespeichert) und feste Basis-URL für Bestätigungs- und Abmelde-Links.
  const ctx = mailCtx();
  const origin = { locale: ctx.locale };

  const now = new Date();
  const confirmToken = newToken();
  const pending = {
    status: "PENDING",
    confirmTokenHash: hashToken(confirmToken),
    confirmExpiresAt: new Date(now.getTime() + CONFIRM_TTL_MS),
  };

  const existing = await db.newsletterSubscriber.findUnique({ where: { email: input.email } });

  let unsubscribeToken: string | null = null;
  if (!existing) {
    unsubscribeToken = newToken();
    try {
      await db.newsletterSubscriber.create({
        data: { email: input.email, name: input.name, ...pending, ...origin, unsubscribeToken, consentAt: now },
      });
    } catch (e) {
      // Parallele Anmeldung mit derselben Adresse: die andere Anfrage hat gewonnen – nach aussen ändert sich nichts.
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") return checkMail();
      throw e;
    }
  } else if (existing.status === "PENDING" || existing.status === "UNSUBSCRIBED") {
    // Ausstehend: neues Token + Mail erneut. Abgemeldet: neue Einwilligung nötig → wieder ausstehend.
    unsubscribeToken = existing.unsubscribeToken;
    await db.newsletterSubscriber.update({
      where: { id: existing.id },
      data: {
        ...pending,
        ...origin,
        name: input.name || existing.name,
        consentAt: now,
        confirmedAt: null,
        unsubscribedAt: null,
      },
    });
  }
  // Bereits aktiv: keine Statusänderung und keine Mail.

  if (unsubscribeToken) {
    const mail = newsletterConfirmMail(
      {
        name: input.name,
        confirmUrl: confirmUrl(confirmToken, ctx.baseUrl),
        unsubscribeUrl: unsubscribeUrl(unsubscribeToken, ctx.baseUrl),
      },
      ctx,
    );
    runInBackground(async () => {
      const result = await sendMail({ to: input.email, ...mail, config: mailConfig });
      // Nur die Fehlerbeschreibung protokollieren – niemals Token, Links oder Adressen.
      if (!result.ok) console.error("[newsletter] Bestätigungsmail nicht versendet:", result.error);
    });
  }

  return checkMail();
});
