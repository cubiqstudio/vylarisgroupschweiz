import { db } from "@/lib/db";
import { ApiError, handle, requireAdmin } from "@/lib/api";
import { ticketUpdateSchema } from "@/lib/validation";
import { sendTicketStatusMail } from "@/lib/ticket-mail";
import { assignedToIdField, isAssignableUser } from "@/lib/team";
import { adminOk, notFound, parsePatch, type IdContext } from "../../../_lib/http";

export const dynamic = "force-dynamic";

/** Wie das Standard-Schema, plus Zuständigkeit (Teammitglied oder null = Niemand). */
const adminTicketUpdateSchema = ticketUpdateSchema.extend({ assignedToId: assignedToIdField });

export const GET = handle(async (req: Request, ctx: IdContext) => {
  await requireAdmin(req);
  const { id } = await ctx.params;
  const ticket = await db.contactTicket.findUnique({
    where: { id },
    include: {
      // Verlauf: älteste zuerst, neueste zuletzt
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

export const PATCH = handle(async (req: Request, ctx: IdContext) => {
  await requireAdmin(req);
  const { id } = await ctx.params;
  const { notify, ...data } = await parsePatch(req, adminTicketUpdateSchema);

  const before = await db.contactTicket.findUnique({ where: { id }, select: { status: true } });
  if (!before) notFound("Ticket");

  // Zuständig kann nur ein existierendes, nicht gesperrtes Teammitglied sein (oder niemand).
  if (data.assignedToId && !(await isAssignableUser(data.assignedToId))) {
    throw new ApiError(422, "VALIDATION_ERROR", "Ungültige Eingabe.", { assignedToId: "Bitte ein vorhandenes, nicht gesperrtes Teammitglied wählen." });
  }

  const ticket = await db.contactTicket.update({ where: { id }, data });

  // Statusmail nur, wenn der Status tatsächlich geändert wurde und der Versand ausdrücklich gewünscht ist.
  if (notify === true && data.status !== undefined && data.status !== before.status) {
    const result = await sendTicketStatusMail(ticket);
    return adminOk({ ...ticket, mailSent: result.ok, mailError: result.ok ? "" : result.error });
  }
  return adminOk(ticket);
});

export const DELETE = handle(async (req: Request, ctx: IdContext) => {
  await requireAdmin(req);
  const { id } = await ctx.params;
  // Antworten werden per Cascade mitgelöscht.
  await db.contactTicket.delete({ where: { id } });
  return adminOk({ id });
});
