// Datenzugriff und Befehle der Rechnungen und Zahlungen (Besitzer: Beiträge). Nur serverseitig.
// Grundsätze: Nummern atomar in derselben Transaktion wie die Rechnung (ids.ts), Statusänderungen bedingt (updateMany mit Status),
// jede Änderung mit Protokolleintrag in derselben Transaktion, Zahlungen mit Buchung in der Kassa (ledger-link.ts).
import "server-only";
import { createHash, randomBytes } from "node:crypto";
import type { Prisma } from "@prisma/client";
import { ApiError } from "@/lib/api";
import { getLegalSettings } from "@/lib/settings";
import { db } from "@/lib/db";
import { auditActor, diffObjects, logAudit } from "./audit";
import { INVOICE_STATUSES, type InvoiceStatus } from "./constants";
import { addDays, todayZurich, yearOf } from "./dates";
import { composeInvoiceBill, type BillContext, type InvoiceBill } from "./fees-bill";
import {
  addressBlockOf,
  itemsTotal,
  MAX_INVOICE_RAPPEN,
  paymentBlockedReason,
  recipientNameOf,
  referenceForNewInvoice,
  settleStatus,
} from "./fees-calc";
import { sendInvoiceMail } from "./fees-mail";
import type { InvoiceItemInput, PaymentCreateInput } from "./fees-schemas";
import { nextInvoiceNumber } from "./ids";
import { bookPayment, removePaymentBooking, type BookingOutcome } from "./ledger-link";
import { formatChf, formatChfWithCurrency } from "./money";
import { searchWhere } from "./pagination";
import { fiscalStartOf, getVereinSettings, missingForInvoicing, type VereinSettings } from "./settings";
import { emailSchema } from "./validation";

export type Actor = { id: string; name: string };

export const sha256 = (value: string): string => createHash("sha256").update(value).digest("hex");
export const newViewToken = (): string => randomBytes(24).toString("base64url");

const conflict = (message: string): never => {
  throw new ApiError(409, "CONFLICT", message);
};

export function assertInvoicingReady(settings: VereinSettings): void {
  const missing = missingForInvoicing(settings);
  if (missing.length > 0) {
    throw new ApiError(409, "SETTINGS_MISSING", `Für Rechnungen fehlen Angaben in den Vereinseinstellungen (Finanzen): ${missing.map((m) => m.message).join(" ")}`);
  }
}

function assertAmountInRange(rappen: number, label: string): void {
  if (rappen > MAX_INVOICE_RAPPEN) throw new ApiError(422, "VALIDATION_ERROR", `${label} ist zu gross (höchstens ${formatChfWithCurrency(MAX_INVOICE_RAPPEN)}).`);
}

// ---- Lesen ------------------------------------------------------------------------------------------------------------

export const invoiceListSelect = {
  id: true,
  number: true,
  status: true,
  recipientName: true,
  subject: true,
  issueDate: true,
  dueDate: true,
  totalRappen: true,
  paidRappen: true,
  reminderLevel: true,
  memberId: true,
  member: { select: { memberNumber: true } },
  period: { select: { year: true } },
} satisfies Prisma.InvoiceSelect;
export type InvoiceListRow = Prisma.InvoiceGetPayload<{ select: typeof invoiceListSelect }>;

export const INVOICE_FILTER_OVERDUE = "UEBERFAELLIG";

export type InvoiceFilter = { q?: string; status?: string; periodId?: string; memberId?: string };

function invoiceWhere(f: InvoiceFilter, today: Date): Prisma.InvoiceWhereInput {
  const where: Prisma.InvoiceWhereInput = { ...(f.q ? searchWhere(f.q, ["number", "recipientName", "subject"]) : {}) };
  if (f.status === INVOICE_FILTER_OVERDUE) {
    where.status = "OFFEN";
    where.dueDate = { lt: today };
  } else if (f.status && (INVOICE_STATUSES as readonly string[]).includes(f.status)) {
    where.status = f.status;
  }
  if (f.periodId) where.periodId = f.periodId;
  if (f.memberId) where.memberId = f.memberId;
  return where;
}

