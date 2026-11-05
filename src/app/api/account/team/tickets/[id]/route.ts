import { db } from "@/lib/db";
import { ApiError, handle } from "@/lib/api";
import { sendTicketStatusMail } from "@/lib/ticket-mail";
import { findTeamTicket, requireTeamMember, teamTicketUpdateSchema } from "@/lib/team";
import { adminOk, notFound, parsePatch, type IdContext } from "../../../../_lib/http";

export const dynamic = "force-dynamic";

/** Ein Ticket samt Verlauf. Security-Reports existieren für Teammitglieder nicht (404). */
export const GET = handle(async (req: Request, ctx: IdContext) => {
  await requireTeamMember(req);
  const { id } = await ctx.params;
  const visible = await findTeamTicket(id);
  if (!visible) notFound("Ticket");

  const ticket = await db.contactTicket.findUnique({
    where: { id },
    include: {
      replies: {
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          message: true,
          author: true,
          authorUserId: true,
          mailSent: true,
          mailError: true,
          createdAt: true,
          authorUser: { select: { avatarType: true } },
        },
      },
      assignedTo: { select: { id: true, name: true, avatarType: true } },
    },
  });
  if (!ticket) notFound("Ticket");
  return adminOk(ticket);
});

/** Status, interne Notiz und Zuständigkeit ändern (zuweisen nur an sich selbst, freigeben mit null). */
export const PATCH = handle(async (req: Request, ctx: IdContext) => {
  const user = await requireTeamMember(req);
  const { id } = await ctx.params;
  const { notify, ...data } = await parsePatch(req, teamTicketUpdateSchema);

  const before = await findTeamTicket(id);
  if (!before) notFound("Ticket");

  if (data.assignedToId !== undefined) {
    if (data.assignedToId && data.assignedToId !== user.id) {
      throw new ApiError(403, "FORBIDDEN", "Du kannst ein Ticket nur dir selbst zuweisen oder freigeben.");
    }
    // Zuständigkeit eines Kollegen nicht übernehmen oder aufheben (das kann nur ein Admin).
    if (before.assignedToId && before.assignedToId !== user.id) {
      throw new ApiError(403, "FORBIDDEN", "Dieses Ticket ist bereits einem Kollegen zugewiesen.");
    }
  }

  const ticket = await db.contactTicket.update({ where: { id }, data });

  // Statusmail nur, wenn der Status tatsächlich geändert wurde und der Versand ausdrücklich gewünscht ist.
  if (notify === true && data.status !== undefined && data.status !== before.status) {
    const result = await sendTicketStatusMail(ticket);
    return adminOk({ ...ticket, mailSent: result.ok, mailError: result.ok ? "" : result.error });
  }
  return adminOk(ticket);
});
