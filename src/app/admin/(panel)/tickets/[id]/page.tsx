import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CalendarClock, ChevronLeft, ChevronRight, Hash, Lock, Mail, MessageSquareReply, ShieldAlert, Trash2, UserRound } from "lucide-react";
import { db } from "@/lib/db";
import { requireAdminPage } from "@/lib/auth";
import { isMailConfigured } from "@/lib/mailer";
import { cn, formatDateTime } from "@/lib/utils";
import { buttonClass } from "@/components/ui/button";
import { categoryIcon } from "@/components/contact/ticket-category";
import { Card } from "@/components/ui/card";
import { TicketCategoryBadge, TicketStatusBadge } from "@/components/admin/content/badges";
import { TicketAssignControl, TicketDeleteButton, TicketNoteForm, TicketStatusControl } from "@/components/admin/content/ticket-detail-actions";
import { AssigneeChip } from "@/components/team/assignee";
import { TicketAvatar } from "@/components/admin/content/ticket-avatar";
import { TicketReplyForm } from "@/components/admin/content/ticket-reply-form";
import { TicketThread } from "@/components/admin/content/ticket-thread";
import { formatRelative } from "@/components/admin/content/ticket-format";
import { buildTicketQuery, fullWhere, inboxHref, parseTicketFilters } from "@/components/admin/content/ticket-filters";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Ticket" };

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ from?: string | string[] }>;
};