export async function listInvoices(f: InvoiceFilter, skip: number, take: number): Promise<{ items: InvoiceListRow[]; total: number }> {
  const where = invoiceWhere(f, todayZurich());
  const [total, items] = await Promise.all([
    db.invoice.count({ where }),
    db.invoice.findMany({ where, orderBy: [{ issueDate: "desc" }, { number: "desc" }], skip, take, select: invoiceListSelect }),
  ]);
  return { items, total };
}

const memberBrief = {
  id: true,
  memberNumber: true,
  firstName: true,
  lastName: true,
  email: true,
  status: true,
  communicationPref: true,
  anonymizedAt: true,
} satisfies Prisma.MemberSelect;

export const invoiceDetailArgs = {
  include: {
    items: { orderBy: { position: "asc" } },
    payments: {
      orderBy: [{ receivedAt: "desc" }, { createdAt: "desc" }],
      include: { transaction: { select: { id: true, voucherNo: true } } },
    },
    reminders: { orderBy: { level: "asc" } },
    member: { select: memberBrief },
    period: { select: { id: true, year: true, label: true } },
  },
} satisfies Prisma.InvoiceDefaultArgs;
export type InvoiceDetail = Prisma.InvoiceGetPayload<typeof invoiceDetailArgs>;

export function getInvoiceDetail(id: string): Promise<InvoiceDetail | null> {
  return db.invoice.findUnique({ where: { id }, ...invoiceDetailArgs });
}

/** Rechnung für das Portal: nur eigene, nur versandte (kein Entwurf). Keine ID ohne memberId-Filter. */
export function getInvoiceForMember(memberId: string, id: string): Promise<InvoiceDetail | null> {
  return db.invoice.findFirst({ where: { id, memberId, status: { in: ["OFFEN", "BEZAHLT", "STORNIERT"] } }, ...invoiceDetailArgs });
}

export function listInvoicesForMember(memberId: string): Promise<InvoiceListRow[]> {
  return db.invoice.findMany({
    where: { memberId, status: { in: ["OFFEN", "BEZAHLT", "STORNIERT"] } },
    orderBy: [{ issueDate: "desc" }, { number: "desc" }],
    take: 200,
    select: invoiceListSelect,
  });
}

/** Rechnung über den Link aus der Mail (ohne Konto). Entwürfe sind nie erreichbar. */
export async function getInvoiceByViewToken(token: string): Promise<InvoiceDetail | null> {
  if (!/^[A-Za-z0-9_-]{20,80}$/.test(token)) return null;
  return db.invoice.findFirst({ where: { viewTokenHash: sha256(token), status: { in: ["OFFEN", "BEZAHLT", "STORNIERT"] } }, ...invoiceDetailArgs });
}

// ---- QR-Rechnung ------------------------------------------------------------------------------------------------------

/** Konto und Vereinsanschrift für die QR-Rechnung (Vereinseinstellungen und Einstellungen → Rechtliches). */
export async function loadBillContext(settings?: VereinSettings): Promise<BillContext> {
  const s = settings ?? (await getVereinSettings());
  const legal = await getLegalSettings().catch(() => null);
  return {
    accountHolder: s.accountHolder,
    iban: s.iban,
    qrIban: s.qrIban,
    legal: { street: legal?.street ?? "", zipCity: legal?.zipCity ?? "", country: legal?.country ?? "" },
  };
}

export async function billForInvoice(inv: Pick<InvoiceDetail, "number" | "year" | "seq" | "totalRappen" | "paidRappen" | "paymentReference" | "recipientName" | "recipientAddress">): Promise<InvoiceBill> {
  return composeInvoiceBill(await loadBillContext(), inv);
}

// ---- Anlegen und Ändern -----------------------------------------------------------------------------------------------

export type NewItem = { description: string; quantity: number; unitRappen: number; categoryId: string | null };

export function toNewItems(items: readonly InvoiceItemInput[]): NewItem[] {
  return items.map((i) => ({ description: i.description, quantity: i.quantity, unitRappen: i.unit, categoryId: i.categoryId ?? null }));
}

async function assertIncomeCategories(client: Prisma.TransactionClient | typeof db, ids: Array<string | null>): Promise<void> {
  const wanted = [...new Set(ids.filter((c): c is string => Boolean(c)))];
  if (wanted.length === 0) return;
  const found = await client.accountCategory.findMany({ where: { id: { in: wanted }, kind: "EINNAHMEN", active: true }, select: { id: true } });
  if (found.length !== wanted.length) throw new ApiError(422, "VALIDATION_ERROR", "Ein gewähltes Ertragskonto ist nicht (mehr) verfügbar.", { items: "Bitte ein aktives Einnahmenkonto wählen." });
}

