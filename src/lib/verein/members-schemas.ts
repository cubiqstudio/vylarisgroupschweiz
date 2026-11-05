// Zod-Schemas des Moduls Mitglieder (Verwaltung, Beitrittsformular, Portal). Reine Definitionen, auch im Browser nutzbar.
import { z } from "zod";
import { COMMUNICATION_PREFS, OFFICE_KINDS, SALUTATIONS } from "./constants";
import {
  boolSchema,
  chfInputSchema,
  countrySchema,
  dateOnlySchema,
  emailSchema,
  idSchema,
  longText,
  oneOf,
  optionalDateOnlySchema,
  optionalEmailSchema,
  optionalText,
  phoneSchema,
  text,
  zipSchema,
} from "./validation";

const salutation = oneOf(SALUTATIONS, "Bitte eine Anrede aus der Liste wählen.");
const communicationPref = oneOf(COMMUNICATION_PREFS, "Bitte «Per E-Mail» oder «Per Post» wählen.");
const optionalId = z.union([idSchema, z.literal(""), z.null()]).optional().transform((v) => (v ? v : null));

// ---- Verwaltung: Mitglied anlegen / ändern ------------------------------------------------------------------------------

export const memberFieldsSchema = z.object({
  salutation: salutation.default(""),
  firstName: text(1, 80, "Bitte den Vornamen angeben."),
  lastName: text(1, 80, "Bitte den Nachnamen angeben."),
  birthDate: optionalDateOnlySchema,
  street: optionalText(100),
  houseNumber: optionalText(20),
  zip: zipSchema,
  city: optionalText(80),
  country: countrySchema,
  email: optionalEmailSchema,
  phone: phoneSchema,
  communicationPref: communicationPref.default("EMAIL"),
  membershipTypeId: optionalId,
  boardNotes: longText(5000),
});

/** Neu erfassen: als aktives Mitglied (Standard) oder als Antrag, der noch zu prüfen ist. */
export const memberCreateSchema = memberFieldsSchema
  .extend({
    status: oneOf(["AKTIV", "ANTRAG"] as const).default("AKTIV"),
    joinedAt: optionalDateOnlySchema,
  })
  .refine((v) => v.communicationPref !== "EMAIL" || v.email !== "" || v.status === "ANTRAG", {
    path: ["email"],
    message: "Für Mitteilungen per E-Mail wird eine E-Mail-Adresse benötigt.",
  });
export type MemberCreateInput = z.infer<typeof memberCreateSchema>;

/** Änderung (nur gesendete Felder, gelesen mit parsePatch). Status ändert man nur über die Aktionen. */
export const memberPatchSchema = memberFieldsSchema.partial();
export type MemberPatchInput = z.infer<typeof memberPatchSchema>;

// ---- Verwaltung: Aktionen ----------------------------------------------------------------------------------------------

const reason = (max = 1000) => z.string().trim().max(max, `Maximal ${max} Zeichen.`).default("");

export const memberActionSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("accept"),
    membershipTypeId: optionalId,
    joinedAt: optionalDateOnlySchema,
    sendMail: boolSchema.default(true),
  }),
  z.object({ action: z.literal("reject"), reason: reason(500), sendMail: boolSchema.default(true) }),
  z.object({ action: z.literal("reinstate"), joinedAt: optionalDateOnlySchema }),
  z.object({
    action: z.literal("exit"),
    noticeAt: optionalDateOnlySchema,
    leftAt: optionalDateOnlySchema,
    reason: reason(500),
    allowEarlier: boolSchema.default(false),
    sendMail: boolSchema.default(true),
  }),
  z.object({ action: z.literal("exit-withdraw") }),
  z.object({ action: z.literal("exit-complete") }),
  z.object({ action: z.literal("expel"), reason: z.string().trim().min(3, "Bitte die Begründung angeben (mindestens 3 Zeichen).").max(1000, "Maximal 1000 Zeichen."), effectiveAt: optionalDateOnlySchema }),
  z.object({ action: z.literal("deceased"), date: optionalDateOnlySchema }),
  z.object({ action: z.literal("anonymize"), confirmNumber: z.number().int("Bitte die Mitgliedernummer eingeben.") }),
  z.object({ action: z.literal("link-user"), email: emailSchema }),
  z.object({ action: z.literal("unlink-user") }),
]);
export type MemberActionInput = z.infer<typeof memberActionSchema>;

