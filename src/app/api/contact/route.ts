import { db } from "@/lib/db";
import { ApiError, assertSameOrigin, fail, handle, ok } from "@/lib/api";
import { contactSchema } from "@/lib/validation";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { generateTicketNumber, uniqueTicketNumber } from "@/lib/ticket";
import { runInBackground } from "@/lib/account";
import { getRequestMailCtx } from "@/lib/mail-ctx";
import { notifyNewTicket, sendTicketConfirmation } from "@/lib/ticket-mail";
import { readJson } from "../_lib/http";

export const dynamic = "force-dynamic";

const LIMIT = 5;
const FLOOD_LIMIT = 60;
const WINDOW_MS = 60 * 60 * 1000;

export const POST = handle(async (req: Request) => {
  assertSameOrigin(req);

  const ip = clientIp(req);
  // Grobes Limit gegen Flooding mit (auch ungültigen) Anfragen; das strenge Limit greift erst nach der Validierung,
  // damit Tippfehler echte Nutzer nicht für eine Stunde aussperren.
  const flood = rateLimit(`contact-any:${ip}`, FLOOD_LIMIT, WINDOW_MS);
  if (!flood.ok) {
    return fail(429, "RATE_LIMITED", "Zu viele Anfragen. Bitte versuche es später erneut.", undefined, {
      "Retry-After": String(flood.retryAfter),
      "Cache-Control": "no-store",
    });
  }

  const body = await readJson(req);
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    throw new ApiError(400, "BAD_JSON", "Der Body muss ein JSON-Objekt sein.");
  }

  // Honeypot: Bots füllen das versteckte Feld "website". Wir tun so, als wäre alles gut – ohne zu speichern.
  const trap = (body as Record<string, unknown>).website;
  if (typeof trap === "string" && trap !== "") {
    return ok({ ticketNumber: generateTicketNumber() }, 201, { headers: { "Cache-Control": "no-store" } });
  }

  const input = contactSchema.parse(body);

  const rl = rateLimit(`contact:${ip}`, LIMIT, WINDOW_MS);
  if (!rl.ok) {
    return fail(429, "RATE_LIMITED", "Zu viele Anfragen. Bitte versuche es später erneut.", undefined, {
      "Retry-After": String(rl.retryAfter),
      "Cache-Control": "no-store",
    });
  }
  const ticketNumber = await uniqueTicketNumber();
  // Domain und Sprache der Anfrage: Bestätigung, Status- und Antwort-Mails folgen dieser Seite.
  const mailCtx = await getRequestMailCtx();

  // "consent" und "website" werden bewusst nicht gespeichert; der Nachrichteninhalt wird nicht geloggt.
  const ticket = await db.contactTicket.create({
    data: {
      ticketNumber,
      name: input.name,
      email: input.email,
      subject: input.subject,
      category: input.category,
      message: input.message,
      siteKey: mailCtx.site.key,
      locale: mailCtx.locale,
    },
  });

  // Bestätigung an den Absender und Hinweis an das Team: im Hintergrund, die Antwort wird nicht verzögert.
  // Die Funktionen werfen nie; ohne Mailserver bzw. bei deaktivierter Einstellung passiert einfach nichts.
  runInBackground(() => Promise.allSettled([sendTicketConfirmation(ticket), notifyNewTicket(ticket)]));

  return ok({ ticketNumber }, 201, { headers: { "Cache-Control": "no-store" } });
});
