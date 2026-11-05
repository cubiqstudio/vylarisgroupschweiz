// Zod-Schemas des Moduls Anlässe (Verwaltung, Gast-Anmeldung, Mitglieder-Anmeldung). Reine Definitionen, auch im Browser nutzbar.
import { z } from "zod";
import { eventConsistencyErrors, MAX_SEATS_GUEST, MAX_SEATS_MEMBER } from "./events-lib";
import { isPlausibleCancelToken } from "./events-token";
import { boolSchema, dateTimeSchema, emailSchema, idSchema, longText, oneOf, optionalDateTimeSchema, optionalEmailSchema, optionalText, text } from "./validation";

const capacitySchema = z
  .union([z.number(), z.string(), z.null()])
  .optional()
  .transform((v, ctx) => {
    if (v === null || v === undefined || (typeof v === "string" && v.trim() === "")) return null;
    const n = typeof v === "number" ? v : Number(v.trim());
    if (!Number.isInteger(n) || n < 1 || n > 10_000) {
      ctx.addIssue({ code: "custom", message: "Bitte eine ganze Zahl von 1 bis 10’000 angeben oder das Feld leer lassen (unbegrenzt)." });
      return z.NEVER;
    }
    return n;
  });

const seats = (max: number) =>
  z.coerce
    .number({ error: "Bitte die Anzahl Personen angeben." })
    .int("Bitte eine ganze Zahl angeben.")
    .min(1, "Mindestens eine Person.")
    .max(max, `Höchstens ${max} Personen pro Anmeldung.`);

// ---- Verwaltung: Anlass ----------------------------------------------------------------------------------------------

export const eventFieldsSchema = z.object({
  title: text(3, 120, "Bitte einen Titel angeben (mindestens 3 Zeichen)."),
  description: longText(20_000),
  location: optionalText(200),
  startsAt: dateTimeSchema,
  endsAt: optionalDateTimeSchema,
  capacity: capacitySchema,
  registrationDeadline: optionalDateTimeSchema,
  isPublic: boolSchema.default(false),
  membersOnly: boolSchema.default(true),
});

/** Neu anlegen: als Entwurf (Standard) oder gleich veröffentlicht. */
export const eventCreateSchema = eventFieldsSchema
  .extend({ status: oneOf(["ENTWURF", "VEROEFFENTLICHT"] as const).default("ENTWURF") })
  .superRefine((v, ctx) => {
    for (const [path, message] of Object.entries(eventConsistencyErrors(v))) ctx.addIssue({ code: "custom", path: [path], message });
  });
export type EventCreateInput = z.infer<typeof eventCreateSchema>;

/** Änderung (nur gesendete Felder, gelesen mit parsePatch). Den Status ändert man über die Aktionen. Die Zusammenhänge prüft die Datenschicht. `notify`: Angemeldete über Änderungen an Zeit oder Ort informieren. */
export const eventPatchSchema = eventFieldsSchema.partial().extend({ notify: boolSchema.optional() });
export type EventPatchInput = z.infer<typeof eventPatchSchema>;

export const eventActionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("publish") }),
  z.object({ action: z.literal("unpublish") }),
  z.object({ action: z.literal("cancel"), reason: optionalText(500), notify: boolSchema.default(true) }),
  z.object({ action: z.literal("duplicate"), startsAt: dateTimeSchema }),
  z.object({ action: z.literal("reminders") }),
]);
export type EventActionInput = z.infer<typeof eventActionSchema>;

// ---- Anmeldung -----------------------------------------------------------------------------------------------------------

/** Gast (ohne Konto). `website` ist der Honeypot: Menschen lassen ihn leer. */
export const guestRegistrationSchema = z.object({
  name: text(2, 100, "Bitte deinen Namen angeben."),
  email: emailSchema,
  seats: seats(MAX_SEATS_GUEST).default(1),
  note: optionalText(300),
  consent: boolSchema.default(false).refine((v) => v === true, "Bitte bestätige den Datenschutzhinweis."),
  website: z.string().max(200).default(""),
});
export type GuestRegistrationInput = z.infer<typeof guestRegistrationSchema>;

/** Mitglied (angemeldet). Welches Mitglied, ergibt sich aus der Sitzung, nie aus der Anfrage. */
export const memberRegistrationSchema = z.object({
  seats: seats(MAX_SEATS_MEMBER).default(1),
  note: optionalText(300),
});
export type MemberRegistrationInput = z.infer<typeof memberRegistrationSchema>;

export const cancelTokenSchema = z.object({
  token: z.string().trim().refine(isPlausibleCancelToken, "Der Link ist ungültig oder unvollständig."),
});

/** Vorstand fügt eine Person von Hand hinzu: Mitglied (memberId) oder Gast (Name, E-Mail optional). */
export const adminRegistrationSchema = z
  .object({
    memberId: z.union([idSchema, z.literal(""), z.null()]).optional().transform((v) => (v ? v : null)),
    guestName: optionalText(100),
    guestEmail: optionalEmailSchema,
    seats: seats(50).default(1),
    note: optionalText(300),
    force: boolSchema.default(false),
    sendMail: boolSchema.default(true),
  })
  .superRefine((v, ctx) => {
    if (!v.memberId && v.guestName.length < 2) ctx.addIssue({ code: "custom", path: ["guestName"], message: "Bitte ein Mitglied wählen oder den Namen des Gastes angeben." });
  });
export type AdminRegistrationInput = z.infer<typeof adminRegistrationSchema>;

export const registrationActionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("cancel"), sendMail: boolSchema.default(true) }),
  z.object({ action: z.literal("promote"), force: boolSchema.default(false), sendMail: boolSchema.default(true) }),
  z.object({ action: z.literal("restore"), force: boolSchema.default(false) }),
  z.object({ action: z.literal("attendance"), attended: boolSchema }),
  z.object({ action: z.literal("update"), seats: seats(50).optional(), note: optionalText(300).optional() }),
]);
export type RegistrationActionInput = z.infer<typeof registrationActionSchema>;
