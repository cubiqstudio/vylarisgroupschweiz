import Link from "next/link";
import { ArrowRight, CalendarDays, FileText, Gavel, Inbox, ListChecks, Plus, Receipt, Settings, UserPlus, Users, Wallet } from "lucide-react";
import { Card } from "@/components/ui/card";
import { ButtonLink } from "@/components/ui/button";
import { Notice } from "@/components/admin/core/notice";
import { StatCard } from "@/components/admin/core/stat-card";
import { cronHealth, cronTaskLabel } from "@/lib/verein/cron-lib";
import { MEETING_KIND_LABEL, MEETING_STATUS_LABEL, labelOf } from "@/lib/verein/constants";
import { formatDateCh, formatDateTimeCh } from "@/lib/verein/dates";
import { formatChfWithCurrency } from "@/lib/verein/money";
import type { VereinDashboard } from "@/lib/verein/overview-data";
import { countLabel, type SetupGroup } from "@/lib/verein/overview-lib";
import { canAccess } from "@/lib/verein/permissions";

const UNAVAILABLE = "Nicht verfügbar";

/** Kennzahlen des Vereins als Stat-Karten. Nur die Bereiche, die die Rolle sehen darf (data.sections), erscheinen. */
export function VereinKpis({ data }: { data: VereinDashboard }) {
  const { sections, members, fees, ledger, meeting, events, tasks } = data;
  const cards: React.ReactNode[] = [];

  if (sections.members) {
    cards.push(
      <StatCard
        key="members"
        label="Aktive Mitglieder"
        value={members ? members.active : "–"}
        detail={
          members
            ? members.byType.length > 0
              ? members.byType.map((t) => `${t.count} ${t.name}`).join(" · ")
              : "Noch keine aktiven Mitglieder"
            : UNAVAILABLE
        }
        href="/admin/members"
        icon={<Users className="h-4 w-4" />}
      />,
    );
    cards.push(
      <StatCard
        key="applications"
        label="Offene Anträge"
        value={members ? members.applications : "–"}
        detail={members ? (members.applications > 0 ? "warten auf die Prüfung" : "Keine offenen Anträge") : UNAVAILABLE}
        href="/admin/members?status=ANTRAG"
        accent={members && members.applications > 0 ? "text-amber-300" : "text-white"}
        icon={<UserPlus className="h-4 w-4" />}
      />,
    );
  }

  if (sections.fees) {
    cards.push(
      <StatCard
        key="invoices"
        label="Offene Rechnungen"
        value={fees ? fees.openCount : "–"}
        detail={fees ? (fees.openCount > 0 ? `${formatChfWithCurrency(fees.openRappen)} ausstehend` : "Nichts ausstehend") : UNAVAILABLE}
        href="/admin/fees"
        icon={<Receipt className="h-4 w-4" />}
      />,
    );
    cards.push(
      <StatCard
        key="overdue"
        label="Überfällige Rechnungen"
        value={fees ? fees.overdueCount : "–"}
        detail={fees ? (fees.overdueCount > 0 ? `${formatChfWithCurrency(fees.overdueRappen)} überfällig` : "Keine überfälligen Rechnungen") : UNAVAILABLE}
        href="/admin/fees?tab=rechnungen&status=UEBERFAELLIG"
        accent={fees && fees.overdueCount > 0 ? "text-rose-300" : "text-white"}
        icon={<Receipt className="h-4 w-4" />}
      />,
    );
  }

  if (sections.ledger) {
    cards.push(
      <StatCard
        key="ledger"
        label="Kassastand"
        value={ledger ? (ledger.hasAccounts ? formatChfWithCurrency(ledger.assetEndRappen) : "–") : "–"}
        detail={
          ledger
            ? ledger.hasAccounts
              ? ledger.unbookedPayments > 0
                ? `${countLabel(ledger.unbookedPayments, "Zahlung", "Zahlungen")} noch nicht gebucht`
                : `Vermögen am Ende des Geschäftsjahres ${ledger.year}`
              : "Noch keine Konten eingerichtet"
            : UNAVAILABLE
        }
        href="/admin/ledger"
        accent={ledger && ledger.unbookedPayments > 0 ? "text-amber-300" : "text-white"}
        icon={<Wallet className="h-4 w-4" />}
      />,
    );
  }

  if (sections.meetings) {
    const next = meeting?.next ?? null;
    cards.push(
      <StatCard
        key="meeting"
        label="Nächste Versammlung"
        value={meeting ? (next ? <span className="block text-xl leading-snug">{formatDateCh(next.startsAt)}</span> : "–") : "–"}
        detail={meeting ? (next ? `${next.title} · ${labelOf(MEETING_STATUS_LABEL, next.status)}` : "Keine Versammlung geplant") : UNAVAILABLE}
        href={next ? `/admin/meetings/${next.id}` : "/admin/meetings"}
        icon={<Gavel className="h-4 w-4" />}
      />,
    );
  }

  if (sections.events) {
    const first = events?.[0] ?? null;
    cards.push(
      <StatCard
        key="event"
        label="Nächster Anlass"
        value={events ? (first ? <span className="block text-xl leading-snug">{formatDateCh(first.startsAt)}</span> : "–") : "–"}
        detail={events ? (first ? `${first.title} · ${first.seatsTaken}${first.capacity ? ` von ${first.capacity}` : ""} angemeldet` : "Kein Anlass veröffentlicht") : UNAVAILABLE}
        href={first ? `/admin/events/${first.id}` : "/admin/events"}
        icon={<CalendarDays className="h-4 w-4" />}
      />,
    );
  }

  if (sections.tasks) {
    cards.push(
      <StatCard
        key="tasks"
        label="Offene Aufgaben"
        value={tasks ? tasks.open : "–"}
        detail={tasks ? (tasks.overdue > 0 ? `${tasks.overdue} überfällig · ${tasks.mine} bei dir` : `${tasks.mine} bei dir`) : UNAVAILABLE}
        href="/admin/tasks"
        accent={tasks && tasks.overdue > 0 ? "text-amber-300" : "text-white"}
        icon={<ListChecks className="h-4 w-4" />}
      />,
    );
  }

  if (cards.length === 0) return null;
  return (
    <section aria-label="Kennzahlen des Vereins" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {cards}
    </section>
  );
}

