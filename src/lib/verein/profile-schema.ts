// Vereinsstammdaten (Name, Sitz, Gründungsdatum, Zweck, UID, Register): Schlüssel in SiteSetting («verein.profile.*»), Zod-Schema und
// Prüfung der UID. Reine Funktionen ohne Seiteneffekte; Lesen und Schreiben: ./profile.ts.
//
// Nichts erfinden: Sitz, Gründungsdatum, Zweck und Registerangaben trägt der Verein selbst ein. Der Name fällt auf den Rechtsträger
// der Website (src/lib/sites.ts) zurück, solange nichts eingetragen ist.
import { z } from "zod";
import { parseDateOnly } from "./dates";

export const PROFILE_SETTING_KEYS = {
  name: "verein.profile.name",
  seat: "verein.profile.seat",
  foundedOn: "verein.profile.foundedOn",
  purpose: "verein.profile.purpose",
  uid: "verein.profile.uid",
  register: "verein.profile.register",
} as const;
export type ProfileField = keyof typeof PROFILE_SETTING_KEYS;

export type VereinProfile = {
  name: string;
  /** Sitz (politische Gemeinde) gemäss Statuten */
  seat: string;
  /** Gründungsdatum als «JJJJ-MM-TT» oder leer */
  foundedOn: string;
  /** Zweck gemäss Statuten */
  purpose: string;
  /** Unternehmens-Identifikationsnummer «CHE-123.456.789» oder leer */
  uid: string;
  /** Eintrag im Handelsregister (Freitext), leer = nicht eingetragen oder nicht angegeben */
  register: string;
};

export const DEFAULT_PROFILE: VereinProfile = { name: "", seat: "", foundedOn: "", purpose: "", uid: "", register: "" };

/** Zeichenfolge «CHE-123.456.789» aus verschiedenen Schreibweisen («CHE123456789», «che 123 456 789») oder null. */
export function normalizeUid(input: string): string | null {
  const digits = /^\s*CHE[\s.-]*(\d{3})[\s.-]*(\d{3})[\s.-]*(\d{3})\s*$/i.exec(input);
  return digits ? `CHE-${digits[1]}.${digits[2]}.${digits[3]}` : null;
}

/** Prüfziffer der UID (Modulo 11 mit den Gewichten 5, 4, 3, 2, 7, 6, 5, 4). Gibt false bei falscher Form oder Prüfziffer zurück. */
export function isValidUid(input: string): boolean {
  const norm = normalizeUid(input);
  if (!norm) return false;
  const d = norm.replace(/\D/g, "").split("").map(Number);
  const weights = [5, 4, 3, 2, 7, 6, 5, 4];
  const sum = weights.reduce((acc, w, i) => acc + w * (d[i] ?? 0), 0);
  let check = 11 - (sum % 11);
  if (check === 11) check = 0;
  if (check === 10) return false; // so eine Prüfziffer wird nicht vergeben
  return check === d[8];
}

const line = (max: number) => z.string().trim().max(max, `Maximal ${max} Zeichen.`);

const foundedOnField = line(10).refine((v) => v === "" || (/^\d{4}-\d{2}-\d{2}$/.test(v) && parseDateOnly(v) !== null), "Bitte ein gültiges Datum angeben.");
const uidField = line(30)
  .refine((v) => v === "" || isValidUid(v), "Bitte eine gültige UID angeben, z. B. CHE-123.456.789 (Prüfziffer stimmt nicht).")
  .transform((v) => (v === "" ? "" : (normalizeUid(v) ?? v)));

export const vereinProfileSchema = z.object({
  name: line(100),
  seat: line(100),
  foundedOn: foundedOnField,
  purpose: z.string().max(1000, "Maximal 1000 Zeichen."),
  uid: uidField,
  register: line(200),
}) satisfies z.ZodType<VereinProfile>;

export const vereinProfilePatchSchema = vereinProfileSchema.partial();

/** Liest die Rohwerte (SiteSetting) tolerant: ungültige Werte fallen auf die Voreinstellung zurück. */
export function parseVereinProfile(raw: Readonly<Record<string, string>>): VereinProfile {
  const out: VereinProfile = { ...DEFAULT_PROFILE };
  for (const field of Object.keys(PROFILE_SETTING_KEYS) as ProfileField[]) {
    const stored = raw[PROFILE_SETTING_KEYS[field]];
    if (stored === undefined) continue;
    const parsed = (vereinProfileSchema.shape[field] as z.ZodType<string>).safeParse(stored);
    if (parsed.success) out[field] = parsed.data;
  }
  return out;
}

/** Wandelt (Teil-)Stammdaten in SiteSetting-Werte. Leere Werte löschen den Eintrag. */
export function serializeVereinProfile(patch: Partial<VereinProfile>): Record<string, string | null> {
  const out: Record<string, string | null> = {};
  for (const field of Object.keys(patch) as ProfileField[]) {
    const v = patch[field];
    out[PROFILE_SETTING_KEYS[field]] = v === undefined || v === "" ? null : v;
  }
  return out;
}

/** Name für Karten, Mails und Ausweis: eingetragener Name, sonst der Rechtsträger der Website. */
export const profileDisplayName = (p: Pick<VereinProfile, "name">, fallback: string): string => p.name.trim() || fallback;
