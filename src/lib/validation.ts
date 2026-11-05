// Zod-Schemas (zod v4) – gemeinsam genutzt von API-Routen und Formularen.
import { z } from "zod";
import {
  STATUSES,
  METRIC_KINDS,
  INCIDENT_SEVERITIES,
  INCIDENT_STATUSES,
  TICKET_CATEGORIES,
  TICKET_STATUSES,
} from "@/lib/constants";
import { IMPRINT_KEYS, PRIVACY_KEYS } from "@/lib/legal-toggles";

// Deutsche Standard-Fehlermeldungen (eigene Meldungen unten haben Vorrang).
z.config(z.locales.de());

const trimmed = (min: number, max: number, msg?: string) =>
  z.string().trim().min(min, msg ?? `Mindestens ${min} Zeichen.`).max(max, `Maximal ${max} Zeichen.`);

const slug = z
  .string()
  .trim()
  .min(2, "Mindestens 2 Zeichen.")
  .max(80)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Nur Kleinbuchstaben, Ziffern und Bindestriche.");

const httpUrl = z
  .string()
  .trim()
  .max(500)
  .refine((v) => {
    try {
      const u = new URL(v);
      return u.protocol === "https:" || u.protocol === "http:";
    } catch {
      return false;
    }
  }, "Bitte eine gültige http(s)-URL angeben.");

const optionalUrl = z
  .union([httpUrl, z.literal("")])
  .nullish()
  .transform((v) => (v ? v : null));

const percent = z.coerce.number().min(0, "Mindestens 0.").max(100, "Maximal 100.");

// ---- Services ----
const serviceBase = z.object({
  name: trimmed(2, 80),
  slug,
  tagline: trimmed(0, 140).default(""),
  description: trimmed(10, 2000),
  category: trimmed(2, 60),
  url: z.union([httpUrl, z.literal("")]).default(""),
  repoUrl: optionalUrl,
  comingSoon: z.boolean().default(false),
  status: z.enum(STATUSES).default("OPERATIONAL"),
  uptime: percent.default(100),
  featured: z.boolean().default(false),
  sortOrder: z.coerce.number().int().min(0).max(9999).default(0),
});
/** Ohne "Bald verfügbar" ist die Service-URL Pflicht; bei angekündigten Diensten darf sie fehlen. */
export const serviceCreateSchema = serviceBase.refine((v) => v.comingSoon || v.url !== "", {
  path: ["url"],
  message: "Bitte gib die Service-URL an (oder markiere den Dienst als «Bald verfügbar»).",
});
export const serviceUpdateSchema = serviceBase.partial();

// ---- Blog ----
export const blogCreateSchema = z.object({
  title: trimmed(3, 160),
  slug,
  excerpt: trimmed(10, 400),
  content: trimmed(10, 100_000),
  published: z.boolean().default(false),
  author: trimmed(2, 80),
});
export const blogUpdateSchema = blogCreateSchema.partial();

// ---- Kontakt / Tickets ----
export const contactSchema = z.object({
  name: trimmed(2, 100),
  email: z.string().trim().toLowerCase().max(200).pipe(z.email("Bitte eine gültige E-Mail-Adresse angeben.")),
  subject: trimmed(3, 150),
  category: z.enum(TICKET_CATEGORIES),
  message: trimmed(10, 5000, "Bitte beschreibe dein Anliegen (mind. 10 Zeichen)."),
  consent: z.literal(true, { error: "Bitte stimme der Bearbeitung deiner Angaben zu." }),
  // Honeypot: muss leer bleiben
  website: z.string().max(0).optional().default(""),
});
export const ticketUpdateSchema = z.object({
  status: z.enum(TICKET_STATUSES).optional(),
  internalNote: z.string().max(5000).optional(),
  /** Statusänderung per E-Mail an den Absender melden (nur wirksam zusammen mit status) */
  notify: z.boolean().optional(),
});

// ---- Status: Metriken + Incidents ----
export const metricCreateSchema = z.object({
  name: trimmed(2, 80),
  slug,
  kind: z.enum(METRIC_KINDS).default("SERVER"),
  location: trimmed(0, 80).default(""),
  status: z.enum(STATUSES).default("OPERATIONAL"),
  uptime: percent.default(100),
  responseMs: z.coerce.number().int().min(0).max(600_000).nullish().transform((v) => v ?? null),
  sortOrder: z.coerce.number().int().min(0).max(9999).default(0),
});
export const metricUpdateSchema = metricCreateSchema.partial();

export const incidentCreateSchema = z.object({
  title: trimmed(3, 160),
  body: trimmed(3, 5000),
  severity: z.enum(INCIDENT_SEVERITIES).default("MINOR"),
  status: z.enum(INCIDENT_STATUSES).default("INVESTIGATING"),
  serviceId: z.string().trim().min(1).nullish().transform((v) => v || null),
  startedAt: z.coerce.date().optional(),
});
export const incidentUpdateSchema = incidentCreateSchema.partial();

