import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CalendarPlus, ExternalLink } from "lucide-react";
import { formatDateCh, toDateTimeLocalValue } from "@/lib/verein/dates";
import { getEventDetail } from "@/lib/verein/events-data";
import { formatEventWhen, registrantName } from "@/lib/verein/events-lib";
import { requireModulePage } from "@/lib/verein/guard";
import { canAccess } from "@/lib/verein/permissions";
import { PageTitle } from "@/components/admin/core/page-title";
import { Notice } from "@/components/admin/core/notice";
import { EventActions } from "@/components/admin/events/event-actions";
import { EventForm } from "@/components/admin/events/event-form";
import { visibilityOf } from "@/components/admin/events/event-values";
import { RegistrationManager, type RegistrationDTO } from "@/components/admin/events/registration-manager";
import { EventStatusPill } from "@/components/admin/events/status-pill";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Anlass" };

type Props = { params: Promise<{ id: string }> };

export default async function EventDetailPage({ params }: Props) {
  const admin = await requireModulePage("events");
  const { id } = await params;
  const event = await getEventDetail(id);
  if (!event) notFound();

  const canWrite = canAccess(admin.roles, "events", "write");
  const canSeeContacts = canAccess(admin.roles, "members", "read");
  const now = new Date();
  const started = event.startsAt.getTime() <= now.getTime();
  const published = event.status === "VEROEFFENTLICHT";

  const registrations: RegistrationDTO[] = event.registrations.map((r) => ({
    id: r.id,
    name: registrantName(r),
    isMember: r.member !== null,
    memberNumber: r.member?.memberNumber ?? null,
    email: canSeeContacts ? (r.member ? (r.member.anonymizedAt ? "" : r.member.email) : r.guestEmail) : "",
    seats: r.seats,
    status: r.status,
    note: r.note,
    createdAt: formatDateCh(r.createdAt),
    attended: r.attendedAt !== null,
    promoted: r.promotedAt !== null,
    reminded: r.reminderSentAt !== null,
  }));
  const activeCount = registrations.filter((r) => r.status !== "ABGESAGT").length;
  const unreminded = event.registrations.filter((r) => r.status === "ANGEMELDET" && r.reminderSentAt === null).length;

  return (
    <div>
      <PageTitle
        title={event.title}
        description={
          <span className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5">
            <EventStatusPill status={event.status} />
            <span>{formatEventWhen(event.startsAt, event.endsAt)}</span>
          </span>
        }
      >
        <Link href="/admin/events" className="inline-flex items-center gap-1.5 text-sm font-medium text-zinc-400 hover:text-white">
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Zur Liste
        </Link>
      </PageTitle>

      <div className="space-y-8">
        {event.status === "ENTWURF" && <Notice variant="info">Dieser Anlass ist ein Entwurf. Besucher und Mitglieder sehen ihn erst, wenn du ihn veröffentlichst.</Notice>}
        {event.status === "ABGESAGT" && <Notice variant="warning">Dieser Anlass ist abgesagt. Er erscheint mit dem Hinweis «Abgesagt» auf der Website und im Kalender-Feed.</Notice>}
        {published && started && <Notice variant="info">Der Anlass hat begonnen. Anmeldungen sind nicht mehr möglich, die Anwesenheit kannst du unten abhaken.</Notice>}

        {canWrite && (
          <EventActions
            event={{
              id: event.id,
              title: event.title,
              status: event.status,
              startsAtLocal: toDateTimeLocalValue(event.startsAt),
              started,
              activeRegistrations: activeCount,
              unremindedRegistrations: unreminded,
            }}
          />
        )}

        <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
          {event.isPublic && event.status !== "ENTWURF" && (
            <Link href={`/anlaesse/${event.id}`} className="inline-flex items-center gap-1.5 text-emerald-400 underline underline-offset-4 hover:text-emerald-300" target="_blank" rel="noopener">
              <ExternalLink className="h-4 w-4" aria-hidden />
              Öffentliche Seite ansehen
            </Link>
          )}
          {event.isPublic && event.status !== "ENTWURF" && (
            <a href={`/anlaesse/${event.id}/termin.ics`} className="inline-flex items-center gap-1.5 text-emerald-400 underline underline-offset-4 hover:text-emerald-300">
              <CalendarPlus className="h-4 w-4" aria-hidden />
              Kalendereintrag (.ics)
            </a>
          )}
        </div>

        <EventForm
          mode="edit"
          eventId={event.id}
          readOnly={!canWrite}
          notifiable={published && !started && activeCount > 0}
          initial={{
            title: event.title,
            description: event.description,
            location: event.location,
            startsAt: toDateTimeLocalValue(event.startsAt),
            endsAt: event.endsAt ? toDateTimeLocalValue(event.endsAt) : "",
            capacity: event.capacity === null ? "" : String(event.capacity),
            registrationDeadline: event.registrationDeadline ? toDateTimeLocalValue(event.registrationDeadline) : "",
            visibility: visibilityOf(event.isPublic, event.membersOnly),
          }}
        />

        <RegistrationManager eventId={event.id} eventTitle={event.title} capacity={event.capacity} cancelled={event.status === "ABGESAGT"} canWrite={canWrite} canExport={canSeeContacts} registrations={registrations} />
      </div>
    </div>
  );
}
