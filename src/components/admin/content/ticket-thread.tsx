import { AlertTriangle, CheckCircle2, Mail } from "lucide-react";
import { cn, formatDateTime } from "@/lib/utils";
import { Avatar } from "@/components/account/avatar";
import { TicketAvatar } from "./ticket-avatar";
import { formatRelative } from "./ticket-format";

export type ThreadReply = {
  id: string;
  message: string;
  author: string;
  /** Website-Konto des Teammitglieds (für das Profilbild); fehlt bei Antworten aus dem Admin-Bereich */
  authorUserId?: string | null;
  authorUser?: { avatarType: string | null } | null;
  mailSent: boolean;
  mailError: string;
  createdAt: Date;
};

function Time({ date }: { date: Date }) {
  return (
    <time dateTime={date.toISOString()} title={formatDateTime(date)} className="text-xs text-zinc-500">
      {formatDateTime(date)} <span className="text-zinc-500">· {formatRelative(date)}</span>
    </time>
  );
}

function MailStatus({ sent, error }: { sent: boolean; error: string }) {
  if (sent) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-green-500/10 px-2 py-0.5 text-xs font-medium text-green-800 ring-1 ring-inset ring-green-600/30">
        <CheckCircle2 className="h-3 w-3" aria-hidden />
        E-Mail gesendet
      </span>
    );
  }
  return (
    <span className="inline-flex max-w-full items-start gap-1 rounded-full bg-rose-500/10 px-2 py-0.5 text-xs font-medium text-rose-300 ring-1 ring-inset ring-rose-500/30">
      <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" aria-hidden />
      <span className="min-w-0 break-words">Nicht zugestellt{error ? `: ${error}` : ""}</span>
    </span>
  );
}

/** Konversationsverlauf: ursprüngliche Nachricht + Antworten (alles ausschließlich als Text, nie als HTML). */
export function TicketThread({
  senderName,
  senderEmail,
  message,
  createdAt,
  security,
  replies,
}: {
  senderName: string;
  senderEmail: string;
  message: string;
  createdAt: Date;
  security: boolean;
  replies: ThreadReply[];
}) {
  return (
    <section aria-labelledby="ticket-thread-heading" className="space-y-4">
      <h2 id="ticket-thread-heading" className="sr-only">
        Verlauf
      </h2>

      <article className="flex gap-3 sm:gap-4" aria-label={`Nachricht von ${senderName}`}>
        <TicketAvatar name={senderName} />
        <div
          className={cn(
            "min-w-0 flex-1 rounded-2xl rounded-tl-sm border bg-surface p-4 shadow-sm shadow-slate-900/5 sm:p-5",
            security ? "border-rose-500/40" : "border-zinc-800",
          )}
        >
          <header className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
            <p className="min-w-0 break-words text-sm font-semibold text-white">
              {senderName}
              <span className="ml-2 break-all text-xs font-normal text-zinc-500">{senderEmail}</span>
            </p>
            <Time date={createdAt} />
          </header>
          <p className="mt-3 whitespace-pre-wrap break-words text-[0.9375rem] leading-relaxed text-zinc-200">{message}</p>
        </div>
      </article>

      {replies.length > 0 && (
        <ol className="space-y-4" aria-label={`${replies.length} ${replies.length === 1 ? "Antwort" : "Antworten"}`}>
          {replies.map((r) => (
            <li key={r.id}>
              <article className="flex flex-row-reverse gap-3 sm:gap-4 sm:pl-10" aria-label={`Antwort von ${r.author}`}>
                <Avatar name={r.author} userId={r.authorUserId ?? undefined} hasImage={!!r.authorUser?.avatarType} size={40} />
                <div className="min-w-0 flex-1 rounded-2xl rounded-tr-sm border border-emerald-400/25 bg-emerald-400/[0.06] p-4 sm:p-5">
                  <header className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                    <p className="min-w-0 break-words text-sm font-semibold text-white">
                      {r.author}
                      <span className="ml-2 inline-flex items-center gap-1 text-xs font-normal text-zinc-500">
                        <Mail className="h-3 w-3" aria-hidden />
                        Antwort an den Absender
                      </span>
                    </p>
                    <Time date={r.createdAt} />
                  </header>
                  <p className="mt-3 whitespace-pre-wrap break-words text-[0.9375rem] leading-relaxed text-zinc-200">{r.message}</p>
                  <footer className="mt-3">
                    <MailStatus sent={r.mailSent} error={r.mailError} />
                  </footer>
                </div>
              </article>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