function checkItems(items: readonly NewItem[]): number {
  for (const it of items) assertAmountInRange(it.quantity * it.unitRappen, "Eine Position");
  const total = itemsTotal(items);
  assertAmountInRange(total, "Der Rechnungsbetrag");
  if (total <= 0) throw new ApiError(422, "VALIDATION_ERROR", "Der Rechnungsbetrag muss grösser als 0 sein.", { items: "Der Gesamtbetrag muss grösser als 0 sein." });
  return total;
}

type MemberForInvoice = { id: string; memberNumber: number; firstName: string; lastName: string; street: string; houseNumber: string; zip: string; city: string; country: string };

/** Legt eine Rechnung im Status Entwurf an. Muss in einer Transaktion laufen (Nummer + Rechnung zusammen). */
export async function createInvoiceRecord(
  tx: Prisma.TransactionClient,
  a: {
    member: MemberForInvoice;
    subject: string;
    issueDate: Date;
    dueDate: Date;
    periodId: string | null;
    notes: string;
    items: readonly NewItem[];
    settings: VereinSettings;
    actor: Actor;
  },
): Promise<{ id: string; number: string; totalRappen: number }> {
  const total = itemsTotal(a.items);
  const year = yearOf(a.issueDate);
  const { number, seq } = await nextInvoiceNumber(tx, year);
  const inv = await tx.invoice.create({
    data: {
      number,
      year,
      seq,
      memberId: a.member.id,
      periodId: a.periodId,
      recipientName: recipientNameOf(a.member),
      recipientAddress: addressBlockOf(a.member),
      subject: a.subject,
      status: "ENTWURF",
      issueDate: a.issueDate,
      dueDate: a.dueDate,
      totalRappen: total,
      paymentReference: referenceForNewInvoice(a.settings, year, seq),
      notes: a.notes,
      items: {
        create: a.items.map((it, position) => ({
          position,
          description: it.description,
          quantity: it.quantity,
          unitRappen: it.unitRappen,
          totalRappen: it.quantity * it.unitRappen,
          categoryId: it.categoryId,
        })),
      },
    },
    select: { id: true },
  });
  await logAudit(tx, {
    actor: auditActor(a.actor),
    action: "invoice.create",
    objectType: "Invoice",
    objectId: inv.id,
    summary: `Rechnung ${number} für Mitglied ${a.member.memberNumber} erstellt (CHF ${formatChf(total)})`,
    after: { number, memberNumber: a.member.memberNumber, totalRappen: total, subject: a.subject, dueDate: a.dueDate },
  });
  return { id: inv.id, number, totalRappen: total };
}

const memberForInvoiceSelect = { id: true, memberNumber: true, firstName: true, lastName: true, street: true, houseNumber: true, zip: true, city: true, country: true, anonymizedAt: true, status: true } satisfies Prisma.MemberSelect;

export async function createInvoice(
  admin: Actor,
  input: { memberId: string; subject: string; issueDate?: Date; dueDate?: Date; periodId?: string | null; notes: string; items: readonly InvoiceItemInput[] },
): Promise<{ id: string; number: string }> {
  const settings = await getVereinSettings();
  assertInvoicingReady(settings);
  const items = toNewItems(input.items);
  checkItems(items);
  await assertIncomeCategories(db, items.map((i) => i.categoryId));
  const member = await db.member.findUnique({ where: { id: input.memberId }, select: memberForInvoiceSelect });
  if (!member) throw new ApiError(404, "NOT_FOUND", "Mitglied nicht gefunden.");
  if (member.anonymizedAt) conflict("Die Personendaten dieses Mitglieds wurden entfernt. Es kann keine Rechnung mehr erstellt werden.");
  if (input.periodId) {
    const period = await db.feePeriod.findUnique({ where: { id: input.periodId }, select: { id: true } });
    if (!period) throw new ApiError(404, "NOT_FOUND", "Beitragsjahr nicht gefunden.");
  }
  const issueDate = input.issueDate ?? todayZurich();
  const dueDate = input.dueDate ?? addDays(issueDate, settings.paymentDays ?? 0);
  if (dueDate.getTime() < issueDate.getTime()) throw new ApiError(422, "VALIDATION_ERROR", "Die Fälligkeit darf nicht vor dem Rechnungsdatum liegen.", { dueDate: "Vor dem Rechnungsdatum." });
  return db.$transaction((tx) =>
    createInvoiceRecord(tx, { member, subject: input.subject, issueDate, dueDate, periodId: input.periodId ?? null, notes: input.notes, items, settings, actor: admin }),
  );
}

