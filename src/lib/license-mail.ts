// E-Mails rund um Lizenzen, Webspace-Konten und Firmenkunden.
//  - An die Person: Entscheidung (freigegeben/abgelehnt/gesperrt) in Sprache und Marke der Domain, bei der sich das Konto angelegt hat.
//    Der Lizenzschlüssel selbst steht nie in der Mail, nur der Link ins Konto.
//  - An das Team: Hinweis auf neue Anträge (immer deutsch, Link auf vylaris.eu) an die Adresse der Ticket-Einstellungen.
// Alle Funktionen sind "best effort": Sie werfen nie, ohne Mailserver passiert still nichts. Aufgerufen werden sie über
// runInBackground, damit weder die Entscheidung noch die Antwort an den Browser von der Mail abhängt.
import "server-only";
import { runInBackground, siteLink } from "@/lib/account";
import { db } from "@/lib/db";
import { adminMailCtx, mailCtxFor, type MailCtx } from "@/lib/mail-ctx";
import { oneLine } from "@/lib/mail-layout";
import {
  licenseDecisionMail,
  licenseTeamMail,
  productNameFor,
  type LicenseDecisionKind,
  type MailContent,
} from "@/lib/mail-templates";
import { sendMail } from "@/lib/mailer";
import { getMailConfig, getTicketMailSettings } from "@/lib/settings";

const EMAIL_RE = /^[^\s@<>"',;]+@[^\s@<>"',;]+\.[^\s@<>"',;]+$/;
const validAddress = (a: string) => EMAIL_RE.test(a) && !/[\r\n]/.test(a);

/** Versendet eine Mail, wenn ein Mailserver eingerichtet und die Adresse plausibel ist; sonst still nichts. */
async function deliver(to: string, build: () => MailContent): Promise<void> {
  if (!validAddress(to)) return;
  const config = await getMailConfig();
  if (!config) return;
  const mail = build();
  await sendMail({
    to,
    subject: oneLine(mail.subject),
    text: mail.text,
    html: mail.html,
    config,
  });
}

/** Hintergrundaufgabe, die Fehler schluckt (nur Fehlername wird protokolliert, nie Inhalte). */
const background = (task: () => Promise<void>) =>
  runInBackground(async () => {
    try {
      await task();
    } catch (e) {
      console.error(
        "[license-mail] Mail nicht versendet:",
        e instanceof Error ? e.name : "unbekannt",
      );
    }
  });

type Recipient = {
  email: string;
  name: string;
  disabled: boolean;
  siteKey: string;
  locale: string;
};
const recipientSelect = {
  email: true,
  name: true,
  disabled: true,
  siteKey: true,
  locale: true,
} as const;

const accountCtx = (u: Recipient): MailCtx => mailCtxFor(u.siteKey, u.locale);
const accountUrl = (ctx: MailCtx) =>
  siteLink("/account/licenses", undefined, ctx.baseUrl);

async function sendDecision(
  user: Recipient | null | undefined,
  kind: LicenseDecisionKind,
  extra: {
    product?: { name: string; nameEn?: string | null };
    company?: string | null;
    adminNote?: string | null;
  },
): Promise<void> {
  if (!user || user.disabled) return;
  const ctx = accountCtx(user);
  await deliver(user.email, () =>
    licenseDecisionMail(
      {
        kind,
        name: user.name,
        product: extra.product
          ? productNameFor(extra.product, ctx.locale)
          : undefined,
        company: extra.company,
        adminNote: extra.adminNote,
        accountUrl: accountUrl(ctx),
      },
      ctx,
    ),
  );
}

// ---- Entscheidungen an die Person ----------------------------------------------------------------------------------

/** Schlüssel freigegeben, abgelehnt oder gesperrt (andere Aktionen lösen keine Mail aus). */
export function notifyKeyDecision(
  keyId: string,
  action: "approve" | "reject" | "revoke",
): void {
  background(async () => {
    const row = await db.licenseKey.findUnique({
      where: { id: keyId },
      select: {
        adminNote: true,
        product: { select: { name: true, nameEn: true } },
        user: { select: recipientSelect },
      },
    });
    if (!row) return;
    const kind =
      action === "approve"
        ? "keyApproved"
        : action === "reject"
          ? "keyRejected"
          : "keyRevoked";
    await sendDecision(row.user, kind, {
      product: row.product,
      adminNote: row.adminNote,
    });
  });
}

