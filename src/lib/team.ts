// Zugriff und gemeinsame Bausteine für die Ticket-Bearbeitung durch Teammitglieder (Website-Konten mit Team-Flag).
import "server-only";
import { notFound } from "next/navigation";
import type { ContactTicket, TicketReply } from "@prisma/client";
import { z } from "zod";
import { db } from "@/lib/db";
import { ApiError, assertSameOrigin } from "@/lib/api";
import { getCurrentUser, type CurrentUser } from "@/lib/auth";
import { sendTicketReply } from "@/lib/ticket-mail";
import { ticketUpdateSchema } from "@/lib/validation";
import { teamVisibleWhere } from "@/components/team/team-filters";

/**
 * Pflicht für alle /api/account/team/*-Handler: gültige Sitzung eines Website-Kontos, das (laut DB) Teammitglied und nicht gesperrt ist.
 * Die Middleware prüft nur, ob eine Sitzung existiert; die Team-Zugehörigkeit wird hier bei jeder Anfrage gegen die DB geprüft.
 */
export async function requireTeamMember(req: Request): Promise<CurrentUser> {
  assertSameOrigin(req);
  const user = await getCurrentUser(); // prüft Existenz, Sperre und E-Mail-Bestätigung in der DB
  if (!user) throw new ApiError(401, "UNAUTHORIZED", "Nicht angemeldet.");
  if (!user.isTeam) throw new ApiError(403, "FORBIDDEN", "Dieser Bereich ist Teammitgliedern vorbehalten.");
  return user;
}

/** Für Seiten unter /account/team: Nicht-Teammitglieder sehen 404, der Bereich verrät sich nicht. */
export async function requireTeamPage(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user || !user.isTeam) notFound();
  return user;
}

/** Ticket für Teammitglieder; Tickets ausgeblendeter Kategorien (Security-Reports) gibt es für sie nicht. */
export function findTeamTicket(id: string) {
  return db.contactTicket.findFirst({ where: { id, ...teamVisibleWhere } });
}

/** Nur existierende, nicht gesperrte Teammitglieder dürfen Tickets bearbeiten. */
export async function isAssignableUser(userId: string): Promise<boolean> {
  const u = await db.user.findFirst({ where: { id: userId, isTeam: true, disabled: false }, select: { id: true } });
  return !!u;
}

/** Zuständigkeit: Konto-ID oder null (Niemand). */
export const assignedToIdField = z.string().trim().min(1).max(64).nullable().optional();

/** PATCH-Body im Team-Bereich: wie im Admin, plus Zuständigkeit (Teammitglieder dürfen nur sich selbst zuweisen oder freigeben). */
export const teamTicketUpdateSchema = ticketUpdateSchema.extend({ assignedToId: assignedToIdField });

/**
 * Antwort speichern, per E-Mail an den Absender senden (gemeinsame Mail-Logik aus ticket-mail.ts), Zustellstatus festhalten
 * und ein offenes Ticket auf "In Bearbeitung" setzen. Gemeinsam genutzt vom Admin- und vom Team-Bereich.
 */
export async function postTicketReply(
  ticket: ContactTicket,
  message: string,
  author: { name: string; userId: string | null },
): Promise<TicketReply> {
  const created = await db.ticketReply.create({
    data: { ticketId: ticket.id, message, author: author.name, authorUserId: author.userId },
  });

  const result = await sendTicketReply(ticket, message, created.author);
  const reply = await db.ticketReply.update({
    where: { id: created.id },
    data: { mailSent: result.ok, mailError: result.ok ? "" : result.error },
  });

  // Eine Antwort bedeutet: das Ticket wird bearbeitet.
  if (ticket.status === "OPEN") {
    await db.contactTicket.updateMany({ where: { id: ticket.id, status: "OPEN" }, data: { status: "IN_PROGRESS" } });
  }
  return reply;
}

/** Kennzahlen für Team-Startseite und Ticketliste: offene Tickets insgesamt und mir zugewiesene, noch nicht geschlossene (ohne Security-Reports). */
export async function teamTicketCounts(userId: string): Promise<{ open: number; mineOpen: number }> {
  const [open, mineOpen] = await Promise.all([
    db.contactTicket.count({ where: { ...teamVisibleWhere, status: "OPEN" } }),
    db.contactTicket.count({ where: { ...teamVisibleWhere, assignedToId: userId, status: { not: "CLOSED" } } }),
  ]);
  return { open, mineOpen };
}