export default async function AdminTicketDetailPage({ params, searchParams }: Props) {
  await requireAdminPage();
  const { id } = await params;
  const { from } = await searchParams;

  const [ticket, mailConfigured, members] = await Promise.all([
    db.contactTicket.findUnique({
      where: { id },
      include: {
        replies: { orderBy: { createdAt: "asc" }, include: { authorUser: { select: { avatarType: true } } } },
        assignedTo: { select: { id: true, name: true, avatarType: true } },
      },
    }),
    isMailConfigured(),
    // Zuständig kann jedes (nicht gesperrte) Teammitglied sein
    db.user.findMany({ where: { isTeam: true, disabled: false }, orderBy: { name: "asc" }, select: { id: true, name: true, teamTitle: true } }),
  ]);
  if (!ticket) notFound();

  // Inbox-Filter aus ?from= übernehmen (nur bekannte Parameter, niemals ungeprüft weiterreichen).
  const rawFrom = Array.isArray(from) ? from[0] : from;
  const fromParams = Object.fromEntries(new URLSearchParams((rawFrom ?? "").slice(0, 400)));
  const filters = parseTicketFilters(fromParams);
  const fromQuery = buildTicketQuery(filters);
  const backHref = inboxHref(filters);
  const suffix = fromQuery ? `?from=${encodeURIComponent(fromQuery)}` : "";

  const where = fullWhere({ ...filters, page: 1 });
  const [newer, older] = await Promise.all([
    db.contactTicket.findFirst({
      where: { ...where, createdAt: { gt: ticket.createdAt }, id: { not: ticket.id } },
      orderBy: { createdAt: "asc" },
      select: { id: true, ticketNumber: true },
    }),
    db.contactTicket.findFirst({
      where: { ...where, createdAt: { lt: ticket.createdAt }, id: { not: ticket.id } },
      orderBy: { createdAt: "desc" },
      select: { id: true, ticketNumber: true },
    }),
  ]);

  const replySubject = `Re: [${ticket.ticketNumber}] ${ticket.subject.replace(/\s+/g, " ").trim()}`;
  const mailto = `mailto:${encodeURIComponent(ticket.email).replace(/%40/g, "@")}?subject=${encodeURIComponent(replySubject)}`;
  const security = ticket.category === "SECURITY_REPORT";
  const CategoryIcon = categoryIcon(ticket.category);

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <Link href={backHref} className="inline-flex items-center gap-1.5 text-sm text-zinc-400 hover:text-zinc-200">
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Zur Inbox
        </Link>
        <nav aria-label="Ticket-Navigation" className="flex items-center gap-2">
          {newer ? (
            <Link
              href={`/admin/tickets/${newer.id}${suffix}`}
              className={buttonClass("secondary", "sm")}
              title={`Neueres Ticket ${newer.ticketNumber}`}
            >
              <ChevronLeft className="h-4 w-4" aria-hidden />
              Neuer
            </Link>
          ) : (
            <span className={buttonClass("secondary", "sm", "pointer-events-none opacity-50")} aria-disabled="true">
              <ChevronLeft className="h-4 w-4" aria-hidden />
              Neuer
            </span>
          )}
          {older ? (
            <Link
              href={`/admin/tickets/${older.id}${suffix}`}
              className={buttonClass("secondary", "sm")}
              title={`Älteres Ticket ${older.ticketNumber}`}
            >
              Älter
              <ChevronRight className="h-4 w-4" aria-hidden />
            </Link>
          ) : (
            <span className={buttonClass("secondary", "sm", "pointer-events-none opacity-50")} aria-disabled="true">
              Älter
              <ChevronRight className="h-4 w-4" aria-hidden />
            </span>
          )}
        </nav>
      </div>

      <header className="mb-6 flex items-start gap-4">
        <span
          className={cn(
            "hidden size-12 shrink-0 items-center justify-center rounded-2xl ring-1 ring-inset sm:flex",
            security ? "bg-rose-500/10 text-rose-300 ring-rose-500/40" : "bg-emerald-400/10 text-emerald-400 ring-emerald-400/25",
          )}
          aria-hidden
        >
          <CategoryIcon className="size-6" />
        </span>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2.5">
            <span className="font-mono text-sm text-zinc-400">{ticket.ticketNumber}</span>
            <TicketStatusBadge status={ticket.status} />
            <TicketCategoryBadge category={ticket.category} />
          </div>
          <h1 className="mt-3 break-words text-2xl font-semibold tracking-tight text-white sm:text-3xl">{ticket.subject}</h1>
          <p className="mt-2 text-sm text-zinc-500">
            Eingegangen am {formatDateTime(ticket.createdAt)}
            {ticket.updatedAt.getTime() - ticket.createdAt.getTime() > 1000 && <> · Zuletzt geändert {formatRelative(ticket.updatedAt)}</>}
          </p>
        </div>
      </header>

      {security && (
        <div role="note" className="mb-6 flex items-start gap-3 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
          <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <p>Security-Report: Bitte vertraulich behandeln und zeitnah bearbeiten. Zugangsdaten gehören nicht in Antworten.</p>
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_23rem]">
        <div className="space-y-6">
          <TicketThread
            senderName={ticket.name}
            senderEmail={ticket.email}
            message={ticket.message}
            createdAt={ticket.createdAt}
            security={security}
            replies={ticket.replies}
          />

          <Card className="p-5 sm:p-6" id="antworten">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-white">
              <MessageSquareReply className="h-4 w-4 text-emerald-400" aria-hidden />
              Antworten
            </h2>
            <div className="mt-4">
              <TicketReplyForm id={ticket.id} recipientName={ticket.name} mailConfigured={mailConfigured} />
            </div>
          </Card>
        </div>

        <aside className="space-y-6">
          <Card className="p-5">
            <h2 className="mb-4 text-xs font-semibold uppercase tracking-wider text-zinc-500">Status</h2>
            <TicketStatusControl id={ticket.id} status={ticket.status} mailConfigured={mailConfigured} />
          </Card>

          <Card className="p-5">
            <h2 className="mb-4 text-xs font-semibold uppercase tracking-wider text-zinc-500">Zuständig</h2>
            <AssigneeChip user={ticket.assignedTo} size={36} className="mb-3 text-sm" />
            <TicketAssignControl id={ticket.id} assignedToId={ticket.assignedToId} members={members} />
            {members.length === 0 && (
              <p className="mt-2 text-xs text-zinc-500">Es gibt noch keine Teammitglieder. Das Team-Flag vergibst du unter Benutzer.</p>
            )}
          </Card>

          <Card className="p-5">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Absender</h2>
            <div className="mt-4 flex items-center gap-3">
              <TicketAvatar name={ticket.name} className="size-11" />
              <div className="min-w-0">
                <p className="break-words font-semibold text-white">{ticket.name}</p>
                <a href={mailto} className="inline-flex max-w-full items-center gap-1.5 break-all text-sm text-emerald-400 underline-offset-2 hover:underline">
                  <Mail className="h-3.5 w-3.5 shrink-0" aria-hidden />
                  {ticket.email}
                </a>
              </div>
            </div>
            <dl className="mt-4 space-y-2.5 border-t border-zinc-800 pt-4 text-sm">
              <div className="flex items-center justify-between gap-3">
                <dt className="flex items-center gap-1.5 text-zinc-500">
                  <Hash className="h-3.5 w-3.5" aria-hidden />
                  Ticketnummer
                </dt>
                <dd className="font-mono text-zinc-100">{ticket.ticketNumber}</dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="flex items-center gap-1.5 text-zinc-500">
                  <CalendarClock className="h-3.5 w-3.5" aria-hidden />
                  Eingang
                </dt>
                <dd className="text-right text-zinc-100">{formatDateTime(ticket.createdAt)}</dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="flex items-center gap-1.5 text-zinc-500">
                  <UserRound className="h-3.5 w-3.5" aria-hidden />
                  Antworten
                </dt>
                <dd className="text-zinc-100">{ticket.replies.length}</dd>
              </div>
            </dl>
          </Card>

          <Card className="border-amber-500/30 bg-amber-500/[0.04] p-5">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Interne Notiz</h2>
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-xs font-medium text-amber-300 ring-1 ring-inset ring-amber-500/30">
                <Lock className="h-3 w-3" aria-hidden />
                Intern
              </span>
            </div>
            <p className="mb-3 mt-1 text-sm text-zinc-500">Nur für das Team sichtbar, wird nie an den Absender übermittelt.</p>
            <TicketNoteForm id={ticket.id} initialNote={ticket.internalNote} />
          </Card>

          <Card className="p-5">
            <h2 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-zinc-500">
              <Trash2 className="h-3.5 w-3.5" aria-hidden />
              Gefahrenzone
            </h2>
            <p className="mb-4 mt-1 text-sm text-zinc-500">Löscht das Ticket samt Verlauf dauerhaft, z. B. bei Spam.</p>
            <TicketDeleteButton id={ticket.id} ticketNumber={ticket.ticketNumber} backHref={backHref} />
          </Card>
        </aside>
      </div>
    </div>
  );
}