/** Einrichtungshilfe: was in den Einstellungen noch fehlt, damit Rechnungen, Mahnungen und Einladungen freigeschaltet sind. */
export function SetupHelp({ groups }: { groups: SetupGroup[] }) {
  if (groups.length === 0) return null;
  return (
    <section aria-labelledby="setup-heading" className="mb-6">
      <Notice variant="warning">
        <h2 id="setup-heading" className="font-semibold">
          Einrichtung: Es fehlen noch Angaben
        </h2>
        <p className="mt-1 text-amber-200/90">
          Beträge, Fristen und Kontodaten legt der Verein selbst fest (gemäss Statuten). Bis sie eingetragen sind, bleiben die folgenden Funktionen gesperrt.
        </p>
        <ul className="mt-3 space-y-3">
          {groups.map((g) => (
            <li key={g.key}>
              <p className="font-medium">{g.title}</p>
              <p className="text-amber-200/80">{g.purpose}</p>
              <ul className="mt-1 list-disc pl-5">
                {g.items.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
              <Link href={g.href} className="mt-1 inline-flex items-center gap-1 font-medium underline underline-offset-2">
                {g.linkLabel} <ArrowRight className="h-3.5 w-3.5" aria-hidden />
              </Link>
            </li>
          ))}
        </ul>
      </Notice>
    </section>
  );
}

/** Betriebsanzeige: wann der tägliche Lauf (Austritte, Erinnerungen, Aufräumen) zuletzt lief. Nur lesend. */
export function CronStatusCard({ data, now = new Date() }: { data: VereinDashboard; now?: Date }) {
  if (!data.sections.cron || !data.cron) return null;
  const run = data.cron.run;
  const health = cronHealth(run, now);
  return (
    <section aria-labelledby="cron-heading" className="mb-6">
      <Card className="p-5">
        <h2 id="cron-heading" className="text-sm font-semibold uppercase tracking-[0.14em] text-zinc-500">
          Täglicher Lauf
        </h2>
        {health === "never" || !run ? (
          <Notice variant="warning" className="mt-3">
            Der tägliche Lauf ist nicht eingerichtet. Austritte und Erinnerungen müssen dann von Hand ausgelöst werden.
          </Notice>
        ) : (
          <>
            <p className="mt-2 text-sm text-zinc-300">
              Zuletzt gelaufen am <span className="font-medium text-zinc-100">{formatDateTimeCh(new Date(run.finishedAt))}</span>
              {health === "ok" ? ": ohne Fehler." : health === "failed" ? ": mit Fehlern." : "."}
            </p>
            {health === "stale" && (
              <Notice variant="warning" className="mt-3">
                Der tägliche Lauf hat seit mehr als 36 Stunden nicht stattgefunden. Austritte und Erinnerungen müssen dann von Hand ausgelöst werden. Prüfe den Dienst «cron» (docker logs vylaris-schweiz-cron).
              </Notice>
            )}
            {health === "failed" && (
              <Notice variant="error" className="mt-3">
                Mindestens eine Aufgabe ist beim letzten Lauf fehlgeschlagen. Der Lauf wiederholt sie beim nächsten Mal; Details stehen im Protokoll des Dienstes «cron».
              </Notice>
            )}
            <ul className="mt-3 space-y-1 text-sm text-zinc-400">
              {run.tasks.map((t) => (
                <li key={t.name} className="flex flex-wrap justify-between gap-x-4">
                  <span>{cronTaskLabel(t.name)}</span>
                  <span className={t.ok ? "text-zinc-300" : "text-rose-300"}>{t.ok ? `${t.count} erledigt` : (t.error ?? "Fehler")}</span>
                </li>
              ))}
            </ul>
          </>
        )}
      </Card>
    </section>
  );
}

/** Nächste Termine: Versammlung und Anlässe. */
export function NextDatesCard({ data }: { data: VereinDashboard }) {
  const { sections, meeting, events } = data;
  if (!sections.meetings && !sections.events) return null;
  const next = meeting?.next ?? null;
  const rows: Array<{ key: string; href: string; icon: React.ReactNode; title: string; meta: string; when: Date }> = [];
  if (sections.meetings && next) {
    rows.push({
      key: `m-${next.id}`,
      href: `/admin/meetings/${next.id}`,
      icon: <Gavel className="h-4 w-4" aria-hidden />,
      title: next.title,
      meta: `${labelOf(MEETING_KIND_LABEL, next.kind)} · ${labelOf(MEETING_STATUS_LABEL, next.status)}${next.location ? ` · ${next.location}` : ""}`,
      when: next.startsAt,
    });
  }
  if (sections.events) {
    for (const e of events ?? []) {
      rows.push({
        key: `e-${e.id}`,
        href: `/admin/events/${e.id}`,
        icon: <CalendarDays className="h-4 w-4" aria-hidden />,
        title: e.title,
        meta: `Anlass · ${e.seatsTaken}${e.capacity ? ` von ${e.capacity}` : ""} angemeldet${e.location ? ` · ${e.location}` : ""}`,
        when: e.startsAt,
      });
    }
  }
  rows.sort((a, b) => a.when.getTime() - b.when.getTime());
  const minutesPending = sections.meetings ? (meeting?.minutesPending ?? 0) : 0;

  return (
    <Card>
      <div className="flex items-center justify-between gap-3 border-b border-zinc-800 px-5 py-4">
        <h2 className="text-sm font-semibold text-white">Nächste Termine</h2>
        {sections.meetings && (
          <Link href="/admin/meetings" className="inline-flex items-center gap-1 text-sm text-emerald-400 hover:text-emerald-300">
            Versammlungen <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
          </Link>
        )}
      </div>
      {rows.length === 0 ? (
        <p className="px-5 py-10 text-center text-sm text-zinc-500">Keine bevorstehenden Versammlungen oder Anlässe.</p>
      ) : (
        <ul className="divide-y divide-zinc-800">
          {rows.map((r) => (
            <li key={r.key}>
              <Link href={r.href} className="flex flex-wrap items-start gap-x-3 gap-y-1 px-5 py-3.5 transition-colors hover:bg-zinc-900">
                <span className="mt-0.5 text-zinc-500">{r.icon}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-zinc-100">{r.title}</span>
                  <span className="block truncate text-xs text-zinc-500">{r.meta}</span>
                </span>
                <time dateTime={r.when.toISOString()} className="w-full pl-7 text-xs tabular-nums text-zinc-400 sm:w-auto sm:shrink-0 sm:pl-0">
                  {formatDateTimeCh(r.when)}
                </time>
              </Link>
            </li>
          ))}
        </ul>
      )}
      {minutesPending > 0 && (
        <p className="border-t border-zinc-800 px-5 py-3 text-sm text-amber-300">
          {countLabel(minutesPending, "Protokoll wartet", "Protokolle warten")} auf die Genehmigung.{" "}
          <Link href="/admin/meetings" className="underline underline-offset-2">
            Zu den Versammlungen
          </Link>
        </p>
      )}
    </Card>
  );
}

/** Schnellaktionen: nur, was die Rolle ändern darf. */
export function QuickActions({ roles }: { roles: readonly string[] }) {
  const items: Array<{ href: string; label: string; icon: React.ReactNode }> = [];
  const add = (ok: boolean, href: string, label: string, icon: React.ReactNode) => {
    if (ok) items.push({ href, label, icon });
  };
  add(canAccess(roles, "members", "write"), "/admin/members/new", "Neues Mitglied", <UserPlus className="h-4 w-4" aria-hidden />);
  add(canAccess(roles, "fees", "write"), "/admin/fees/invoices/new", "Neue Rechnung", <Receipt className="h-4 w-4" aria-hidden />);
  add(canAccess(roles, "ledger", "write"), "/admin/ledger/new", "Neue Buchung", <Wallet className="h-4 w-4" aria-hidden />);
  add(canAccess(roles, "meetings", "write"), "/admin/meetings/new", "Neue Versammlung", <Gavel className="h-4 w-4" aria-hidden />);
  add(canAccess(roles, "events", "write"), "/admin/events/new", "Neuer Anlass", <CalendarDays className="h-4 w-4" aria-hidden />);
  add(canAccess(roles, "tasks", "write"), "/admin/tasks", "Aufgabe erfassen", <ListChecks className="h-4 w-4" aria-hidden />);
  add(canAccess(roles, "documents", "write"), "/admin/documents", "Dokument hochladen", <FileText className="h-4 w-4" aria-hidden />);
  add(canAccess(roles, "website", "write"), "/admin/blog/new", "Neuer Blogbeitrag", <Plus className="h-4 w-4" aria-hidden />);
  add(canAccess(roles, "website", "write"), "/admin/services/new", "Neuer Service", <Plus className="h-4 w-4" aria-hidden />);
  add(canAccess(roles, "website", "write"), "/admin/status?new=incident", "Statusmeldung erstellen", <Inbox className="h-4 w-4" aria-hidden />);
  add(canAccess(roles, "verein_settings", "write"), "/admin/verein", "Vereinseinstellungen", <Settings className="h-4 w-4" aria-hidden />);
  if (items.length === 0) return null;
  return (
    <Card className="p-5">
      <h2 className="text-sm font-semibold text-white">Schnellaktionen</h2>
      <div className="mt-4 flex flex-col gap-2">
        {items.map((i) => (
          <ButtonLink key={i.href} href={i.href} variant="secondary" className="justify-start">
            {i.icon} {i.label}
          </ButtonLink>
        ))}
      </div>
    </Card>
  );
}
