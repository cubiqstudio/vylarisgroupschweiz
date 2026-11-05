import "server-only";
import { db } from "@/lib/db";
import { decryptSecret, encryptSecret } from "@/lib/crypto";
import { SITE } from "@/lib/sites";
import {
  LEGAL_FIELDS,
  LEGAL_FLAGS,
  LEGACY_SETTING_KEYS,
  PRIVACY_UPDATED_KEY,
  parseIsoDate,
  privacyChanged,
  resolveShow,
  showToSettings,
  todayZurich,
  type ImprintShow,
  type LegalContent,
  type LegalField,
  type LegalFlag,
  type PrivacyShow,
  type PrivacySnapshot,
} from "@/lib/legal-toggles";

// Einstellungen liegen als Key/Value in der DB und sind im Admin (Einstellungen) editierbar.
// Für die Anbieterangaben (Impressum) dienen die LEGAL_*/CONTACT_EMAIL-Umgebungsvariablen (vom Installer gesetzt) als Vorgabe;
// die Werte des Vereins (Anschrift, Telefon, E-Mail) stehen im Seed bzw. in den Admin-Einstellungen, nicht im Code.

export { LEGAL_FIELDS, LEGAL_FLAGS };
export type { LegalField, LegalFlag };
/** Anbieterangaben + Aussagen zum Verein (smallBusiness = nicht mehrwertsteuerpflichtig, noRegister = kein Registereintrag)
 *  + Anzeige-Schalter für Impressum (show) und Datenschutzerklärung (privacyShow) + Stand der Erklärung (leer = noch nie gespeichert). */
export type LegalSettings = Record<LegalField, string> &
  Record<LegalFlag, boolean> & { show: ImprintShow; privacyShow: PrivacyShow; privacyUpdatedAt: string };

export const MAIL_SECURITY = ["NONE", "STARTTLS", "SSL"] as const;
export type MailSecurity = (typeof MAIL_SECURITY)[number];

const env = (k: string) => process.env[k]?.trim() ?? "";
const LEGAL_ENV: Record<LegalField, string> = {
  responsible: "",
  street: env("LEGAL_STREET"),
  zipCity: env("LEGAL_ZIP_CITY"),
  country: env("LEGAL_COUNTRY") || "Schweiz",
  phone: env("LEGAL_PHONE"),
  register: env("LEGAL_REGISTER"),
  vatId: env("LEGAL_VAT_ID"),
  email: env("CONTACT_EMAIL"),
};

export async function getAllSettings(): Promise<Record<string, string>> {
  const rows = await db.siteSetting.findMany();
  return Object.fromEntries(rows.map((r) => [r.key, r.value]));
}

/** Schreibt mehrere Einstellungen. Wert `null` löscht den Eintrag (→ Vorgabe/Env gilt wieder). */
export async function setSettings(values: Record<string, string | null>): Promise<void> {
  await db.$transaction(
    Object.entries(values).map(([key, value]) =>
      value === null
        ? db.siteSetting.deleteMany({ where: { key } })
        : db.siteSetting.upsert({ where: { key }, create: { key, value }, update: { value } }),
    ),
  );
}

// ---- Impressum / Rechtliches ----
export async function getLegalSettings(): Promise<LegalSettings> {
  const all = await getAllSettings();
  const fields = {} as Record<LegalField, string>;
  for (const f of LEGAL_FIELDS) fields[f] = (all[`legal.${f}`] ?? "").trim() || LEGAL_ENV[f];
  const flags = {} as Record<LegalFlag, boolean>;
  for (const f of LEGAL_FLAGS) flags[f] = all[`legal.${f}`] === "true";
  // Ohne eigene Angabe zeichnet die Leitung des Vereins (Präsident) verantwortlich.
  if (!fields.responsible) fields.responsible = SITE.leader.name;
  // Anzeige-Schalter: gespeicherte Werte, sonst frühere Häkchen («ausblenden»), sonst Vorgabe (siehe resolveShow).
  const { imprint, privacy } = resolveShow(all, { ...fields, ...flags, boardCount: SITE.board.length } satisfies LegalContent);
  return { ...fields, ...flags, show: imprint, privacyShow: privacy, privacyUpdatedAt: parseIsoDate(all[PRIVACY_UPDATED_KEY]) };
}

const snapshotOf = (l: LegalSettings): PrivacySnapshot => ({
  street: l.street,
  zipCity: l.zipCity,
  country: l.country,
  email: l.email,
  phone: l.phone,
  showPhone: l.show.phone,
  privacy: l.privacyShow,
});

export type LegalSaveInput = Partial<Record<LegalField, string>> &
  Partial<Record<LegalFlag, boolean>> & {
    show?: Partial<Record<string, boolean | undefined>>;
    privacyShow?: Partial<Record<string, boolean | undefined>>;
  };

