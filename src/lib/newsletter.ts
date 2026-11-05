// Newsletter-Versand (Dashboard): Kampagne starten, Zustellungen anlegen, gedrosselt im Hintergrund versenden.
import "server-only";
import type { NewsletterCampaign } from "@prisma/client";
import { db } from "@/lib/db";
import { ApiError } from "@/lib/api";
import { runInBackground } from "@/lib/account";
import { isMailConfigured, sendMail, type SendResult } from "@/lib/mailer";
import { mailCtx } from "@/lib/mail-ctx";
import { newsletterCampaignMail } from "@/lib/mail-templates";
import { unsubscribeApiUrl, unsubscribeUrl } from "@/lib/newsletter-links";
import { getMailConfig, getNewsletterEnabled } from "@/lib/settings";
import type { CampaignDto } from "@/components/admin/newsletter/types";

/** Maximale Versandrate (Mails pro Sekunde). Schont den Mailserver und die Absender-Reputation. */
export const SEND_RATE_PER_SECOND = 4;
/** Nach so vielen Fehlern in Folge wird der Versand abgebrochen (z. B. Mailserver nicht erreichbar). */
const MAX_CONSECUTIVE_FAILURES = 10;
/** Ein SENDING-Stand ohne Lebenszeichen für diese Dauer gilt als abgebrochen und ist fortsetzbar. */
const STALE_AFTER_MS = 2 * 60_000;
/** Zähler höchstens alle X ms bzw. alle N Mails in die Datenbank schreiben (zugleich Lebenszeichen). */
const SYNC_EVERY_MS = 2_000;
const SYNC_EVERY_MAILS = 5;
const CREATE_CHUNK = 500;
const ERROR_MAX = 200;

const running = (globalThis as unknown as { __newsletterRunning?: Set<string> }).__newsletterRunning ?? new Set<string>();
(globalThis as unknown as { __newsletterRunning?: Set<string> }).__newsletterRunning = running;

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export type CampaignProgress = {
  id: string;
  status: string;
  recipientCount: number;
  sentCount: number;
  failedCount: number;
};

/** Abonnenten, die eine Kampagne erhalten: alle aktiven. Weitere Sprachen bekämen später je eine eigene Fassung. */
const RECIPIENT_WHERE = { status: "ACTIVE" } as const;

/** Datenbankzeile → JSON-taugliches Objekt (Datumswerte als ISO-Strings). */
export function serializeCampaign(c: NewsletterCampaign): CampaignDto {
  return {
    id: c.id,
    subject: c.subject,
    preheader: c.preheader,
    content: c.content,
    status: c.status,
    recipientCount: c.recipientCount,
    sentCount: c.sentCount,
    failedCount: c.failedCount,
    startedAt: c.startedAt?.toISOString() ?? null,
    sentAt: c.sentAt?.toISOString() ?? null,
    createdAt: c.createdAt.toISOString(),
    updatedAt: c.updatedAt.toISOString(),
  };
}

/** Ist der Newsletter einsatzbereit? (Mail konfiguriert UND im Dashboard eingeschaltet) */
export async function getNewsletterAvailability(): Promise<{ mailConfigured: boolean; enabled: boolean; available: boolean }> {
  const [mailConfigured, enabled] = await Promise.all([isMailConfigured(), getNewsletterEnabled().catch(() => false)]);
  return { mailConfigured, enabled, available: mailConfigured && enabled };
}

/** Zähler der Kampagne aus den Zustellungen neu berechnen (Quelle der Wahrheit) und speichern. */
async function syncCounters(campaignId: string): Promise<CampaignProgress | null> {
  const groups = await db.newsletterDelivery.groupBy({ by: ["status"], where: { campaignId }, _count: { _all: true } });
  const by: Record<string, number> = {};
  for (const g of groups) by[g.status] = g._count._all;
  const recipientCount = (by.PENDING ?? 0) + (by.SENT ?? 0) + (by.FAILED ?? 0);
  const result = await db.newsletterCampaign.updateMany({
    where: { id: campaignId },
    data: { recipientCount, sentCount: by.SENT ?? 0, failedCount: by.FAILED ?? 0, updatedAt: new Date() },
  });
  if (result.count === 0) return null;
  const c = await db.newsletterCampaign.findUnique({ where: { id: campaignId } });
  return c
    ? { id: c.id, status: c.status, recipientCount: c.recipientCount, sentCount: c.sentCount, failedCount: c.failedCount }
    : null;
}

