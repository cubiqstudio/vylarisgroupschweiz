// Beitragsjahre, Rechnungslauf, Mahnwesen, Zahlungsabgleich, offene Posten und Export (Besitzer: Beiträge). Nur serverseitig.
import "server-only";
import type { Prisma } from "@prisma/client";
import { ApiError } from "@/lib/api";
import { db } from "@/lib/db";
import { auditActor, diffObjects, logAudit } from "./audit";
import { addDays, fiscalYearRange, formatDateCh, startOfDayZurich, todayZurich } from "./dates";
import {
  agingSummary,
  daysOverdue,
  feeItemDescription,
  invoiceLinkExpiry,
  paymentStateLabel,
  periodLabel,
  planInvoiceRun,
  RUN_SKIP_LABEL,
  type RunSkipReason,
} from "./fees-calc";
import {
  assertInvoicingReady,
  createInvoiceRecord,
  newViewToken,
  recordPayment,
  sha256,
  type Actor,
  type PaymentResult,
} from "./fees-data";
import { sendReminderMail } from "./fees-mail";
import { matchRow, parseBankCsv, type ImportRow, type MatchInvoice, type MatchResult } from "./fees-import";
import { dueDateForLevel, reminderStateOf, type ReminderState } from "./fees-reminders";
import type { PaymentMethod } from "./constants";
import { formatChf, openAmount } from "./money";
import { parseInvoiceReference } from "./qr-bill";
import { fiscalStartOf, getVereinSettings, missingForReminders, reminderFeeFor, type VereinSettings } from "./settings";
import { emailSchema } from "./validation";

const conflict = (message: string): never => {
  throw new ApiError(409, "CONFLICT", message);
};

// ---- Beitragsjahre ------------------------------------------------------------------------------------------------------

export type PeriodRow = {
  id: string;
  year: number;
  label: string;
  startsOn: Date;
  endsOn: Date;
  invoicedAt: Date | null;
  note: string;
  rates: Array<{ membershipTypeId: string; name: string; amountRappen: number }>;
  invoiceCount: number;
  invoicedRappen: number;
  paidRappen: number;
};

export async function listPeriods(): Promise<PeriodRow[]> {
  const [periods, sums] = await Promise.all([
    db.feePeriod.findMany({
      orderBy: { year: "desc" },
      include: { rates: { include: { membershipType: { select: { name: true, sortOrder: true } } } }, _count: { select: { invoices: true } } },
    }),
    db.invoice.groupBy({ by: ["periodId"], where: { periodId: { not: null }, status: { in: ["OFFEN", "BEZAHLT"] } }, _sum: { totalRappen: true, paidRappen: true } }),
  ]);
  const sumBy = new Map(sums.map((s) => [s.periodId, s._sum]));
  return periods.map((p) => ({
    id: p.id,
    year: p.year,
    label: p.label,
    startsOn: p.startsOn,
    endsOn: p.endsOn,
    invoicedAt: p.invoicedAt,
    note: p.note,
    rates: p.rates.sort((a, b) => a.membershipType.sortOrder - b.membershipType.sortOrder || a.membershipType.name.localeCompare(b.membershipType.name, "de")).map((r) => ({ membershipTypeId: r.membershipTypeId, name: r.membershipType.name, amountRappen: r.amountRappen })),
    invoiceCount: p._count.invoices,
    invoicedRappen: sumBy.get(p.id)?.totalRappen ?? 0,
    paidRappen: sumBy.get(p.id)?.paidRappen ?? 0,
  }));
}

/** Aktive Mitgliedschaftsarten mit Standardbeitrag (Vorbelegung der Beiträge je Beitragsjahr). */
export function listFeeTypes() {
  return db.membershipType.findMany({ where: { active: true }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }], select: { id: true, name: true, annualFeeRappen: true } });
}