export async function saveLegalSettings(v: LegalSaveInput): Promise<void> {
  const before = await getLegalSettings();
  const rec: Record<string, string | null> = {};
  for (const f of LEGAL_FIELDS) if (v[f] !== undefined) rec[`legal.${f}`] = v[f]!.trim();
  for (const f of LEGAL_FLAGS) if (v[f] !== undefined) rec[`legal.${f}`] = v[f] ? "true" : "false";
  // Alle Schalter ausdrücklich speichern (auf Basis der aufgelösten Werte, damit nichts aus früheren Häkchen verloren geht),
  // danach die früheren Schlüssel entfernen.
  const show = { ...before.show, ...v.show };
  const privacyShow = { ...before.privacyShow, ...v.privacyShow };
  Object.assign(rec, showToSettings(show, privacyShow));
  for (const k of LEGACY_SETTING_KEYS) rec[k] = null;
  // Stand der Datenschutzerklärung: erneuern, wenn sich ihr Inhalt durch diese Einstellungen geändert hat (oder noch keiner gespeichert ist).
  const after: LegalSettings = {
    ...before,
    ...Object.fromEntries(LEGAL_FIELDS.filter((f) => v[f] !== undefined).map((f) => [f, v[f]!.trim()])),
    show: show as ImprintShow,
    privacyShow: privacyShow as PrivacyShow,
  };
  if (!before.privacyUpdatedAt || privacyChanged(snapshotOf(before), snapshotOf(after))) rec[PRIVACY_UPDATED_KEY] = todayZurich();
  await setSettings(rec);
}

// ---- Mail (SMTP) ----
export type MailConfig = {
  host: string;
  port: number;
  security: MailSecurity;
  user: string;
  password: string;
  fromName: string;
  fromEmail: string;
};

export async function getMailConfig(): Promise<MailConfig | null> {
  const a = await getAllSettings();
  const host = (a["mail.host"] ?? "").trim();
  const fromEmail = (a["mail.fromEmail"] ?? "").trim();
  if (!host || !fromEmail) return null;
  const sec = a["mail.security"] as MailSecurity;
  return {
    host,
    port: Number(a["mail.port"]) || 587,
    security: (MAIL_SECURITY as readonly string[]).includes(sec) ? sec : "STARTTLS",
    user: (a["mail.user"] ?? "").trim(),
    password: decryptSecret(a["mail.password"]) ?? "",
    fromName: (a["mail.fromName"] ?? "").trim(),
    fromEmail,
  };
}

/** Für das Admin-Formular: ohne Passwort, nur mit Hinweis, ob eines gespeichert ist. */
export async function getMailSettingsPublic() {
  const a = await getAllSettings();
  return {
    host: a["mail.host"] ?? "",
    port: Number(a["mail.port"]) || 587,
    security: ((MAIL_SECURITY as readonly string[]).includes(a["mail.security"]) ? a["mail.security"] : "STARTTLS") as MailSecurity,
    user: a["mail.user"] ?? "",
    hasPassword: Boolean(a["mail.password"]),
    passwordUnreadable: Boolean(a["mail.password"]) && decryptSecret(a["mail.password"]) === null,
    fromName: a["mail.fromName"] ?? "",
    fromEmail: a["mail.fromEmail"] ?? "",
  };
}

export type MailSettingsInput = {
  host: string;
  port: number;
  security: MailSecurity;
  user: string;
  /** undefined = unverändert lassen, "" = löschen */
  password?: string;
  fromName: string;
  fromEmail: string;
};

export async function saveMailSettings(v: MailSettingsInput): Promise<void> {
  const rec: Record<string, string | null> = {
    "mail.host": v.host.trim(),
    "mail.port": String(v.port),
    "mail.security": v.security,
    "mail.user": v.user.trim(),
    "mail.fromName": v.fromName.trim(),
    "mail.fromEmail": v.fromEmail.trim(),
  };
  if (v.password !== undefined) rec["mail.password"] = v.password === "" ? null : encryptSecret(v.password);
  await setSettings(rec);
}

// ---- Website ----
export async function getRegistrationEnabled(): Promise<boolean> {
  const a = await getAllSettings();
  return a["site.registrationEnabled"] === "true";
}
export async function setRegistrationEnabled(on: boolean): Promise<void> {
  await setSettings({ "site.registrationEnabled": on ? "true" : "false" });
}

// ---- Newsletter & Tickets ----
export async function getNewsletterEnabled(): Promise<boolean> {
  const a = await getAllSettings();
  return a["newsletter.enabled"] === "true";
}
export async function setNewsletterEnabled(on: boolean): Promise<void> {
  await setSettings({ "newsletter.enabled": on ? "true" : "false" });
}

export type TicketMailSettings = {
  /** Eingangsbestätigung an den Absender senden (Standard: an, sofern Mail konfiguriert) */
  confirmationEnabled: boolean;
  /** Hinweis-Mail an diese Adresse bei jedem neuen Ticket (leer = keine) */
  notifyEmail: string;
};
export async function getTicketMailSettings(): Promise<TicketMailSettings> {
  const a = await getAllSettings();
  return { confirmationEnabled: a["tickets.confirmationEnabled"] !== "false", notifyEmail: (a["tickets.notifyEmail"] ?? "").trim() };
}
export async function saveTicketMailSettings(v: TicketMailSettings): Promise<void> {
  await setSettings({
    "tickets.confirmationEnabled": v.confirmationEnabled ? "true" : "false",
    "tickets.notifyEmail": v.notifyEmail.trim(),
  });
}