// ---- Verwaltung: Mitgliedschaftsarten und Ämter ------------------------------------------------------------------------

export const membershipTypeSchema = z.object({
  name: text(1, 60, "Bitte einen Namen angeben."),
  description: optionalText(500),
  annualFee: chfInputSchema,
  votingRight: boolSchema,
  eligibleForBoard: boolSchema,
  selectable: boolSchema,
  active: boolSchema,
  sortOrder: z.number().int("Bitte eine ganze Zahl angeben.").min(0, "Mindestens 0.").max(999, "Höchstens 999.").default(0),
});
export const membershipTypePatchSchema = membershipTypeSchema.partial();

export const officeFieldsSchema = z.object({
  kind: oneOf(OFFICE_KINDS, "Bitte ein Amt aus der Liste wählen."),
  title: optionalText(80),
  validFrom: dateOnlySchema,
  validUntil: optionalDateOnlySchema,
  note: optionalText(300),
});

const officeRules = (v: { kind: string; title?: string; validFrom?: Date; validUntil?: Date | null }, ctx: z.RefinementCtx) => {
  if (v.kind === "SONSTIGES" && !v.title) ctx.addIssue({ code: "custom", path: ["title"], message: "Bitte die Bezeichnung des Amtes angeben." });
  if (v.validFrom && v.validUntil && v.validUntil.getTime() < v.validFrom.getTime()) {
    ctx.addIssue({ code: "custom", path: ["validUntil"], message: "Das Enddatum liegt vor dem Beginn." });
  }
};

export const officeCreateSchema = officeFieldsSchema.extend({ memberId: idSchema }).superRefine(officeRules);
export const officePatchSchema = officeFieldsSchema.partial();

// ---- Öffentliches Beitrittsformular ----------------------------------------------------------------------------------

/**
 * Beitrittsantrag. Pflicht sind nur Name und E-Mail (Datensparsamkeit); Adresse und Telefon sind freiwillig.
 * `website` ist das Honeypot-Feld und wird nie gespeichert.
 */
export const applicationSchema = z.object({
  salutation: salutation.default(""),
  firstName: text(1, 80, "Bitte den Vornamen angeben."),
  lastName: text(1, 80, "Bitte den Nachnamen angeben."),
  email: emailSchema,
  phone: phoneSchema,
  street: optionalText(100),
  houseNumber: optionalText(20),
  zip: zipSchema,
  city: optionalText(80),
  country: countrySchema,
  communicationPref: communicationPref.default("EMAIL"),
  membershipTypeId: optionalId,
  message: optionalText(1000),
  consent: z.literal(true, { error: "Bitte bestätige die Kenntnisnahme der Statuten und des Datenschutzhinweises." }),
  website: z.string().max(200).optional(),
});
export type ApplicationInput = z.infer<typeof applicationSchema>;

// ---- Portal: eigene Angaben -----------------------------------------------------------------------------------------------

/** Mitglieder ändern Anschrift, Telefon und bevorzugten Kontaktweg selbst. Name, E-Mail und Mitgliedschaftsart ändert der Vorstand. */
export const portalProfileSchema = z.object({
  salutation: salutation,
  street: optionalText(100),
  houseNumber: optionalText(20),
  zip: zipSchema,
  city: optionalText(80),
  country: countrySchema,
  phone: phoneSchema,
  communicationPref: communicationPref,
});
export const portalProfilePatchSchema = portalProfileSchema.partial();
export type PortalProfilePatch = z.infer<typeof portalProfilePatchSchema>;

export const portalExitSchema = z.object({
  reason: reason(500),
  confirm: z.literal(true, { error: "Bitte bestätige die Austrittserklärung." }),
});

// ---- Liste ----------------------------------------------------------------------------------------------------------------

export const MEMBER_SORTS = ["nr", "name", "status", "eintritt", "ort", "art"] as const;
export type MemberSort = (typeof MEMBER_SORTS)[number];