export async function updateInvoice(
  admin: Actor,
  id: string,
  patch: { subject?: string; issueDate?: Date; dueDate?: Date; notes?: string; items?: readonly InvoiceItemInput[] },
): Promise<void> {
  const before = await db.invoice.findUnique({ where: { id }, include: { items: { orderBy: { position: "asc" } } } });
  if (!before) throw new ApiError(404, "NOT_FOUND", "Rechnung nicht gefunden.");
  const editable = before.status === "ENTWURF";
  if (!editable && before.status !== "OFFEN") conflict("Bezahlte oder stornierte Rechnungen können nicht mehr geändert werden.");
  if (!editable && (patch.items !== undefined || patch.issueDate !== undefined || patch.subject !== undefined)) {
    conflict("Eine versandte Rechnung kann nur noch in Fälligkeit und interner Notiz geändert werden. Storniere sie und stelle bei Bedarf eine neue aus.");
  }
  const issueDate = patch.issueDate ?? before.issueDate;
  const dueDate = patch.dueDate ?? before.dueDate;
  if (yearOf(issueDate) !== before.year) {
    throw new ApiError(422, "VALIDATION_ERROR", `Das Rechnungsdatum muss im Jahr ${before.year} bleiben (Rechnungsnummer ${before.number}).`, { issueDate: `Im Jahr ${before.year} bleiben.` });
  }
  if (dueDate.getTime() < issueDate.getTime()) throw new ApiError(422, "VALIDATION_ERROR", "Die Fälligkeit darf nicht vor dem Rechnungsdatum liegen.", { dueDate: "Vor dem Rechnungsdatum." });

  const items = patch.items ? toNewItems(patch.items) : null;
  const total = items ? checkItems(items) : before.totalRappen;
  if (items) await assertIncomeCategories(db, items.map((i) => i.categoryId));

  await db.$transaction(async (tx) => {
    const data: Prisma.InvoiceUpdateInput = {};
    if (patch.subject !== undefined) data.subject = patch.subject;
    if (patch.issueDate !== undefined) data.issueDate = issueDate;
    if (patch.dueDate !== undefined) data.dueDate = dueDate;
    if (patch.notes !== undefined) data.notes = patch.notes;
    if (items) {
      data.totalRappen = total;
      await tx.invoiceItem.deleteMany({ where: { invoiceId: id } });
      await tx.invoiceItem.createMany({
        data: items.map((it, position) => ({ invoiceId: id, position, description: it.description, quantity: it.quantity, unitRappen: it.unitRappen, totalRappen: it.quantity * it.unitRappen, categoryId: it.categoryId })),
      });
    }
    // bedingt: nur Entwurf bzw. offene Rechnung darf sich ändern (verhindert Änderungen nach gleichzeitigem Versand/Storno)
    const res = await tx.invoice.updateMany({ where: { id, status: before.status }, data: data as Prisma.InvoiceUpdateManyMutationInput });
    if (res.count !== 1) conflict("Die Rechnung wurde inzwischen geändert. Bitte lade die Seite neu.");
    const diff = diffObjects(
      { subject: before.subject, issueDate: before.issueDate, dueDate: before.dueDate, notes: before.notes, totalRappen: before.totalRappen, items: before.items.map((i) => `${i.quantity}× ${i.description} ${i.unitRappen}`) },
      { subject: patch.subject ?? before.subject, issueDate, dueDate, notes: patch.notes ?? before.notes, totalRappen: total, items: items ? items.map((i) => `${i.quantity}× ${i.description} ${i.unitRappen}`) : before.items.map((i) => `${i.quantity}× ${i.description} ${i.unitRappen}`) },
    );
    await logAudit(tx, { actor: auditActor(admin), action: "invoice.update", objectType: "Invoice", objectId: id, summary: `Rechnung ${before.number} geändert`, ...diff });
  });
}

