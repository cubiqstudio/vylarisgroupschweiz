import "server-only";
import { db } from "@/lib/db";
import { decryptSecret, encryptSecret } from "@/lib/crypto";

// Einstellungen liegen als Key/Value in der DB und sind im Admin (Einstellungen) editierbar.
// Für Impressum-Daten dienen die LEGAL_*/CONTACT_EMAIL-Umgebungsvariablen (vom Installer gesetzt) als Vorgabe.

export const LEGAL_FIELDS = ["responsible", "street", "zipCity", "country", "phone", "register", "vatId", "email"] as const;
export type LegalField = (typeof LEGAL_FIELDS)[number];
export const LEGAL_FLAGS = ["smallBusiness", "noRegister", "hideRegister", "hideVat"] as const;
export type LegalFlag = (typeof LEGAL_FLAGS)[number];
/** Texte + Häkchen: smallBusiness = Kleinunternehmer nach § 19 UStG (keine USt-IdNr.), noRegister = kein Registereintrag,
 *  hideRegister / hideVat = Zeile "Registereintrag" bzw. "Umsatzsteuer-ID" im Impressum gar nicht anzeigen. */
export type LegalSettings = Record<LegalField, string> & Record<LegalFlag, boolean>;

export const MAIL_SECURITY = ["NONE", "STARTTLS", "SSL"] as const;
export type MailSecurity = (typeof MAIL_SECURITY)[number];

const env = (k: string) => process.env[k]?.trim() ?? "";
const LEGAL_ENV: Record<LegalField, string> = {
  responsible: "",
  street: env("LEGAL_STREET"),
  zipCity: env("LEGAL_ZIP_CITY"),
  country: env("LEGAL_COUNTRY") || "Deutschland",
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
  const out = {} as LegalSettings;
  for (const f of LEGAL_FIELDS) out[f] = (all[`legal.${f}`] ?? "").trim() || LEGAL_ENV[f];
  for (const f of LEGAL_FLAGS) out[f] = all[`legal.${f}`] === "true";
  if (!out.responsible) out.responsible = "Lucas Wilms";
  return out;
}

export async function saveLegalSettings(v: Partial<LegalSettings>): Promise<void> {
  const rec: Record<string, string> = {};
  for (const f of LEGAL_FIELDS) if (v[f] !== undefined) rec[`legal.${f}`] = v[f]!.trim();
  for (const f of LEGAL_FLAGS) if (v[f] !== undefined) rec[`legal.${f}`] = v[f] ? "true" : "false";
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
