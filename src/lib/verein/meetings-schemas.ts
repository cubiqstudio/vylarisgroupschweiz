// Zod-Schemas des Moduls Versammlungen (Verwaltung, Portal, Antwort-Link). Reine Definitionen, auch im Browser nutzbar.
import { z } from "zod";
import { ATTENDANCE_STATUSES, MEETING_KINDS, RESOLUTION_RESULTS, TASK_PRIORITIES } from "./constants";
import { MAJORITY_RULES, RSVP_VALUES } from "./meetings-lib";
import { dateOnlySchema, dateTimeSchema, idSchema, longText, oneOf, optionalDateOnlySchema, optionalText, text } from "./validation";

const optionalId = z.union([idSchema, z.literal(""), z.null()]).optional().transform((v) => (v ? v : null));

/** Ganze Zahl ab `min`; leer = nicht angegeben. */
const optionalCount = (min: number, max: number, msg: string) =>
  z
    .union([z.number().int(msg).min(min, msg).max(max, msg), z.literal(""), z.null()])
    .optional()
    .transform((v) => (typeof v === "number" ? v : null));

// ---- Sitzung -----------------------------------------------------------------------------------------------------------

export const meetingFieldsSchema = z.object({
  kind: oneOf(MEETING_KINDS, "Bitte die Art der Sitzung wählen."),
  title: text(3, 160, "Bitte einen Titel angeben (mindestens 3 Zeichen)."),
  startsAt: dateTimeSchema,
  endsAt: z
    .union([dateTimeSchema, z.literal(""), z.null()])
    .optional()
    .transform((v) => (v instanceof Date ? v : null)),
  location: optionalText(200),
  leaderId: optionalId,
  recorderId: optionalId,
  quorumMin: optionalCount(1, 10000, "Bitte eine ganze Zahl ab 1 angeben."),
  invitationText: longText(5000),
});

export const meetingCreateSchema = meetingFieldsSchema.refine((v) => v.endsAt === null || v.endsAt.getTime() > v.startsAt.getTime(), {
  path: ["endsAt"],
  message: "Das Ende muss nach dem Beginn liegen.",
});
export type MeetingCreateInput = z.infer<typeof meetingCreateSchema>;

/** Änderung (nur gesendete Felder, gelesen mit parsePatch). */
export const meetingPatchSchema = meetingFieldsSchema.partial();
export type MeetingPatchInput = z.infer<typeof meetingPatchSchema>;

export const MEETING_ACTIONS = ["complete", "cancel", "reopen", "mark-invited"] as const;
export const meetingActionSchema = z.object({
  action: oneOf(MEETING_ACTIONS, "Unbekannte Aktion."),
  /** Bei «cancel»: eingeladene Personen per E-Mail informieren */
  notify: z.boolean().optional().default(false),
  reason: optionalText(500),
  /** Bei «mark-invited»: Tag, an dem auf anderem Weg (z. B. per Post) eingeladen wurde */
  sentOn: optionalDateOnlySchema,
});
export type MeetingActionInput = z.infer<typeof meetingActionSchema>;

// ---- Traktanden --------------------------------------------------------------------------------------------------------

export const agendaFieldsSchema = z.object({
  title: text(1, 200, "Bitte einen Titel angeben."),
  description: longText(5000),
  motion: longText(2000),
});
export const agendaCreateSchema = agendaFieldsSchema;
export const agendaPatchSchema = agendaFieldsSchema.partial().extend({ direction: oneOf(["up", "down"] as const).optional() });

// ---- Anwesenheit -------------------------------------------------------------------------------------------------------

export const attendanceRowSchema = z.object({
  memberId: idSchema,
  status: oneOf(ATTENDANCE_STATUSES, "Ungültiger Status."),
  canVote: z.boolean(),
  note: optionalText(200),
});
export const attendanceActionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("init") }),
  z.object({ action: z.literal("add"), memberId: idSchema }),
  z.object({ action: z.literal("remove"), memberId: idSchema }),
  z.object({ action: z.literal("save"), rows: z.array(attendanceRowSchema).min(1, "Keine Änderungen.").max(500, "Zu viele Zeilen.") }),
]);
export type AttendanceActionInput = z.infer<typeof attendanceActionSchema>;