async function validRates(rates: ReadonlyArray<{ membershipTypeId: string; amount: number }>) {
  const ids = [...new Set(rates.map((r) => r.membershipTypeId))];
  if (ids.length !== rates.length) throw new ApiError(422, "VALIDATION_ERROR", "Eine Mitgliedschaftsart ist doppelt aufgeführt.", { rates: "Doppelte Mitgliedschaftsart." });
  const found = await db.membershipType.findMany({ where: { id: { in: ids } }, select: { id: true } });
  if (found.length !== ids.length) throw new ApiError(422, "VALIDATION_ERROR", "Eine Mitgliedschaftsart existiert nicht.", { rates: "Unbekannte Mitgliedschaftsart." });
  for (const r of rates) if (r.amount > 2_000_000_000) throw new ApiError(422, "VALIDATION_ERROR", "Ein Beitrag ist zu gross.", { rates: "Betrag zu gross." });
}

export async function createPeriod(
  admin: Actor,
  input: { year: number; label: string; startsOn?: Date; endsOn?: Date; note: string; rates: ReadonlyArray<{ membershipTypeId: string; amount: number }> },
): Promise<{ id: string }> {
  const settings = await getVereinSettings();
  const range = fiscalYearRange(input.year, fiscalStartOf(settings));
  const startsOn = input.startsOn ?? range.start;
  const endsOn = input.endsOn ?? range.end;
  if (endsOn.getTime() <= startsOn.getTime()) throw new ApiError(422, "VALIDATION_ERROR", "Das Ende muss nach dem Beginn liegen.", { endsOn: "Nach dem Beginn." });
  if (await db.feePeriod.findUnique({ where: { year: input.year }, select: { id: true } })) conflict(`Für ${input.year} besteht bereits ein Beitragsjahr.`);
  let rates = [...input.rates];
  if (rates.length === 0) {
    // Vorbelegung: Standardbeiträge der Mitgliedschaftsarten (vom Verein festgelegt)
    rates = (await listFeeTypes()).filter((t) => t.annualFeeRappen > 0).map((t) => ({ membershipTypeId: t.id, amount: t.annualFeeRappen }));
  } else await validRates(rates);
  return db.$transaction(async (tx) => {
    const p = await tx.feePeriod.create({
      data: { year: input.year, label: input.label, startsOn, endsOn, note: input.note, rates: { create: rates.map((r) => ({ membershipTypeId: r.membershipTypeId, amountRappen: r.amount })) } },
      select: { id: true },
    });
    await logAudit(tx, { actor: auditActor(admin), action: "period.create", objectType: "FeePeriod", objectId: p.id, summary: `Beitragsjahr ${input.year} angelegt`, after: { year: input.year, startsOn, endsOn, rates: rates.map((r) => `${r.membershipTypeId}: ${r.amount}`) } });
    return p;
  });
}

export async function updatePeriod(
  admin: Actor,
  id: string,
  patch: { label?: string; startsOn?: Date; endsOn?: Date; note?: string; rates?: ReadonlyArray<{ membershipTypeId: string; amount: number }> },
): Promise<void> {
  const before = await db.feePeriod.findUnique({ where: { id }, include: { rates: true, _count: { select: { invoices: true } } } });
  if (!before) throw new ApiError(404, "NOT_FOUND", "Beitragsjahr nicht gefunden.");
  const startsOn = patch.startsOn ?? before.startsOn;
  const endsOn = patch.endsOn ?? before.endsOn;
  if (endsOn.getTime() <= startsOn.getTime()) throw new ApiError(422, "VALIDATION_ERROR", "Das Ende muss nach dem Beginn liegen.", { endsOn: "Nach dem Beginn." });
  if ((patch.startsOn || patch.endsOn) && before._count.invoices > 0) conflict("Zu diesem Beitragsjahr bestehen schon Rechnungen. Beginn und Ende lassen sich nicht mehr ändern.");
  if (patch.rates) await validRates(patch.rates);
  await db.$transaction(async (tx) => {
    await tx.feePeriod.update({ where: { id }, data: { label: patch.label, startsOn: patch.startsOn, endsOn: patch.endsOn, note: patch.note } });
    if (patch.rates) {
      await tx.feePeriodRate.deleteMany({ where: { periodId: id } });
      await tx.feePeriodRate.createMany({ data: patch.rates.map((r) => ({ periodId: id, membershipTypeId: r.membershipTypeId, amountRappen: r.amount })) });
    }
    const rateText = (rs: Array<{ membershipTypeId: string; amountRappen: number }>) => rs.map((r) => `${r.membershipTypeId}: ${r.amountRappen}`).sort();
    const diff = diffObjects(
      { label: before.label, startsOn: before.startsOn, endsOn: before.endsOn, note: before.note, rates: rateText(before.rates) },
      {
        label: patch.label ?? before.label,
        startsOn,
        endsOn,
        note: patch.note ?? before.note,
        rates: patch.rates ? rateText(patch.rates.map((r) => ({ membershipTypeId: r.membershipTypeId, amountRappen: r.amount }))) : rateText(before.rates),
      },
    );
    await logAudit(tx, { actor: auditActor(admin), action: "period.update", objectType: "FeePeriod", objectId: id, summary: `Beitragsjahr ${before.year} geändert`, ...diff });
  });
}