export async function cancelInvoice(admin: Actor, id: string, reason: string): Promise<void> {
  const inv = await db.invoice.findUnique({ where: { id }, select: { id: true, number: true, status: true, paidRappen: true } });
  if (!inv) throw new ApiError(404, "NOT_FOUND", "Rechnung nicht gefunden.");
  if (inv.status === "STORNIERT") conflict("Die Rechnung ist bereits storniert.");
  if (inv.paidRappen > 0) conflict("Zur Rechnung sind Zahlungen erfasst. Lösche zuerst die Zahlungen (bei Rückzahlung ausserhalb dieser Software), bevor du sie stornierst.");
  await db.$transaction(async (tx) => {
    const res = await tx.invoice.updateMany({
      where: { id, status: { in: ["ENTWURF", "OFFEN"] }, paidRappen: 0 },
      data: { status: "STORNIERT", cancelledAt: new Date(), cancelReason: reason, viewTokenHash: null },
    });
    if (res.count !== 1) conflict("Die Rechnung wurde inzwischen geändert. Bitte lade die Seite neu.");
    await logAudit(tx, {
      actor: auditActor(admin),
      action: "invoice.cancel",
      objectType: "Invoice",
      objectId: id,
      summary: `Rechnung ${inv.number} storniert`,
      before: { status: inv.status },
      after: { status: "STORNIERT", reason },
    });
  });
}

// ---- Versand ------------------------------------------------------------------------------------------------------------

export type SendChannel = "MAIL" | "POST";

/**
 * Versendet einen Entwurf (wird «Offen») oder sendet eine offene Rechnung erneut (MAIL).
 * Vor dem Versand werden Einstellungen, QR-Rechnung, Fälligkeit und Empfänger geprüft; so geht nie eine Mail mit ungültigem Zahlteil hinaus.
 */
export async function sendInvoice(admin: Actor, id: string, channel: SendChannel): Promise<{ number: string; resent: boolean }> {
  const settings = await getVereinSettings();
  assertInvoicingReady(settings);
  const inv = await db.invoice.findUnique({ where: { id }, include: { member: { select: { email: true, firstName: true, anonymizedAt: true } } } });
  if (!inv) throw new ApiError(404, "NOT_FOUND", "Rechnung nicht gefunden.");
  const resent = inv.status === "OFFEN";
  if (inv.status !== "ENTWURF" && !resent) conflict(inv.status === "BEZAHLT" ? "Die Rechnung ist bereits bezahlt." : "Die Rechnung ist storniert und kann nicht versendet werden.");
  if (resent && channel === "POST") conflict("Die Rechnung ist bereits versendet.");
  if (inv.totalRappen <= 0) conflict("Der Rechnungsbetrag muss grösser als 0 sein.");
  if (!resent && inv.dueDate.getTime() < todayZurich().getTime()) {
    throw new ApiError(409, "CONFLICT", "Die Fälligkeit liegt in der Vergangenheit. Passe Rechnungsdatum und Fälligkeit im Entwurf an.");
  }
  const bill = await billForInvoice(inv);
  if (!bill.ok) throw new ApiError(409, "BILL_INVALID", `Die QR-Rechnung kann noch nicht erstellt werden: ${bill.problems.join(" ")}`);

  if (channel === "MAIL") {
    const email = emailSchema.safeParse(inv.member.email);
    if (!email.success || inv.member.anonymizedAt) conflict("Beim Mitglied ist keine gültige E-Mail-Adresse hinterlegt. Wähle «Per Post zustellen» oder ergänze die Adresse.");
    const token = newViewToken();
    await db.invoice.update({ where: { id }, data: { viewTokenHash: sha256(token) } });
    const sent = await sendInvoiceMail({ to: email.data!, firstName: inv.member.firstName }, inv, token);
    if (!sent.ok) throw new ApiError(502, "MAIL_FAILED", `Die E-Mail konnte nicht versendet werden: ${sent.error}`);
  }

  await db.$transaction(async (tx) => {
    if (!resent) {
      const res = await tx.invoice.updateMany({ where: { id, status: "ENTWURF" }, data: { status: "OFFEN", sentAt: new Date() } });
      if (res.count !== 1) conflict("Die Rechnung wurde inzwischen geändert. Bitte lade die Seite neu.");
    } else {
      await tx.invoice.update({ where: { id }, data: { sentAt: new Date() } });
    }
    await logAudit(tx, {
      actor: auditActor(admin),
      action: resent ? "invoice.resend" : "invoice.send",
      objectType: "Invoice",
      objectId: id,
      summary: `Rechnung ${inv.number} ${resent ? "erneut " : ""}${channel === "MAIL" ? "per E-Mail versendet" : "als per Post zugestellt markiert"}`,
      after: { channel, status: "OFFEN" },
    });
  });
  return { number: inv.number, resent };
}