// ---- Beschlüsse --------------------------------------------------------------------------------------------------------

export const resolutionFieldsSchema = z.object({
  agendaItemId: optionalId,
  text: text(3, 2000, "Bitte den Beschluss formulieren (mindestens 3 Zeichen)."),
  votesYes: optionalCount(0, 100000, "Bitte eine ganze Zahl ab 0 angeben."),
  votesNo: optionalCount(0, 100000, "Bitte eine ganze Zahl ab 0 angeben."),
  abstentions: optionalCount(0, 100000, "Bitte eine ganze Zahl ab 0 angeben."),
  majority: oneOf(MAJORITY_RULES, "Bitte eine Mehrheitsregel wählen.").default("EINFACH"),
  result: oneOf(RESOLUTION_RESULTS, "Bitte ein Ergebnis wählen."),
  recusal: optionalText(500),
});
export const resolutionCreateSchema = resolutionFieldsSchema;
export const resolutionPatchSchema = resolutionFieldsSchema.partial();
export type ResolutionInput = z.infer<typeof resolutionFieldsSchema>;

/** «Aufgabe aus Beschluss»: legt eine Aufgabe an, die mit dem Beschluss verknüpft ist. */
export const taskFromResolutionSchema = z.object({
  title: text(1, 200, "Bitte einen Titel angeben."),
  description: longText(2000),
  dueDate: optionalDateOnlySchema,
  assigneeMemberId: optionalId,
  priority: oneOf(TASK_PRIORITIES, "Ungültige Priorität.").default("NORMAL"),
});
export type TaskFromResolutionInput = z.infer<typeof taskFromResolutionSchema>;

// ---- Protokoll ---------------------------------------------------------------------------------------------------------

export const minutesSaveSchema = z.object({
  minutes: longText(200000),
  /** Pflicht, sobald das Protokoll genehmigt ist */
  amendReason: optionalText(500),
});
export const minutesApproveSchema = z.object({
  approvedOn: dateOnlySchema,
  approvedBy: text(1, 200, "Bitte angeben, wer das Protokoll genehmigt hat (z. B. «Vorstand»)."),
  note: optionalText(500),
});
export const minutesUnapproveSchema = z.object({ reason: text(5, 500, "Bitte einen Grund angeben (mindestens 5 Zeichen).") });

// ---- Einladung ---------------------------------------------------------------------------------------------------------

export const invitationSendSchema = z.object({
  kind: oneOf(["EINLADUNG", "ERINNERUNG"] as const, "Ungültige Art des Versands."),
  /** ALL: an alle Empfänger · MISSING: nur an Personen, die diese Art von Mail noch nicht erhalten haben */
  mode: oneOf(["ALL", "MISSING"] as const).default("ALL"),
  /** Versand an die eigene Adresse zur Kontrolle (kein Eintrag im Versandprotokoll, Status bleibt unverändert) */
  testOnly: z.boolean().optional().default(false),
  /** Auch Mitglieder ohne Stimmrecht einladen (nur für Versammlungen; sonst nur Stimmberechtigte) */
  includeNonVoting: z.boolean().optional().default(false),
  /** Bestätigung, dass die Einladungsfrist unterschritten ist und trotzdem versendet wird */
  acknowledgeLate: z.boolean().optional().default(false),
});
export type InvitationSendInput = z.infer<typeof invitationSendSchema>;

// ---- Rückmeldung -------------------------------------------------------------------------------------------------------

export const rsvpSchema = z.object({
  status: oneOf(RSVP_VALUES, "Bitte «Ich nehme teil» oder «Ich entschuldige mich» wählen."),
  note: optionalText(200),
});
export const rsvpTokenSchema = rsvpSchema.extend({ token: z.string().trim().min(10, "Ungültiger Link.").max(200, "Ungültiger Link.") });
export type RsvpInput = z.infer<typeof rsvpSchema>;

// ---- Listen ------------------------------------------------------------------------------------------------------------

export const MEETING_WHEN = ["kommend", "vergangen"] as const;
export type MeetingWhen = (typeof MEETING_WHEN)[number];