export async function deletePeriod(admin: Actor, id: string): Promise<void> {
  const p = await db.feePeriod.findUnique({ where: { id }, select: { year: true, _count: { select: { invoices: true } } } });
  if (!p) throw new ApiError(404, "NOT_FOUND", "Beitragsjahr nicht gefunden.");
  if (p._count.invoices > 0) conflict("Zu diesem Beitragsjahr bestehen Rechnungen. Es kann nicht gelöscht werden.");
  await db.$transaction(async (tx) => {
    await tx.feePeriod.delete({ where: { id } });
    await logAudit(tx, { actor: auditActor(admin), action: "period.delete", objectType: "FeePeriod", objectId: id, summary: `Beitragsjahr ${p.year} gelöscht` });
  });
}

// ---- Rechnungslauf --------------------------------------------------------------------------------------------------------

export type RunOutcome = {
  dryRun: boolean;
  count: number;
  totalRappen: number;
  skipped: Array<{ reason: RunSkipReason; label: string; count: number }>;
  sample: Array<{ name: string; amountRappen: number; months: number | null }>;
  created: number;
};

/** Die Sperre eines Rechnungslaufs gilt höchstens so lange (Schutz vor einem abgebrochenen Lauf). */
const RUN_LOCK_MS = 5 * 60 * 1000;

type RunMember = Parameters<typeof createInvoiceRecord>[1]["member"];

export async function runPeriod(
  admin: Actor,
  periodId: string,
  opts: { dryRun: boolean; prorate: boolean; roundToFive: boolean; categoryId: string | null; issueDate?: Date },
): Promise<RunOutcome> {
  const settings = await getVereinSettings();
  if (!opts.dryRun) assertInvoicingReady(settings);
  const period = await db.feePeriod.findUnique({ where: { id: periodId }, include: { rates: true } });
  if (!period) throw new ApiError(404, "NOT_FOUND", "Beitragsjahr nicht gefunden.");
  if (opts.categoryId) {
    const cat = await db.accountCategory.findFirst({ where: { id: opts.categoryId, kind: "EINNAHMEN", active: true }, select: { id: true } });
    if (!cat) throw new ApiError(422, "VALIDATION_ERROR", "Das gewählte Ertragskonto ist nicht verfügbar.", { categoryId: "Bitte ein aktives Einnahmenkonto wählen." });
  }
  const members = await db.member.findMany({
    where: { status: "AKTIV", anonymizedAt: null },
    orderBy: { memberNumber: "asc" },
    select: { id: true, memberNumber: true, status: true, joinedAt: true, membershipTypeId: true, firstName: true, lastName: true, street: true, houseNumber: true, zip: true, city: true, country: true },
  });
  const existing = await db.invoice.findMany({ where: { periodId, status: { not: "STORNIERT" } }, select: { memberId: true } });
  const plan = planInvoiceRun(members, new Map(period.rates.map((r) => [r.membershipTypeId, r.amountRappen])), new Set(existing.map((e) => e.memberId)), period, { prorate: opts.prorate, roundToFive: opts.roundToFive });
  const byId = new Map(members.map((m) => [m.id, m]));

  const skippedCounts = new Map<RunSkipReason, number>();
  for (const s of plan.skipped) skippedCounts.set(s.reason, (skippedCounts.get(s.reason) ?? 0) + 1);
  const outcome: RunOutcome = {
    dryRun: opts.dryRun,
    count: plan.entries.length,
    totalRappen: plan.totalRappen,
    skipped: [...skippedCounts.entries()].map(([reason, count]) => ({ reason, label: RUN_SKIP_LABEL[reason], count })),
    sample: plan.entries.slice(0, 8).map((e) => ({ name: `${byId.get(e.memberId)!.firstName} ${byId.get(e.memberId)!.lastName}`, amountRappen: e.amountRappen, months: e.months })),
    created: 0,
  };
  if (opts.dryRun || plan.entries.length === 0) return outcome;

  // Sperre gegen gleichzeitige Läufe (Doppelklick, zwei Sitzungen): nur ein Aufruf bekommt sie, sie läuft nach wenigen Minuten ab.
  const lockedAt = new Date();
  const lock = await db.feePeriod.updateMany({
    where: { id: periodId, OR: [{ runLockedAt: null }, { runLockedAt: { lt: new Date(lockedAt.getTime() - RUN_LOCK_MS) } }] },
    data: { runLockedAt: lockedAt },
  });
  if (lock.count === 0) conflict("Für dieses Beitragsjahr läuft gerade ein Rechnungslauf. Bitte warte einen Moment und lade die Seite neu.");
  try {
    const created = await createRunInvoices(admin, period, plan.entries, byId, settings, opts);
    await db.$transaction(async (tx) => {
      await tx.feePeriod.update({ where: { id: periodId }, data: { invoicedAt: new Date() } });
      await logAudit(tx, {
        actor: auditActor(admin),
        action: "invoice.run",
        objectType: "FeePeriod",
        objectId: periodId,
        summary: `Rechnungslauf ${period.year}: ${created} Rechnungen als Entwurf erstellt (CHF ${formatChf(plan.totalRappen)})`,
        after: { year: period.year, created, totalRappen: plan.totalRappen, prorate: opts.prorate, roundToFive: opts.roundToFive },
      });
    });
    return { ...outcome, created };
  } finally {
    await db.feePeriod.updateMany({ where: { id: periodId, runLockedAt: lockedAt }, data: { runLockedAt: null } });
  }
}

