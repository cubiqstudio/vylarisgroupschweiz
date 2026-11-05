// Zod-Schemas des Moduls Aufgaben (Vorstand). Reine Definitionen (auch im Browser nutzbar).
import { z } from "zod";
import { TASK_PRIORITIES, TASK_STATUSES } from "./constants";
import { decodeAssignee } from "./tasks-lib";
import { idSchema, longText, oneOf, optionalDateOnlySchema, optionalText, text } from "./validation";

const optionalId = z
  .union([idSchema, z.literal(""), z.null()])
  .optional()
  .transform((v) => (v ? v : null));

/** Zuständige Person: «admin:ID», «member:ID» oder leer; wird in die zwei Fremdschlüssel zerlegt. */
export const assigneeSchema = z
  .union([z.string().trim().max(60), z.null()])
  .optional()
  .transform((v, ctx) => {
    if (!v) return { assigneeAdminId: null as string | null, assigneeMemberId: null as string | null };
    const a = decodeAssignee(v);
    if (!a) {
      ctx.addIssue({ code: "custom", message: "Ungültige Auswahl der verantwortlichen Person." });
      return z.NEVER;
    }
    return a.kind === "admin" ? { assigneeAdminId: a.id, assigneeMemberId: null } : { assigneeAdminId: null, assigneeMemberId: a.id };
  });

const taskFields = {
  title: text(3, 150, "Bitte einen Titel angeben (mindestens 3 Zeichen)."),
  description: longText(5000),
  assignee: assigneeSchema,
  dueDate: optionalDateOnlySchema,
  priority: oneOf(TASK_PRIORITIES, "Bitte eine Priorität wählen."),
  status: oneOf(TASK_STATUSES, "Bitte einen Status wählen."),
  meetingId: optionalId,
  resolutionId: optionalId,
};

export const taskCreateSchema = z.object({
  ...taskFields,
  priority: taskFields.priority.default("NORMAL"),
  status: taskFields.status.default("OFFEN"),
});
export type TaskCreateInput = z.infer<typeof taskCreateSchema>;

/** Änderung (nur gesendete Felder, gelesen mit parsePatch). */
export const taskPatchSchema = z.object(taskFields).partial();
export type TaskPatchInput = z.infer<typeof taskPatchSchema>;

export const taskCommentSchema = z.object({ body: z.string().trim().min(1, "Bitte einen Kommentar schreiben.").max(2000, "Maximal 2000 Zeichen.") });
export type TaskCommentInput = z.infer<typeof taskCommentSchema>;

export const taskRemindSchema = z.object({ note: optionalText(300) });

export const taskFilterSchema = z.object({
  q: z.string().trim().max(100).default(""),
  mine: z.boolean().default(false),
  priority: z.enum(["", ...TASK_PRIORITIES]).default(""),
  assignee: z.string().max(60).default(""),
  hideDone: z.boolean().default(false),
});
export type TaskFilters = z.infer<typeof taskFilterSchema>;
