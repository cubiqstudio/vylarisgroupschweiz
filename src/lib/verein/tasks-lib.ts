// Fachlogik der Vorstandsaufgaben (rein, ohne Seiteneffekte): Überfälligkeit, Spalten, Statuswechsel, Zuständige, Erinnerungs-Sperrfrist.
import { TASK_PRIORITIES, TASK_STATUSES, type TaskPriority, type TaskStatus } from "./constants";
import { daysBetween, formatDateCh, toDateOnly } from "./dates";

export type TaskLike = {
  status: string;
  priority: string;
  dueDate: Date | null;
  title: string;
  createdAt?: Date;
};

const isStatus = (v: string): v is TaskStatus => (TASK_STATUSES as readonly string[]).includes(v);
const isPriority = (v: string): v is TaskPriority => (TASK_PRIORITIES as readonly string[]).includes(v);

/** Unbekannte Statuswerte gelten als «offen» (nie eine Aufgabe verlieren). */
export const normalizeStatus = (v: string): TaskStatus => (isStatus(v) ? v : "OFFEN");
export const normalizePriority = (v: string): TaskPriority => (isPriority(v) ? v : "NORMAL");

/** Überfällig: nicht erledigt und die Frist liegt vor heute (am Fälligkeitstag selbst noch nicht). */
export function isTaskOverdue(task: Pick<TaskLike, "status" | "dueDate">, now: Date = new Date()): boolean {
  if (!task.dueDate || normalizeStatus(task.status) === "ERLEDIGT") return false;
  return daysBetween(task.dueDate, now) > 0;
}

/** Frist als Text: «heute fällig», «in 3 Tagen», «2 Tage überfällig» (nicht erledigt) bzw. das Datum (erledigt). */
export function dueLabel(task: Pick<TaskLike, "status" | "dueDate">, now: Date = new Date()): string {
  if (!task.dueDate) return "";
  if (normalizeStatus(task.status) === "ERLEDIGT") return formatDateCh(task.dueDate);
  const d = daysBetween(now, task.dueDate); // positiv = Zukunft
  if (d === 0) return "heute fällig";
  if (d === 1) return "morgen fällig";
  if (d > 1) return `in ${d} Tagen (${formatDateCh(task.dueDate)})`;
  if (d === -1) return `1 Tag überfällig (${formatDateCh(task.dueDate)})`;
  return `${-d} Tage überfällig (${formatDateCh(task.dueDate)})`;
}

const PRIORITY_RANK: Record<TaskPriority, number> = { HOCH: 0, NORMAL: 1, NIEDRIG: 2 };

/**
 * Reihenfolge innerhalb einer Spalte: überfällige zuerst, dann nach Frist (ohne Frist am Schluss), dann nach Priorität, dann nach Titel.
 */
export function compareTasks(a: TaskLike, b: TaskLike, now: Date = new Date()): number {
  const oa = isTaskOverdue(a, now) ? 0 : 1;
  const ob = isTaskOverdue(b, now) ? 0 : 1;
  if (oa !== ob) return oa - ob;
  const da = a.dueDate ? toDateOnly(a.dueDate).getTime() : Number.POSITIVE_INFINITY;
  const db = b.dueDate ? toDateOnly(b.dueDate).getTime() : Number.POSITIVE_INFINITY;
  if (da !== db) return da < db ? -1 : 1;
  const pa = PRIORITY_RANK[normalizePriority(a.priority)];
  const pb = PRIORITY_RANK[normalizePriority(b.priority)];
  if (pa !== pb) return pa - pb;
  return a.title.localeCompare(b.title, "de-CH");
}

export type TaskColumns<T> = Record<TaskStatus, T[]>;