/** Legt die Rechnungen des Laufs an (je Mitglied eine Transaktion; ein bereits vorhandenes Duplikat wird übersprungen). */
async function createRunInvoices(
  admin: Actor,
  period: { id: string; year: number; label: string },
  entries: ReadonlyArray<{ memberId: string; amountRappen: number; months: number | null }>,
  byId: ReadonlyMap<string, RunMember>,
  settings: VereinSettings,
  opts: { categoryId: string | null; issueDate?: Date },
): Promise<number> {
  const issueDate = opts.issueDate ?? todayZurich();
  const dueDate = addDays(issueDate, settings.paymentDays ?? 0);
  const subject = periodLabel(period.year, period.label);
  let created = 0;
  for (const entry of entries) {
    const member = byId.get(entry.memberId)!;
    await db.$transaction(async (tx) => {
      // Doppelt abgesichert: zwischen Vorschau und Lauf könnte eine Rechnung entstanden sein.
      const dup = await tx.invoice.findFirst({ where: { memberId: member.id, periodId: period.id, status: { not: "STORNIERT" } }, select: { id: true } });
      if (dup) return;
      await createInvoiceRecord(tx, {
        member,
        subject,
        issueDate,
        dueDate,
        periodId: period.id,
        notes: "",
        items: [{ description: feeItemDescription(period.label, period.year, entry.months), quantity: 1, unitRappen: entry.amountRappen, categoryId: opts.categoryId }],
        settings,
        actor: admin,
      });
      created += 1;
    });
  }
  return created;
}

// ---- Mahnwesen --------------------------------------------------------------------------------------------------------------

export type ReminderRow = {
  id: string;
  number: string;
  memberId: string;
  recipientName: string;
  dueDate: Date;
  totalRappen: number;
  paidRappen: number;
  reminderLevel: number;
  daysOverdue: number;
  state: ReminderState;
  hasEmail: boolean;
  lastReminder: { level: number; dueDate: Date; sentAt: Date | null; mailSent: boolean; mailError: string } | null;
};