// ---- Zahlungen --------------------------------------------------------------------------------------------------------

export type PaymentResult = {
  paymentId: string;
  invoice: { id: string; number: string; status: InvoiceStatus; openRappen: number; overpaidRappen: number } | null;
  booking: BookingOutcome;
};

/** Erfasst einen Zahlungseingang. Rechnung, Zahlung, Statuswechsel, Buchung und Protokoll in einer Transaktion. */
export async function recordPayment(admin: Actor, input: PaymentCreateInput): Promise<PaymentResult> {
  const settings = await getVereinSettings();
  assertAmountInRange(input.amount, "Der Betrag");
  if (input.receivedAt.getTime() > addDays(todayZurich(), 1).getTime()) {
    throw new ApiError(422, "VALIDATION_ERROR", "Das Zahlungsdatum liegt in der Zukunft.", { receivedAt: "Das Datum liegt in der Zukunft." });
  }
  return db.$transaction(async (tx) => {
    let memberId: string | null = null;
    let invoice: { id: string; number: string; subject: string; status: InvoiceStatus; totalRappen: number; paidRappen: number; memberId: string; items: Array<{ categoryId: string | null }> } | null = null;
    if (input.invoiceId) {
      const found = await tx.invoice.findUnique({
        where: { id: input.invoiceId },
        select: { id: true, number: true, subject: true, status: true, totalRappen: true, paidRappen: true, memberId: true, items: { select: { categoryId: true } } },
      });
      if (!found) throw new ApiError(404, "NOT_FOUND", "Rechnung nicht gefunden.");
      const blocked = paymentBlockedReason(found.status);
      if (blocked) conflict(blocked);
      invoice = { ...found, status: found.status as InvoiceStatus };
      memberId = found.memberId;
    } else if (input.memberId) {
      const m = await tx.member.findUnique({ where: { id: input.memberId }, select: { id: true } });
      if (!m) throw new ApiError(404, "NOT_FOUND", "Mitglied nicht gefunden.");
      memberId = m.id;
    }
    const payment = await tx.payment.create({
      data: {
        invoiceId: invoice?.id ?? null,
        memberId,
        receivedAt: input.receivedAt,
        amountRappen: input.amount,
        method: input.method,
        reference: input.reference,
        note: input.note,
        createdById: admin.id,
        createdByName: admin.name,
      },
      select: { id: true },
    });

    let invoiceOut: PaymentResult["invoice"] = null;
    if (invoice) {
      const updated = await tx.invoice.update({ where: { id: invoice.id }, data: { paidRappen: { increment: input.amount } }, select: { status: true, totalRappen: true, paidRappen: true } });
      const status = settleStatus(updated.status as InvoiceStatus, updated);
      if (status !== updated.status) {
        await tx.invoice.update({ where: { id: invoice.id }, data: { status, paidAt: status === "BEZAHLT" ? input.receivedAt : null } });
      }
      invoiceOut = {
        id: invoice.id,
        number: invoice.number,
        status,
        openRappen: Math.max(0, updated.totalRappen - updated.paidRappen),
        overpaidRappen: Math.max(0, updated.paidRappen - updated.totalRappen),
      };
      if (status === "BEZAHLT" && invoice.status !== "BEZAHLT") {
        await logAudit(tx, { actor: auditActor(admin), action: "invoice.paid", objectType: "Invoice", objectId: invoice.id, summary: `Rechnung ${invoice.number} ist bezahlt`, before: { status: invoice.status }, after: { status: "BEZAHLT" } });
      }
    }

    const booking = await bookPayment(tx, {
      payment: { id: payment.id, receivedAt: input.receivedAt, amountRappen: input.amount, reference: input.reference },
      invoice: invoice ? { number: invoice.number, subject: invoice.subject, categoryIds: invoice.items.map((i) => i.categoryId) } : null,
      assetAccountId: input.assetAccountId ?? null,
      incomeAccountId: input.incomeAccountId ?? null,
      fiscalStart: fiscalStartOf(settings),
      actor: admin,
    });

    await logAudit(tx, {
      actor: auditActor(admin),
      action: "payment.create",
      objectType: "Payment",
      objectId: payment.id,
      summary: `Zahlung CHF ${formatChf(input.amount)} ${invoice ? `zu Rechnung ${invoice.number}` : "ohne Rechnung"} erfasst`,
      after: { invoice: invoice?.number ?? null, amountRappen: input.amount, receivedAt: input.receivedAt, method: input.method, booked: booking.status === "BOOKED" ? booking.voucherNo : "nicht gebucht" },
    });
    return { paymentId: payment.id, invoice: invoiceOut, booking };
  });
}

