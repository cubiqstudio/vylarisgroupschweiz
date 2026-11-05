import Link from "next/link";
import { ArrowRight, Clock, MapPin } from "lucide-react";
import { DateBadge } from "@/components/verein/events/event-parts";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Container } from "@/components/ui/section";
import { getMessages } from "@/i18n/server";
import { vereinAnlaesse } from "@/i18n/verein-anlaesse";
import { listPublicUpcoming } from "@/lib/verein/events-data";
import { formatEventWhen } from "@/lib/verein/events-lib";
import { cn } from "@/lib/utils";

/**
 * Block «Kommende Anlässe» für die Startseite (Server-Komponente). Zeigt die nächsten öffentlichen Anlässe
 * und verschwindet ganz, wenn es keine gibt. Einbinden: `<UpcomingEvents />` (optional `limit`, Standard 3).
 */
export async function UpcomingEvents({ limit = 3, className }: { limit?: number; className?: string }) {
  let events: Awaited<ReturnType<typeof listPublicUpcoming>> = [];
  try {
    events = await listPublicUpcoming(limit);
  } catch {
    return null; // Ein Fehler bei den Anlässen darf die Startseite nicht verhindern.
  }
  if (events.length === 0) return null;
  const m = (await getMessages(vereinAnlaesse)).upcoming;

  return (
    <section className={cn("py-16 sm:py-20", className)} aria-labelledby="upcoming-events-heading">
      <Container>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <h2 id="upcoming-events-heading" className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">
            {m.heading}
          </h2>
          <ButtonLink href="/anlaesse" variant="ghost" size="sm">
            {m.all}
            <ArrowRight className="size-4" aria-hidden />
          </ButtonLink>
        </div>
        <ul className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {events.map((e) => {
            const cancelled = e.status === "ABGESAGT";
            return (
              <li key={e.id}>
                <Card className="relative h-full p-5 transition-colors focus-within:border-zinc-600 hover:border-zinc-700">
                  <div className="flex items-start gap-4">
                    <DateBadge date={e.startsAt} muted={cancelled} />
                    <div className="min-w-0 space-y-1.5">
                      <h3 className={cn("text-base font-semibold [overflow-wrap:anywhere]", cancelled ? "text-zinc-400 line-through decoration-zinc-600" : "text-white")}>
                        <Link href={`/anlaesse/${encodeURIComponent(e.id)}`} className="after:absolute after:inset-0 hover:text-emerald-300 focus-visible:outline-none">
                          {e.title}
                        </Link>
                      </h3>
                      <p className="flex items-start gap-2 text-sm text-zinc-400">
                        <Clock className="mt-0.5 size-4 shrink-0 text-zinc-500" aria-hidden />
                        <span>{formatEventWhen(e.startsAt, e.endsAt)}</span>
                      </p>
                      {e.location && (
                        <p className="flex items-start gap-2 text-sm text-zinc-400">
                          <MapPin className="mt-0.5 size-4 shrink-0 text-zinc-500" aria-hidden />
                          <span className="[overflow-wrap:anywhere]">{e.location}</span>
                        </p>
                      )}
                    </div>
                  </div>
                </Card>
              </li>
            );
          })}
        </ul>
      </Container>
    </section>
  );
}
