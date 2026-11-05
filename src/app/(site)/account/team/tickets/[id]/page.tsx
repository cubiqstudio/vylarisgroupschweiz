import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CalendarClock, Hash, Lock, Mail, MessageSquareReply, UserRound } from "lucide-react";
import { db } from "@/lib/db";
import { findTeamTicket, requireTeamPage } from "@/lib/team";
import { isMailConfigured } from "@/lib/mailer";
import { cn, formatDateTime } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { Container } from "@/components/ui/section";
import { categoryIcon } from "@/components/contact/ticket-category";
import { ToastProvider } from "@/components/admin/core/toast";
import { TicketCategoryBadge, TicketStatusBadge } from "@/components/admin/content/badges";
import { TicketAssignControl, TicketNoteForm, TicketStatusControl } from "@/components/admin/content/ticket-detail-actions";
import { TicketAvatar } from "@/components/admin/content/ticket-avatar";
import { TicketReplyForm } from "@/components/admin/content/ticket-reply-form";
import { TicketThread } from "@/components/admin/content/ticket-thread";
import { formatRelative } from "@/components/admin/content/ticket-format";
import { AssigneeChip } from "@/components/team/assignee";
import { parseTeamFilters, teamTicketsHref } from "@/components/team/team-filters";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Ticket – Team-Bereich", robots: { index: false, follow: false } };

const API_BASE = "/api/account/team/tickets";

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ from?: string | string[] }>;
};

export default async function TeamTicketDetailPage({ params, searchParams }: Props) {
  const user = await requireTeamPage();
  const { id } = await params;
  const { from } = await searchParams;

  // Security-Reports sind für Teammitglieder unsichtbar: gleiche 404 wie bei einem unbekannten Ticket.
  const visible = await findTeamTicket(id);
  if (!visible) notFound();

  const [ticket, mailConfigured] = await Promise.all([
    db.contactTicket.findUnique({
      where: { id },
      include: {
        replies: { orderBy: { createdAt: "asc" }, include: { authorUser: { select: { avatarType: true } } } },
        assignedTo: { select: { id: true, name: true, avatarType: true } },
      },
    }),
    isMailConfigured(),
  ]);
  if (!ticket) notFound();

  // Listenfilter aus ?from= übernehmen (nur bekannte Parameter, niemals ungeprüft weiterreichen).
  const rawFrom = Array.isArray(from) ? from[0] : from;
  const backHref = teamTicketsHref(parseTeamFilters(Object.fromEntries(new URLSearchParams((rawFrom ?? "").slice(0, 400)))));

  const replySubject = `Re: [${ticket.ticketNumber}] ${ticket.subject.replace(/\s+/g, " ").trim()}`;
  const mailto = `mailto:${encodeURIComponent(ticket.email).replace(/%40/g, "@")}?subject=${encodeURIComponent(replySubject)}`;
  const CategoryIcon = categoryIcon(ticket.category);

  return (
    <ToastProvider>
      <Container className="py-10 sm:py-14">
        <div className="mb-5">
          <Link href={backHref} className="inline-flex items-center gap-1.5 text-sm text-zinc-400 hover:text-zinc-200">
            <ArrowLeft className="h-4 w-4" aria-hidden />
            Zur Ticketliste
          </Link>
        </div>

        <header className="mb-6 flex items-start gap-4">
          <span
            className="hidden size-12 shrink-0 items-center justify-center rounded-2xl bg-emerald-400/10 text-emerald-400 ring-1 ring-inset ring-emerald-400/25 sm:flex"
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
            <h2 className="mt-3 break-words text-2xl font-semibold tracking-tight text-white sm:text-3xl">{ticket.subject}</h2>
            <p className="mt-2 text-sm text-zinc-500">
              Eingegangen am {formatDateTime(ticket.createdAt)}
              {ticket.updatedAt.getTime() - ticket.createdAt.getTime() > 1000 && <> · Zuletzt geändert {formatRelative(ticket.updatedAt)}</>}
            </p>
          </div>
        </header>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_21rem]">
          <div className="space-y-6">
            <TicketThread
              senderName={ticket.name}
              senderEmail={ticket.email}
              message={ticket.message}
              createdAt={ticket.createdAt}
              security={false}
              replies={ticket.replies}
            />

            <Card className="p-5 sm:p-6" id="antworten">
              <h3 className="flex items-center gap-2 text-sm font-semibold text-white">
                <MessageSquareReply className="h-4 w-4 text-emerald-400" aria-hidden />
                Antworten
              </h3>
              <p className="mt-1 text-xs text-zinc-500">Die Antwort geht per E-Mail an den Absender und erscheint mit deinem Namen und Profilbild im Verlauf.</p>
              <div className="mt-4">
                <TicketReplyForm id={ticket.id} recipientName={ticket.name} mailConfigured={mailConfigured} apiBase={API_BASE} settingsHref={null} />
              </div>
            </Card>
          </div>

          <aside className="space-y-6">
            <Card className="p-5">
              <h3 className="mb-4 text-xs font-semibold uppercase tracking-wider text-zinc-500">Zuständig</h3>
              <AssigneeChip user={ticket.assignedTo} size={36} className="mb-3 text-sm" />
              <TicketAssignControl id={ticket.id} assignedToId={ticket.assignedToId} meId={user.id} apiBase={API_BASE} />
            </Card>

            <Card className="p-5">
              <h3 className="mb-4 text-xs font-semibold uppercase tracking-wider text-zinc-500">Status</h3>
              <TicketStatusControl id={ticket.id} status={ticket.status} mailConfigured={mailConfigured} apiBase={API_BASE} />
            </Card>

            <Card className="p-5">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Absender</h3>
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

            <Card className={cn("border-amber-500/30 bg-amber-500/[0.04] p-5")}>
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Interne Notiz</h3>
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-xs font-medium text-amber-300 ring-1 ring-inset ring-amber-500/30">
                  <Lock className="h-3 w-3" aria-hidden />
                  Intern
                </span>
              </div>
              <p className="mb-3 mt-1 text-sm text-zinc-500">Nur für das Team sichtbar, wird nie an den Absender übermittelt.</p>
              <TicketNoteForm id={ticket.id} initialNote={ticket.internalNote} apiBase={API_BASE} />
            </Card>
          </aside>
        </div>
      </Container>
    </ToastProvider>
  );
}