export function notifyWebspaceDecision(
  requestId: string,
  action: "approve" | "reject",
): void {
  background(async () => {
    const row = await db.webspaceRequest.findUnique({
      where: { id: requestId },
      select: {
        adminNote: true,
        product: { select: { name: true, nameEn: true } },
        user: { select: recipientSelect },
      },
    });
    if (!row) return;
    await sendDecision(
      row.user,
      action === "approve" ? "webspaceApproved" : "webspaceRejected",
      { product: row.product, adminNote: row.adminNote },
    );
  });
}

export function notifyBusinessDecision(
  userId: string,
  action: "approve" | "reject",
): void {
  background(async () => {
    const user = await db.user.findUnique({
      where: { id: userId },
      select: { ...recipientSelect, companyName: true },
    });
    await sendDecision(
      user,
      action === "approve" ? "businessApproved" : "businessRejected",
      { company: user?.companyName },
    );
  });
}

// ---- Hinweise an das Team ------------------------------------------------------------------------------------------

type TeamNotice = {
  kind: "key" | "webspace" | "business";
  adminPath: string;
  user: { name: string; email: string; siteKey: string };
  product?: string;
  company?: string | null;
  message?: string | null;
};

/** Sendet den Hinweis an die Benachrichtigungsadresse der Ticket-Einstellungen; ohne Adresse oder Mailserver passiert nichts. */
async function sendTeamNotice(n: TeamNotice): Promise<void> {
  const { notifyEmail } = await getTicketMailSettings();
  if (!notifyEmail) return;
  const ctx = adminMailCtx();
  const origin = mailCtxFor(n.user.siteKey).site.domain;
  await deliver(notifyEmail, () =>
    licenseTeamMail(
      {
        kind: n.kind,
        userName: n.user.name,
        userEmail: n.user.email,
        product: n.product,
        company: n.company,
        message: n.message,
        origin,
        adminUrl: siteLink(n.adminPath, undefined, ctx.baseUrl),
      },
      ctx,
    ),
  );
}

/** Neuer Schlüssel-Antrag, der auf Freigabe wartet (der Aufrufer ruft das nur bei Status PENDING auf). */
export function notifyTeamNewKeyRequest(keyId: string): void {
  background(async () => {
    const row = await db.licenseKey.findUnique({
      where: { id: keyId },
      select: {
        status: true,
        message: true,
        product: { select: { name: true } },
        user: { select: { name: true, email: true, siteKey: true } },
      },
    });
    if (!row || row.status !== "PENDING") return;
    await sendTeamNotice({
      kind: "key",
      adminPath: "/admin/licenses?tab=keys",
      user: row.user,
      product: row.product.name,
      message: row.message,
    });
  });
}

export function notifyTeamNewWebspaceRequest(requestId: string): void {
  background(async () => {
    const row = await db.webspaceRequest.findUnique({
      where: { id: requestId },
      select: {
        status: true,
        message: true,
        product: { select: { name: true } },
        user: { select: { name: true, email: true, siteKey: true } },
      },
    });
    if (!row || row.status !== "PENDING") return;
    await sendTeamNotice({
      kind: "webspace",
      adminPath: "/admin/licenses?tab=webspace",
      user: row.user,
      product: row.product.name,
      message: row.message,
    });
  });
}

export function notifyTeamNewBusinessRequest(userId: string): void {
  background(async () => {
    const user = await db.user.findUnique({
      where: { id: userId },
      select: {
        name: true,
        email: true,
        siteKey: true,
        companyName: true,
        businessStatus: true,
      },
    });
    if (!user || user.businessStatus !== "PENDING") return;
    await sendTeamNotice({
      kind: "business",
      adminPath: "/admin/users",
      user,
      company: user.companyName,
    });
  });
}