/** Legt für alle aktiven Abonnenten fehlende Zustellungen (PENDING) an. */
async function createDeliveries(campaignId: string): Promise<void> {
  const [subscribers, existing] = await Promise.all([
    db.newsletterSubscriber.findMany({ where: RECIPIENT_WHERE, select: { id: true } }),
    db.newsletterDelivery.findMany({ where: { campaignId }, select: { subscriberId: true } }),
  ]);
  const have = new Set(existing.map((d) => d.subscriberId));
  const missing = subscribers.filter((s) => !have.has(s.id));
  for (let i = 0; i < missing.length; i += CREATE_CHUNK) {
    await db.newsletterDelivery.createMany({
      data: missing.slice(i, i + CREATE_CHUNK).map((s) => ({ campaignId, subscriberId: s.id, status: "PENDING" })),
    });
  }
}

async function finish(campaignId: string, aborted: boolean): Promise<void> {
  const progress = await syncCounters(campaignId);
  if (!progress) return;
  const pending = await db.newsletterDelivery.count({ where: { campaignId, status: "PENDING" } });
  const allFailed = progress.sentCount === 0;
  const status = aborted || pending > 0 || allFailed ? "FAILED" : "SENT";
  await db.newsletterCampaign.updateMany({
    where: { id: campaignId },
    data: { status, sentAt: status === "SENT" ? new Date() : null, updatedAt: new Date() },
  });
}

/** Versendet alle offenen Zustellungen einer (bereits übernommenen) Kampagne, gedrosselt und fortsetzbar. */
async function deliver(campaignId: string): Promise<void> {
  let aborted = false;
  try {
    const campaign = await db.newsletterCampaign.findUnique({ where: { id: campaignId } });
    const config = await getMailConfig();
    if (!campaign || !config) {
      await finish(campaignId, true);
      return;
    }

    const interval = 1000 / SEND_RATE_PER_SECOND;
    let consecutiveFailures = 0;
    let sinceSync = 0;
    let lastSync = Date.now();

    for (;;) {
      const batch = await db.newsletterDelivery.findMany({
        where: { campaignId, status: "PENDING" },
        orderBy: { id: "asc" },
        take: 50,
        include: { subscriber: { select: { email: true, name: true, status: true, unsubscribeToken: true, locale: true } } },
      });
      if (batch.length === 0) break;

      for (const delivery of batch) {
        const sub = delivery.subscriber;
        // Wer sich inzwischen abgemeldet hat, bekommt nichts mehr; die Zustellung entfällt.
        if (sub.status !== "ACTIVE") {
          await db.newsletterDelivery.delete({ where: { id: delivery.id } });
          continue;
        }

        const startedAt = Date.now();
        let result: SendResult;
        try {
          const ctx = mailCtx(sub.locale);
          const mail = newsletterCampaignMail(
            {
              subject: campaign.subject,
              preheader: campaign.preheader,
              markdown: campaign.content,
              name: sub.name,
              unsubscribeUrl: unsubscribeUrl(sub.unsubscribeToken, ctx.baseUrl),
            },
            ctx,
          );
          result = await sendMail({
            to: sub.email,
            ...mail,
            headers: {
              "List-Unsubscribe": `<${unsubscribeApiUrl(sub.unsubscribeToken, ctx.baseUrl)}>`,
              "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
            },
            config,
          });
        } catch {
          result = { ok: false, error: "Versand fehlgeschlagen." };
        }

        await db.newsletterDelivery.update({
          where: { id: delivery.id },
          data: result.ok
            ? { status: "SENT", sentAt: new Date(), error: "" }
            : { status: "FAILED", error: result.error.replace(/[\r\n]+/g, " ").slice(0, ERROR_MAX) },
        });
        consecutiveFailures = result.ok ? 0 : consecutiveFailures + 1;

        sinceSync += 1;
        if (sinceSync >= SYNC_EVERY_MAILS || Date.now() - lastSync >= SYNC_EVERY_MS) {
          await syncCounters(campaignId);
          sinceSync = 0;
          lastSync = Date.now();
        }

        if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
          aborted = true;
          break;
        }
        const wait = interval - (Date.now() - startedAt);
        if (wait > 0) await sleep(wait);
      }
      if (aborted) break;
    }
    await finish(campaignId, aborted);
  } catch (e) {
    console.error("[newsletter] Versand abgebrochen:", e instanceof Error ? e.name : "unbekannt");
    try {
      await finish(campaignId, true);
    } catch {
      /* Datenbank nicht erreichbar: der SENDING-Stand wird nach Ablauf der Frist fortsetzbar */
    }
  } finally {
    running.delete(campaignId);
  }
}