// ---- Auth ----
export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email("Bitte eine gültige E-Mail-Adresse angeben.")),
  password: z.string().min(1, "Passwort erforderlich.").max(200),
});
export const passwordChangeSchema = z.object({
  currentPassword: z.string().min(1, "Aktuelles Passwort erforderlich.").max(200),
  newPassword: z
    .string()
    .min(12, "Mindestens 12 Zeichen.")
    .max(200)
    .refine((v) => /[a-z]/.test(v) && /[A-Z]/.test(v) && /\d/.test(v), "Gross-/Kleinbuchstaben und Ziffern verwenden."),
});

// ---- Website-Konten ----
const passwordRule = z
  .string()
  .min(12, "Mindestens 12 Zeichen.")
  .max(200)
  .refine((v) => /[a-z]/.test(v) && /[A-Z]/.test(v) && /\d/.test(v), "Gross-/Kleinbuchstaben und Ziffern verwenden.");

export const registerSchema = z.object({
  name: trimmed(2, 80),
  email: z.string().trim().toLowerCase().max(200).pipe(z.email("Bitte eine gültige E-Mail-Adresse angeben.")),
  password: passwordRule,
  consent: z.literal(true, { error: "Bitte stimme den Datenschutzhinweisen zu." }),
  // Honeypot
  website: z.string().max(0).optional().default(""),
});
export const forgotSchema = z.object({
  email: z.string().trim().toLowerCase().max(200).pipe(z.email("Bitte eine gültige E-Mail-Adresse angeben.")),
});
export const tokenSchema = z.object({ token: z.string().trim().min(20, "Ungültiger Link.").max(200, "Ungültiger Link.") });
export const resetSchema = tokenSchema.extend({ password: passwordRule });
export const accountUpdateSchema = z.object({ name: trimmed(2, 80) });

// ---- Einstellungen (Admin) ----
const optText = (max: number) => z.string().trim().max(max, `Maximal ${max} Zeichen.`).default("");
const switchMap = (keys: readonly string[]) =>
  z.object(Object.fromEntries(keys.map((k) => [k, z.boolean().optional()]))).default({});
export const legalSettingsSchema = z.object({
  responsible: optText(120),
  street: optText(160),
  zipCity: optText(120),
  country: optText(80),
  phone: optText(60),
  register: optText(200),
  vatId: optText(40),
  email: z.union([z.literal(""), z.string().trim().toLowerCase().max(200).pipe(z.email("Bitte eine gültige E-Mail-Adresse angeben."))]).default(""),
  smallBusiness: z.boolean().default(false),
  noRegister: z.boolean().default(false),
  // Anzeige-Schalter (Impressum: legal.show.<element>, Datenschutz: legal.show.privacy.<abschnitt>); fehlende bleiben unverändert.
  show: switchMap(IMPRINT_KEYS),
  privacyShow: switchMap(PRIVACY_KEYS),
});

export const mailSettingsSchema = z.object({
  host: z.string().trim().min(1, "Server angeben.").max(253).regex(/^[A-Za-z0-9.-]+$/, "Ungültiger Servername."),
  port: z.coerce.number().int().min(1).max(65535),
  security: z.enum(["NONE", "STARTTLS", "SSL"]),
  user: optText(200),
  // undefined = Passwort unverändert lassen, "" = löschen
  password: z.string().max(500).optional(),
  fromName: optText(100),
  fromEmail: z.string().trim().max(200).pipe(z.email("Bitte eine gültige Absender-Adresse angeben.")),
});
export const mailTestSchema = z.object({
  to: z.string().trim().toLowerCase().max(200).pipe(z.email("Bitte eine gültige E-Mail-Adresse angeben.")),
});
export const siteSettingsSchema = z.object({ registrationEnabled: z.boolean() });
export const userAdminUpdateSchema = z.object({
  disabled: z.boolean().optional(),
  verified: z.boolean().optional(),
  team: z.boolean().optional(),
  business: z.enum(["approve", "reject", "reset"]).optional(),
  teamTitle: z.string().trim().max(80, "Maximal 80 Zeichen.").optional(),
});

// ---- Newsletter ----
export const newsletterSubscribeSchema = z.object({
  email: z.string().trim().toLowerCase().max(200).pipe(z.email("Bitte eine gültige E-Mail-Adresse angeben.")),
  name: z.string().trim().max(80).default(""),
  consent: z.literal(true, { error: "Bitte stimme dem Erhalt des Newsletters zu." }),
  // Honeypot
  website: z.string().max(0).optional().default(""),
});
export const campaignSchema = z.object({
  subject: trimmed(3, 150),
  preheader: z.string().trim().max(200).default(""),
  content: trimmed(10, 100_000),
});
export const newsletterSettingsSchema = z.object({ enabled: z.boolean() });
export const newsletterTestSchema = z.object({
  to: z.string().trim().toLowerCase().max(200).pipe(z.email("Bitte eine gültige E-Mail-Adresse angeben.")),
});

// ---- Ticket-Antworten & Mail-Einstellungen ----
export const ticketReplySchema = z.object({ message: trimmed(2, 5000, "Bitte schreibe eine Antwort.") });
export const ticketMailSettingsSchema = z.object({
  confirmationEnabled: z.boolean(),
  notifyEmail: z.union([z.literal(""), z.string().trim().toLowerCase().max(200).pipe(z.email("Bitte eine gültige E-Mail-Adresse angeben."))]).default(""),
});
