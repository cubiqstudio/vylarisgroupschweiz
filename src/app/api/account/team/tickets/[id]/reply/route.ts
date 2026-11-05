import { ApiError, handle, parseJson } from "@/lib/api";
import { tooManyRequests } from "@/lib/account";
import { isMailConfigured } from "@/lib/mailer";
import { rateLimit } from "@/lib/rate-limit";
import { findTeamTicket, postTicketReply, requireTeamMember } from "@/lib/team";
import { ticketReplySchema } from "@/lib/validation";
import { adminOk, notFound, type IdContext } from "../../../../../_lib/http";

export const dynamic = "force-dynamic";

/** Antwort an den Absender: Autor ist das Teammitglied (Name und Profilbild), Versand über dieselbe Mail-Logik wie im Admin. */
export const POST = handle(async (req: Request, ctx: IdContext) => {
  const user = await requireTeamMember(req);
  const rl = rateLimit(`ticket-reply:${user.id}`, 30, 60 * 60 * 1000);
  if (!rl.ok) return tooManyRequests(rl.retryAfter);

  const { id } = await ctx.params;
  const input = await parseJson(req, ticketReplySchema);

  if (!(await isMailConfigured())) {
    throw new ApiError(409, "MAIL_NOT_CONFIGURED", "Es ist kein Mailserver eingerichtet. Antworten werden per E-Mail versendet – bitte wende dich an einen Administrator.");
  }

  const ticket = await findTeamTicket(id);
  if (!ticket) notFound("Ticket");

  const reply = await postTicketReply(ticket, input.message, { name: user.name.trim() || user.email, userId: user.id });
  return adminOk({ reply, mailSent: reply.mailSent, mailError: reply.mailError }, 201);
});