/** Löscht eine Zahlung samt Buchung (solange das Geschäftsjahr offen ist) und führt die Rechnung nach. */
export async function deletePayment(admin: Actor, id: string): Promise<void> {
  await db.$transaction(async (tx) => {
    const payment = await tx.payment.findUnique({ where: { id }, select: { id: true, invoiceId: true, amountRappen: true, receivedAt: true, reference: true, invoice: { select: { number: true } } } });
    if (!payment) throw new ApiError(404, "NOT_FOUND", "Zahlung nicht gefunden.");
    await removePaymentBooking(tx, id);
    await tx.payment.delete({ where: { id } });
    if (payment.invoiceId) {
      const inv = await tx.invoice.update({ where: { id: payment.invoiceId }, data: { paidRappen: { decrement: payment.amountRappen } }, select: { status: true, totalRappen: true, paidRappen: true } });
      const status = settleStatus(inv.status as InvoiceStatus, inv);
      if (status !== inv.status) await tx.invoice.update({ where: { id: payment.invoiceId }, data: { status, paidAt: null } });
    }
    await logAudit(tx, {
      actor: auditActor(admin),
      action: "payment.delete",
      objectType: "Payment",
      objectId: id,
      summary: `Zahlung CHF ${formatChf(payment.amountRappen)}${payment.invoice ? ` zu Rechnung ${payment.invoice.number}` : ""} gelöscht`,
      before: { amountRappen: payment.amountRappen, receivedAt: payment.receivedAt, reference: payment.reference },
    });
  });
}

/** Bucht eine bereits erfasste, aber noch nicht gebuchte Zahlung nach. */
export async function bookExistingPayment(admin: Actor, paymentId: string, accounts: { assetAccountId: string; incomeAccountId: string | null }): Promise<BookingOutcome> {
  const settings = await getVereinSettings();
  return db.$transaction(async (tx) => {
    const payment = await tx.payment.findUnique({
      where: { id: paymentId },
      select: { id: true, receivedAt: true, amountRappen: true, reference: true, transaction: { select: { id: true } }, invoice: { select: { number: true, subject: true, items: { select: { categoryId: true } } } } },
    });
    if (!payment) throw new ApiError(404, "NOT_FOUND", "Zahlung nicht gefunden.");
    if (payment.transaction) conflict("Diese Zahlung ist bereits gebucht.");
    const booking = await bookPayment(tx, {
      payment,
      invoice: payment.invoice ? { number: payment.invoice.number, subject: payment.invoice.subject, categoryIds: payment.invoice.items.map((i) => i.categoryId) } : null,
      assetAccountId: accounts.assetAccountId,
      incomeAccountId: accounts.incomeAccountId,
      fiscalStart: fiscalStartOf(settings),
      actor: admin,
    });
    if (booking.status === "PENDING") throw new ApiError(422, "VALIDATION_ERROR", booking.reason, { incomeAccountId: "Bitte ein Ertragskonto wählen." });
    await logAudit(tx, { actor: auditActor(admin), action: "payment.book", objectType: "Payment", objectId: paymentId, summary: `Zahlung nachgebucht (Beleg ${booking.voucherNo})`, after: { voucherNo: booking.voucherNo } });
    return booking;
  });
}