export async function listReminderRows(): Promise<ReminderRow[]> {
  const settings = await getVereinSettings();
  const today = todayZurich();
  const invoices = await db.invoice.findMany({
    where: { status: "OFFEN", OR: [{ dueDate: { lt: today } }, { reminderLevel: { gt: 0 } }] },
    orderBy: { dueDate: "asc" },
    take: 500,
    include: { reminders: { orderBy: { level: "asc" } }, member: { select: { email: true } } },
  });
  return invoices
    .filter((i) => openAmount(i.totalRappen, i.paidRappen) > 0)
    .map((i) => {
      const last = i.reminders.filter((r) => r.level === i.reminderLevel).at(-1) ?? null;
      return {
        id: i.id,
        number: i.number,
        memberId: i.memberId,
        recipientName: i.recipientName,
        dueDate: i.dueDate,
        totalRappen: i.totalRappen,
        paidRappen: i.paidRappen,
        reminderLevel: i.reminderLevel,
        daysOverdue: daysOverdue(i.dueDate, today),
        state: reminderStateOf({ status: i.status, dueDate: i.dueDate, totalRappen: i.totalRappen, paidRappen: i.paidRappen, reminderLevel: i.reminderLevel, lastReminderDueDate: last?.dueDate ?? null }, settings, today),
        hasEmail: emailSchema.safeParse(i.member.email).success,
        lastReminder: last ? { level: last.level, dueDate: last.dueDate, sentAt: last.sentAt, mailSent: last.mailSent, mailError: last.mailError } : null,
      };
    });
}

export type ReminderResult = { id: string; number: string; ok: boolean; level?: number; message: string };

async function deliverReminderMail(invoiceId: string, reminderId: string, level: number): Promise<{ mailSent: boolean; message: string }> {
  const inv = await db.invoice.findUnique({ where: { id: invoiceId }, include: { member: { select: { email: true, firstName: true, communicationPref: true, anonymizedAt: true } } } });
  const reminder = await db.reminder.findUnique({ where: { id: reminderId } });
  if (!inv || !reminder) return { mailSent: false, message: "Rechnung oder Mahnung nicht gefunden." };
  const email = emailSchema.safeParse(inv.member.email);
  if (!email.success || inv.member.anonymizedAt || inv.member.communicationPref === "POST") {
    const message = "Nicht per E-Mail: bitte die Mahnung ausdrucken und per Post zustellen.";
    await db.reminder.update({ where: { id: reminderId }, data: { sentAt: new Date(), mailSent: false, mailError: message } });
    return { mailSent: false, message };
  }
  const token = newViewToken();
  await db.invoice.update({ where: { id: invoiceId }, data: { viewTokenHash: sha256(token), viewTokenExpiresAt: invoiceLinkExpiry(new Date(), inv.dueDate) } });
  const sent = await sendReminderMail({ to: email.data, firstName: inv.member.firstName }, inv, { level, dueDate: reminder.dueDate, feeRappen: reminder.feeRappen }, token);
  if (sent.ok) {
    await db.reminder.update({ where: { id: reminderId }, data: { sentAt: new Date(), mailSent: true, mailError: "" } });
    return { mailSent: true, message: "Per E-Mail versendet." };
  }
  await db.reminder.update({ where: { id: reminderId }, data: { mailSent: false, mailError: sent.error.slice(0, 300) } });
  return { mailSent: false, message: `E-Mail nicht versendet: ${sent.error}` };
}

