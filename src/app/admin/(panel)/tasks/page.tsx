import type { Metadata } from "next";
import Link from "next/link";
import { Search } from "lucide-react";
import { Button, buttonClass } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/form";
import { cn } from "@/lib/utils";
import { TASK_PRIORITIES, TASK_PRIORITY_LABEL } from "@/lib/verein/constants";
import { formatDateCh, toDateInputValue } from "@/lib/verein/dates";
import { requireModulePage } from "@/lib/verein/guard";
import { listHref } from "@/lib/verein/pagination";
import { canAccess } from "@/lib/verein/permissions";
import { assigneeName, listTaskOptions, listTasks, parseTaskFilters, taskCounts } from "@/lib/verein/tasks-data";
import { dueLabel, encodeAssignee, isTaskOverdue } from "@/lib/verein/tasks-lib";
import { PageTitle } from "@/components/admin/core/page-title";
import { TaskBoard } from "@/components/admin/tasks/task-board";
import type { TaskView } from "@/components/admin/tasks/types";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Aufgaben" };

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function AdminTasksPage({ searchParams }: Props) {
  const admin = await requireModulePage("tasks");
  const canWrite = canAccess(admin.roles, "tasks", "write");
  const filters = parseTaskFilters(await searchParams);
  const me = { adminId: admin.id, memberId: admin.memberId };
  const now = new Date();

  const [{ tasks, doneTotal, doneShown }, options, counts] = await Promise.all([listTasks(filters, me), listTaskOptions(), taskCounts()]);

  const views: TaskView[] = tasks.map((t) => ({
    id: t.id,
    title: t.title,
    description: t.description,
    status: t.status,
    priority: t.priority,
    dueInput: t.dueDate ? toDateInputValue(t.dueDate) : "",
    dueText: dueLabel(t, now),
    overdue: isTaskOverdue(t, now),
    assignee: encodeAssignee(t.assigneeAdminId, t.assigneeMemberId),
    assigneeName: assigneeName(t),
    meetingId: t.meetingId ?? "",
    meetingTitle: t.meeting?.title ?? "",
    resolutionId: t.resolutionId ?? "",
    resolutionLabel: t.resolution ? `Beschluss ${t.resolution.number}: ${t.resolution.text.slice(0, 120)}` : "",
    commentCount: t._count.comments,
    doneText: t.doneAt ? `Erledigt am ${formatDateCh(t.doneAt)}` : "",
    createdByName: t.createdByName,
    lastReminderText: t.lastReminderAt ? formatDateCh(t.lastReminderAt) : "",
  }));

  const base = { q: filters.q, priority: filters.priority, assignee: filters.assignee, mine: filters.mine ? "1" : "", hideDone: filters.hideDone ? "1" : "" };
  const href = (over: Partial<Record<keyof typeof base, string>>) => listHref("/admin/tasks", { ...base, ...over });
  const filtered = Boolean(filters.q || filters.priority || filters.assignee || filters.mine || filters.hideDone);
  const overdueWithAssignee = tasks.filter((t) => isTaskOverdue(t, now) && (t.assigneeAdminId || t.assigneeMemberId)).length;

  return (
    <div>
      <PageTitle title="Aufgaben" description="Aufgaben des Vorstands mit Verantwortlichen, Frist und Priorität. Verschiebe sie mit den Knöpfen zwischen den Spalten.">
        <div className="text-sm text-zinc-400" aria-live="polite">
          {counts.open} offen · {counts.inWork} in Arbeit
          {counts.overdue > 0 && <span className="text-rose-300"> · {counts.overdue} überfällig</span>}
        </div>
      </PageTitle>

      <nav aria-label="Ansicht wählen" className="-mx-1 mb-4 overflow-x-auto px-1 pb-1">
        <ul className="flex min-w-max gap-1.5">
          {[
            { mine: false, label: "Alle Aufgaben" },
            { mine: true, label: "Meine Aufgaben" },
          ].map((c) => {
            const on = filters.mine === c.mine;
            return (
              <li key={c.label}>
                <Link
                  href={href({ mine: c.mine ? "1" : "" })}
                  aria-current={on ? "true" : undefined}
                  className={cn(
                    "inline-flex h-8 items-center rounded-lg px-3 text-sm font-medium ring-1 ring-inset transition-colors",
                    on ? "bg-zinc-900 text-white ring-zinc-700" : "bg-zinc-900/50 text-zinc-400 ring-zinc-800 hover:bg-zinc-900 hover:text-zinc-100",
                  )}
                >
                  {c.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <form method="get" action="/admin/tasks" role="search" className="mb-6 grid gap-2 sm:grid-cols-[1fr_11rem_14rem_auto_auto]">
        {filters.mine && <input type="hidden" name="mine" value="1" />}
        <div className="relative">
          <label htmlFor="task-q" className="sr-only">
            Aufgaben durchsuchen
          </label>
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" aria-hidden />
          <Input id="task-q" name="q" type="search" defaultValue={filters.q} maxLength={100} placeholder="Titel oder Beschreibung" className="pl-9" />
        </div>
        <div>
          <label htmlFor="task-priority" className="sr-only">
            Priorität
          </label>
          <Select id="task-priority" name="priority" defaultValue={filters.priority}>
            <option value="">Jede Priorität</option>
            {TASK_PRIORITIES.map((p) => (
              <option key={p} value={p}>
                {TASK_PRIORITY_LABEL[p]}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <label htmlFor="task-assignee" className="sr-only">
            Verantwortlich
          </label>
          <Select id="task-assignee" name="assignee" defaultValue={filters.assignee}>
            <option value="">Alle Verantwortlichen</option>
            {options.assignees.map((a) => (
              <option key={a.value} value={a.value}>
                {a.label}
              </option>
            ))}
          </Select>
        </div>
        <Button type="submit" variant="secondary">
          Filtern
        </Button>
        {filtered && (
          <Link href="/admin/tasks" className={buttonClass("ghost", "md")}>
            Zurücksetzen
          </Link>
        )}
      </form>

      <div className="mb-4 flex items-center gap-2 text-sm text-zinc-400">
        <Link href={href({ hideDone: filters.hideDone ? "" : "1" })} className="underline underline-offset-2 hover:text-white">
          {filters.hideDone ? "Erledigte Aufgaben einblenden" : "Erledigte Aufgaben ausblenden"}
        </Link>
      </div>

      <TaskBoard
        tasks={views}
        options={{
          assignees: options.assignees,
          meetings: options.meetings.map((m) => ({ id: m.id, title: m.title, dateText: formatDateCh(m.startsAt) })),
          resolutions: options.resolutions,
        }}
        canWrite={canWrite}
        overdueCount={overdueWithAssignee}
        doneHidden={filters.hideDone ? 0 : Math.max(0, doneTotal - doneShown)}
      />
    </div>
  );
}