/** Teilt Aufgaben in die drei Spalten Offen / In Arbeit / Erledigt und sortiert jede Spalte (erledigte: zuletzt erledigte zuerst, falls `doneAt` vorhanden). */
export function groupByStatus<T extends TaskLike & { doneAt?: Date | null }>(tasks: readonly T[], now: Date = new Date()): TaskColumns<T> {
  const cols: TaskColumns<T> = { OFFEN: [], IN_ARBEIT: [], ERLEDIGT: [] };
  for (const t of tasks) cols[normalizeStatus(t.status)].push(t);
  cols.OFFEN.sort((a, b) => compareTasks(a, b, now));
  cols.IN_ARBEIT.sort((a, b) => compareTasks(a, b, now));
  cols.ERLEDIGT.sort((a, b) => (b.doneAt?.getTime() ?? 0) - (a.doneAt?.getTime() ?? 0) || a.title.localeCompare(b.title, "de-CH"));
  return cols;
}

/** Nachbarstatus für die Knöpfe «weiter» / «zurück»; null am Rand. */
export function neighbourStatus(status: string, dir: "next" | "prev"): TaskStatus | null {
  const i = TASK_STATUSES.indexOf(normalizeStatus(status));
  const j = dir === "next" ? i + 1 : i - 1;
  return TASK_STATUSES[j] ?? null;
}

/** Beim Statuswechsel: Erledigt-Zeitpunkt setzen, beim Verlassen von «Erledigt» wieder löschen, sonst unverändert lassen. */
export function doneAtFor(newStatus: TaskStatus, previousStatus: string, previousDoneAt: Date | null, now: Date = new Date()): Date | null {
  if (newStatus !== "ERLEDIGT") return null;
  return normalizeStatus(previousStatus) === "ERLEDIGT" && previousDoneAt ? previousDoneAt : now;
}

// ---- Zuständige ---------------------------------------------------------------------------------------------------

export type Assignee = { kind: "admin"; id: string } | { kind: "member"; id: string } | null;

/** Auswahlwert eines Formulars: «admin:ID», «member:ID» oder leer. */
export function encodeAssignee(adminId: string | null | undefined, memberId: string | null | undefined): string {
  if (adminId) return `admin:${adminId}`;
  if (memberId) return `member:${memberId}`;
  return "";
}

export function decodeAssignee(value: string | null | undefined): Assignee {
  const m = /^(admin|member):([A-Za-z0-9_-]{1,40})$/.exec((value ?? "").trim());
  return m ? { kind: m[1] as "admin" | "member", id: m[2]! } : null;
}

/** «Meine Aufgaben»: direkt zugeteilt (Admin-Konto) oder über das verknüpfte Mitglied. */
export function isMine(task: { assigneeAdminId: string | null; assigneeMemberId: string | null }, me: { adminId: string; memberId: string | null }): boolean {
  return task.assigneeAdminId === me.adminId || (me.memberId !== null && task.assigneeMemberId === me.memberId);
}

// ---- Erinnerung ---------------------------------------------------------------------------------------------------

/** Mindestabstand zwischen zwei Erinnerungen an dieselbe Aufgabe (Stunden). */
export const REMINDER_COOLDOWN_HOURS = 20;

/** Darf eine Erinnerung gesendet werden? Nicht für erledigte Aufgaben und nicht innerhalb der Sperrfrist. */
export function canRemind(task: { status: string; lastReminderAt: Date | null }, now: Date = new Date()): { ok: true } | { ok: false; reason: string } {
  if (normalizeStatus(task.status) === "ERLEDIGT") return { ok: false, reason: "Die Aufgabe ist bereits erledigt." };
  if (task.lastReminderAt) {
    const hours = (now.getTime() - task.lastReminderAt.getTime()) / 3_600_000;
    if (hours >= 0 && hours < REMINDER_COOLDOWN_HOURS) {
      return { ok: false, reason: `Die letzte Erinnerung wurde erst vor kurzem versendet (${formatDateCh(task.lastReminderAt)}). Bitte später erneut versuchen.` };
    }
  }
  return { ok: true };
}

/** Zeichenkette einer Kommentar-Vorschau: eine Zeile, gekürzt. */
export function previewText(text: string, max = 120): string {
  const one = text.replace(/\s+/g, " ").trim();
  return one.length > max ? `${one.slice(0, max - 1)}…` : one;
}