/** Erstellt die nächste Mahnstufe der gewählten Rechnungen und versendet sie. Jede Rechnung einzeln, damit ein Fehler die anderen nicht aufhält. */
export async function sendReminders(admin: Actor, ids: readonly string[], interestRappen?: number): Promise<ReminderResult[]> {
  const settings = await getVereinSettings();
  const missing = missingForReminders(settings);
  if (missing.length > 0) {
    throw new ApiError(409, "SETTINGS_MISSING", `Für Mahnungen fehlen Angaben in den Vereinseinstellungen (Finanzen): ${missing.map((m) => m.message).join(" ")}`);
  }
  if (interestRappen && ids.length !== 1) throw new ApiError(422, "VALIDATION_ERROR", "Ein Verzugszins kann nur bei einer einzelnen Rechnung angegeben werden.");
  const today = todayZurich();
  const results: ReminderResult[] = [];
  for (const id of ids) {
    const inv = await db.invoice.findUnique({ where: { id }, include: { reminders: true } });
    if (!inv) {
      results.push({ id, number: "?", ok: false, message: "Rechnung nicht gefunden." });
      continue;
    }
    const last = inv.reminders.find((r) => r.level === inv.reminderLevel) ?? null;
    const state = reminderStateOf({ status: inv.status, dueDate: inv.dueDate, totalRappen: inv.totalRappen, paidRappen: inv.paidRappen, reminderLevel: inv.reminderLevel, lastReminderDueDate: last?.dueDate ?? null }, settings, today);
    if (state.state !== "READY") {
      results.push({ id, number: inv.number, ok: false, message: "reason" in state ? state.reason : "Keine Mahnung möglich." });
      continue;
    }
    const level = state.nextLevel;
    const newDue = dueDateForLevel(settings, level, today);
    if (!newDue) {
      results.push({ id, number: inv.number, ok: false, message: `Die Frist der ${level}. Mahnung ist nicht festgelegt.` });
      continue;
    }
    const fee = reminderFeeFor(settings, level);
    const interest = interestRappen ?? 0;
    try {
      const reminder = await db.$transaction(async (tx) => {
        const extra: Array<{ description: string; amount: number }> = [];
        if (fee > 0) extra.push({ description: `Mahngebühr ${level}. Mahnung`, amount: fee });
        if (interest > 0) extra.push({ description: "Verzugszins (vom Vorstand festgelegt)", amount: interest });
        const addTotal = extra.reduce((a, e) => a + e.amount, 0);
        const claimed = await tx.invoice.updateMany({
          where: { id, status: "OFFEN", reminderLevel: inv.reminderLevel },
          data: { reminderLevel: level, lastReminderAt: new Date(), ...(addTotal > 0 ? { totalRappen: { increment: addTotal } } : {}) },
        });
        if (claimed.count !== 1) throw new ApiError(409, "CONFLICT", "Die Rechnung wurde inzwischen geändert.");
        const base = await tx.invoiceItem.count({ where: { invoiceId: id } });
        for (const [i, e] of extra.entries()) {
          await tx.invoiceItem.create({ data: { invoiceId: id, position: base + i, description: e.description, quantity: 1, unitRappen: e.amount, totalRappen: e.amount } });
        }
        const r = await tx.reminder.create({ data: { invoiceId: id, level, dueDate: newDue, feeRappen: fee }, select: { id: true } });
        await logAudit(tx, {
          actor: auditActor(admin),
          action: "reminder.send",
          objectType: "Invoice",
          objectId: id,
          summary: `${level}. Mahnung zu Rechnung ${inv.number} erstellt (neue Frist ${formatDateCh(newDue)})`,
          after: { level, dueDate: newDue, feeRappen: fee, interestRappen: interest },
        });
        return r;
      });
      const delivery = await deliverReminderMail(id, reminder.id, level);
      results.push({ id, number: inv.number, ok: true, level, message: delivery.message });
    } catch (e) {
      results.push({ id, number: inv.number, ok: false, message: e instanceof ApiError ? e.message : "Die Mahnung konnte nicht erstellt werden." });
    }
  }
  return results;
}

/** Versendet die zuletzt erstellte Mahnung erneut (z. B. nach einem Mailfehler), ohne eine neue Stufe zu bilden. */
export async function resendLastReminder(admin: Actor, invoiceId: string): Promise<ReminderResult> {
  const inv = await db.invoice.findUnique({ where: { id: invoiceId }, select: { id: true, number: true, status: true, reminderLevel: true } });
  if (!inv) throw new ApiError(404, "NOT_FOUND", "Rechnung nicht gefunden.");
  if (inv.status !== "OFFEN" || inv.reminderLevel < 1) conflict("Zu dieser Rechnung gibt es keine offene Mahnung.");
  const reminder = await db.reminder.findUnique({ where: { invoiceId_level: { invoiceId, level: inv.reminderLevel } }, select: { id: true } });
  if (!reminder) conflict("Mahnung nicht gefunden.");
  const delivery = await deliverReminderMail(invoiceId, reminder!.id, inv.reminderLevel);
  await db.$transaction((tx) => logAudit(tx, { actor: auditActor(admin), action: "reminder.resend", objectType: "Invoice", objectId: invoiceId, summary: `${inv.reminderLevel}. Mahnung zu Rechnung ${inv.number} erneut zugestellt` }));
  return { id: invoiceId, number: inv.number, ok: delivery.mailSent, level: inv.reminderLevel, message: delivery.message };
}

