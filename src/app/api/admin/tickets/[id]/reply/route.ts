import { db } from "@/lib/db";
import { ApiError, handle, parseJson, requireAdmin } from "@/lib/api";
import { tooManyRequests } from "@/lib/account";
import { isMailConfigured } from "@/lib/mailer";
import { rateLimit } from "@/lib/rate-limit";
import { postTicketReply } from "@/lib/team";
import { ticketReplySchema } from "@/lib/validation";
import { adminOk, notFound, type IdContext } from "../../../../_lib/http";

export const dynamic = "force-dynamic";

export const POST = handle(async (req: Request, ctx: IdContext) => {
  const admin = await requireAdmin(req);
  const rl = rateLimit(`ticket-reply:${admin.id}`, 30, 60 * 60 * 1000);
  if (!rl.ok) return tooManyRequests(rl.retryAfter);

  const { id } = await ctx.params;
  const input = await parseJson(req, ticketReplySchema);

  if (!(await isMailConfigured())) {
    throw new ApiError(409, "MAIL_NOT_CONFIGURED", "Es ist kein Mailserver eingerichtet. Antworten werden per E-Mail versendet – bitte richte zuerst den Mailversand ein.");
  }

  const ticket = await db.contactTicket.findUnique({ where: { id } });
  if (!ticket) notFound("Ticket");

  // Admin-Konten sind keine Website-Konten und haben kein Profilbild: authorUserId bleibt leer (Initialen im Verlauf).
  const reply = await postTicketReply(ticket, input.message, { name: admin.name.trim() || admin.email, userId: null });

  return adminOk({ reply, mailSent: reply.mailSent, mailError: reply.mailError }, 201);
});
