// Erinnerungsmail an die verantwortliche Person einer Vorstandsaufgabe (manuelle Aktion). Links nur über links.ts, Empfänger vorher geprüft.
import "server-only";
import { TASK_PRIORITY_LABEL, TASK_STATUS_LABEL, type TaskPriority, type TaskStatus } from "./constants";
import { formatDateCh } from "./dates";
import { publicUrl } from "./links";
import { sendVereinMail } from "./mail";
import { dueLabel, normalizePriority, normalizeStatus } from "./tasks-lib";
import { emailSchema } from "./validation";

export type TaskReminderMailInput = {
  to: string;
  recipientName: string;
  /** Nur Admin-Konten können die Aufgabenseite öffnen */
  linkToBoard: boolean;
  senderName: string;
  note: string;
  task: { title: string; description: string; status: string; priority: string; dueDate: Date | null; meetingTitle: string | null };
};

export type TaskMailReport = { sent: true } | { sent: false; error: string };

export async function sendTaskReminder(input: TaskReminderMailInput): Promise<TaskMailReport> {
  const to = emailSchema.safeParse(input.to);
  if (!to.success) return { sent: false, error: "Für die verantwortliche Person ist keine gültige E-Mail-Adresse hinterlegt." };
  const t = input.task;
  const first = input.recipientName.trim().split(/\s+/)[0] ?? "";
  const details: Array<[string, string]> = [
    ["Aufgabe", t.title],
    ["Status", TASK_STATUS_LABEL[normalizeStatus(t.status) as TaskStatus]],
    ["Priorität", TASK_PRIORITY_LABEL[normalizePriority(t.priority) as TaskPriority]],
  ];
  if (t.dueDate) details.push(["Frist", `${formatDateCh(t.dueDate)} (${dueLabel(t)})`]);
  if (t.meetingTitle) details.push(["Sitzung", t.meetingTitle]);
  const paragraphs = [
    first ? `Hallo ${first}` : "Guten Tag",
    `${input.senderName ? `${input.senderName} erinnert` : "Der Vorstand erinnert"} dich an eine Aufgabe, für die du verantwortlich bist.`,
  ];
  if (input.note.trim()) paragraphs.push(input.note.trim());
  try {
    const res = await sendVereinMail({
      to: to.data,
      subject: `Erinnerung: ${t.title}`,
      heading: "Erinnerung an eine Aufgabe",
      preheader: t.dueDate ? `Frist: ${formatDateCh(t.dueDate)}` : "Eine Aufgabe wartet auf dich.",
      paragraphs,
      details,
      ...(input.linkToBoard ? { cta: { label: "Aufgaben öffnen", url: publicUrl("/admin/tasks") } } : {}),
      footerNote: "Du erhältst diese Mail, weil dir eine Vorstandsaufgabe zugeteilt ist.",
    });
    return res.ok ? { sent: true } : { sent: false, error: res.error };
  } catch (e) {
    console.error("[tasks-mail]", e instanceof Error ? e.name : "unbekannt");
    return { sent: false, error: "Die E-Mail konnte nicht versendet werden." };
  }
}