// ---- Offene Posten -------------------------------------------------------------------------------------------------------------

export async function getOpenItems() {
  const today = todayZurich();
  const rows = await db.invoice.findMany({
    where: { status: "OFFEN" },
    orderBy: [{ dueDate: "asc" }, { number: "asc" }],
    select: { id: true, number: true, recipientName: true, subject: true, issueDate: true, dueDate: true, totalRappen: true, paidRappen: true, status: true, reminderLevel: true, member: { select: { memberNumber: true } } },
  });
  const open = rows.filter((r) => openAmount(r.totalRappen, r.paidRappen) > 0);
  return { rows: open, summary: agingSummary(open, today), today };
}

export async function getFeeKpis() {
  const today = todayZurich();
  const [open, overdue, drafts, unbooked] = await Promise.all([
    db.invoice.aggregate({ where: { status: "OFFEN" }, _sum: { totalRappen: true, paidRappen: true }, _count: true }),
    db.invoice.aggregate({ where: { status: "OFFEN", dueDate: { lt: today } }, _sum: { totalRappen: true, paidRappen: true }, _count: true }),
    db.invoice.count({ where: { status: "ENTWURF" } }),
    db.payment.count({ where: { transaction: null } }),
  ]);
  return {
    openCount: open._count,
    openRappen: (open._sum.totalRappen ?? 0) - (open._sum.paidRappen ?? 0),
    overdueCount: overdue._count,
    overdueRappen: (overdue._sum.totalRappen ?? 0) - (overdue._sum.paidRappen ?? 0),
    draftCount: drafts,
    unbookedPayments: unbooked,
  };
}

// ---- Zahlungen: Liste ---------------------------------------------------------------------------------------------------------------

export const paymentListArgs = {
  include: {
    invoice: { select: { id: true, number: true } },
    member: { select: { memberNumber: true, firstName: true, lastName: true } },
    transaction: { select: { id: true, voucherNo: true } },
  },
} satisfies Prisma.PaymentDefaultArgs;
export type PaymentListRow = Prisma.PaymentGetPayload<typeof paymentListArgs>;

export async function listPayments(q: string, skip: number, take: number): Promise<{ items: PaymentListRow[]; total: number }> {
  const where: Prisma.PaymentWhereInput = q
    ? { OR: [{ reference: { contains: q } }, { invoice: { number: { contains: q } } }, { member: { lastName: { contains: q } } }, { member: { firstName: { contains: q } } }] }
    : {};
  const [total, items] = await Promise.all([
    db.payment.count({ where }),
    db.payment.findMany({ where, orderBy: [{ receivedAt: "desc" }, { createdAt: "desc" }], skip, take, ...paymentListArgs }),
  ]);
  return { items, total };
}

// ---- Zahlungsabgleich per CSV ---------------------------------------------------------------------------------------------------------

export type ImportLine = { row: ImportRow; result: MatchResult };

async function matchImport(rows: readonly ImportRow[]): Promise<ImportLine[]> {
  const refs = [...new Set(rows.map((r) => r.reference.toUpperCase()).filter(Boolean))];
  const keys = new Set<string>();
  for (const r of rows) {
    const parsed = r.reference ? parseInvoiceReference(r.reference) : null;
    if (parsed) keys.add(`${parsed.year}-${parsed.seq}`);
    const m = /\b(\d{4})-(\d{4,})\b/.exec(r.text);
    if (m) keys.add(`${Number(m[1])}-${Number(m[2])}`);
  }
  const or: Prisma.InvoiceWhereInput[] = [];
  if (refs.length) or.push({ paymentReference: { in: refs } });
  for (const k of keys) {
    const [year, seq] = k.split("-").map(Number);
    or.push({ year, seq });
  }
  const invoices = or.length
    ? await db.invoice.findMany({ where: { OR: or }, select: { id: true, number: true, year: true, seq: true, status: true, totalRappen: true, paidRappen: true, paymentReference: true, recipientName: true } })
    : [];
  const list: MatchInvoice[] = invoices.map((i) => ({ ...i, memberName: i.recipientName }));
  const byReference = new Map(list.filter((i) => i.paymentReference).map((i) => [i.paymentReference.replace(/\s/g, "").toUpperCase(), i]));
  const byKey = new Map(list.map((i) => [`${i.year}-${i.seq}`, i]));
  const payments = list.length ? await db.payment.findMany({ where: { invoiceId: { in: list.map((i) => i.id) } }, select: { invoiceId: true, amountRappen: true, receivedAt: true } }) : [];
  const dupKey = (invoiceId: string, amount: number, date: Date) => `${invoiceId}|${amount}|${startOfDayZurich(date).getTime()}`;
  const existing = new Set(payments.map((p) => dupKey(p.invoiceId ?? "", p.amountRappen, p.receivedAt)));
  const seenInFile = new Set<string>();
  return rows.map((row) => {
    const result = matchRow(row, byReference, byKey, (invoiceId, r) => {
      const key = dupKey(invoiceId, r.amountRappen ?? 0, r.date ?? todayZurich());
      if (existing.has(key)) return true;
      if (seenInFile.has(key) && r.date) return true;
      return false;
    });
    if (result.kind === "MATCH" && row.date) seenInFile.add(dupKey(result.invoice.id, result.amountRappen, row.date));
    return { row, result };
  });
}