/**
 * Startet den Versand einer Kampagne: prüft Voraussetzungen, übernimmt die Kampagne atomar (kein Doppelversand),
 * legt die Zustellungen an und versendet anschliessend im Hintergrund. Liefert sofort die Zähler.
 * Fortsetzbar aus ENTWURF, FEHLGESCHLAGEN (wiederholt fehlgeschlagene Zustellungen) und einem abgebrochenen SENDING-Stand.
 */
export async function sendCampaign(campaignId: string): Promise<CampaignProgress> {
  const availability = await getNewsletterAvailability();
  if (!availability.mailConfigured) {
    throw new ApiError(409, "MAIL_NOT_CONFIGURED", "Es ist kein Mailserver eingerichtet. Richte ihn unter Einstellungen ein.");
  }
  if (!availability.enabled) {
    throw new ApiError(409, "NEWSLETTER_DISABLED", "Der Newsletter ist ausgeschaltet. Schalte ihn zuerst ein.");
  }

  const current = await db.newsletterCampaign.findUnique({ where: { id: campaignId }, select: { status: true } });
  if (!current) throw new ApiError(404, "NOT_FOUND", "Kampagne nicht gefunden.");
  if (current.status === "SENT") throw new ApiError(409, "ALREADY_SENT", "Diese Kampagne wurde bereits versendet.");
  if (running.has(campaignId)) throw new ApiError(409, "ALREADY_SENDING", "Diese Kampagne wird gerade versendet.");

  if (current.status === "DRAFT" || current.status === "FAILED") {
    const [active, open] = await Promise.all([
      db.newsletterSubscriber.count({ where: RECIPIENT_WHERE }),
      db.newsletterDelivery.count({ where: { campaignId, status: { in: ["PENDING", "FAILED"] } } }),
    ]);
    if (active === 0 && open === 0) {
      throw new ApiError(409, "NO_RECIPIENTS", "Es gibt keine aktiven Abonnenten. Die Kampagne wurde nicht versendet.");
    }
  }

  // Atomare Übernahme: genau ein Aufruf gewinnt, parallele Starts erhalten 409.
  const now = new Date();
  const previousFailed = current.status === "FAILED";
  let claimed = await db.newsletterCampaign.updateMany({
    where: { id: campaignId, status: { in: ["DRAFT", "FAILED"] } },
    data: { status: "SENDING", startedAt: now, sentAt: null, updatedAt: now },
  });
  if (claimed.count === 0) {
    claimed = await db.newsletterCampaign.updateMany({
      where: { id: campaignId, status: "SENDING", updatedAt: { lt: new Date(now.getTime() - STALE_AFTER_MS) } },
      data: { updatedAt: now },
    });
  }
  if (claimed.count === 0) {
    throw new ApiError(409, "ALREADY_SENDING", "Diese Kampagne wird gerade versendet oder wurde bereits versendet.");
  }
  running.add(campaignId);

  let progress: CampaignProgress | null;
  try {
    if (previousFailed) {
      await db.newsletterDelivery.updateMany({ where: { campaignId, status: "FAILED" }, data: { status: "PENDING", error: "" } });
    }
    await createDeliveries(campaignId);
    progress = await syncCounters(campaignId);
  } catch (e) {
    running.delete(campaignId);
    await db.newsletterCampaign.updateMany({ where: { id: campaignId, status: "SENDING" }, data: { status: "FAILED", updatedAt: new Date() } });
    throw e;
  }
  if (!progress) {
    running.delete(campaignId);
    throw new ApiError(404, "NOT_FOUND", "Kampagne nicht gefunden.");
  }

  runInBackground(() => deliver(campaignId));
  return progress;
}

/** CSV-Zelle: Anführungszeichen verdoppeln und Formel-Injektion (= + - @ Tab CR) mit ' entschärfen. */
export function csvCell(value: string): string {
  let v = value.replace(/\r\n|\r|\n/g, " ");
  if (/^[=+\-@\t\r]/.test(v)) v = `'${v}`;
  return `"${v.replace(/"/g, '""')}"`;
}