export async function previewPaymentImport(csv: string): Promise<{ error: string | null; lines: ImportLine[] }> {
  const parsed = parseBankCsv(csv);
  if (parsed.error) return { error: parsed.error, lines: [] };
  return { error: null, lines: await matchImport(parsed.rows) };
}

export async function commitPaymentImport(
  admin: Actor,
  csv: string,
  lines: readonly number[],
  opts: { assetAccountId: string | null; incomeAccountId: string | null; method: PaymentMethod },
): Promise<Array<{ line: number; ok: boolean; message: string; result?: PaymentResult }>> {
  const { error, lines: matched } = await previewPaymentImport(csv);
  if (error) throw new ApiError(422, "VALIDATION_ERROR", error);
  const wanted = new Set(lines);
  const out: Array<{ line: number; ok: boolean; message: string; result?: PaymentResult }> = [];
  for (const { row, result } of matched) {
    if (!wanted.has(row.line)) continue;
    if (result.kind !== "MATCH") {
      out.push({ line: row.line, ok: false, message: result.message });
      continue;
    }
    try {
      const r = await recordPayment(
        admin,
        {
          invoiceId: result.invoice.id,
          receivedAt: row.date ?? todayZurich(),
          amount: result.amountRappen,
          method: opts.method,
          reference: row.reference,
          note: "Aus Zahlungsliste importiert",
          assetAccountId: opts.assetAccountId,
          incomeAccountId: opts.incomeAccountId,
        },
        { rejectDuplicate: true }, // gleichzeitige Importe derselben Datei erzeugen keine doppelten Zahlungen
      );
      out.push({ line: row.line, ok: true, message: `Gebucht auf ${result.invoice.number}${r.booking.status === "PENDING" ? " (noch nicht in der Kasse gebucht)" : ""}.`, result: r });
    } catch (e) {
      out.push({ line: row.line, ok: false, message: e instanceof ApiError ? e.message : "Fehler beim Erfassen." });
    }
  }
  return out;
}

// ---- Export ---------------------------------------------------------------------------------------------------------------------------------

export async function exportInvoiceRows(filter: { status?: string; periodId?: string }) {
  const today = todayZurich();
  const where: Prisma.InvoiceWhereInput = {};
  if (filter.status === "UEBERFAELLIG") {
    where.status = "OFFEN";
    where.dueDate = { lt: today };
  } else if (filter.status) where.status = filter.status;
  if (filter.periodId) where.periodId = filter.periodId;
  const rows = await db.invoice.findMany({
    where,
    orderBy: [{ issueDate: "asc" }, { number: "asc" }],
    take: 10000,
    select: { number: true, recipientName: true, subject: true, issueDate: true, dueDate: true, totalRappen: true, paidRappen: true, status: true, reminderLevel: true, paidAt: true, member: { select: { memberNumber: true } } },
  });
  return rows.map((r) => ({ ...r, stateLabel: paymentStateLabel(r), overdueDays: r.status === "OFFEN" ? daysOverdue(r.dueDate, today) : 0 }));
}
