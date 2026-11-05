// Datenzugriff und Befehle der Kassa (nur auf dem Server): Konten, Buchungen, Gegenbuchungen, Belege, Budget, Geschäftsjahre und
// Auswertungen. Grundsätze: Belegnummern atomar in derselben Transaktion wie die Buchung (ids.ts), jede Änderung mit Protokolleintrag in
// derselben Transaktion, abgeschlossene Geschäftsjahre bleiben unverändert (Korrektur nur mit Gegenbuchung im offenen Jahr).
import "server-only";
import type { Prisma } from "@prisma/client";
import { ApiError } from "@/lib/api";
import { db } from "@/lib/db";
import { auditActor, diffObjects, logAudit } from "./audit";
import { fiscalYearOf, fiscalYearRange, formatDateCh, todayZurich, type FiscalStart } from "./dates";
import type { ExportTransaction } from "./ledger-export";
import { nextVoucherNumber } from "./ids";
import { assertYearUnlocked } from "./ledger-link";
import {
  budgetComparison,
  buildAnnualStatement,
  canCloseFiscalYear,
  editBlockReason,
  lockBlockReason,
  MAX_RECEIPTS_PER_TRANSACTION,
  monthlySeries,
  planStandardAccounts,
  receiptRemoveBlockReason,
  reverseBlockReason,
  reversalText,
  transactionState,
  unlockBlockReason,
  validateBookingAccounts,
  yearChoices,
  type AccountRef,
  type AnnualStatement,
  type BudgetComparison,
  type LedgerAccount,
  type LedgerDatedEntry,
  type LedgerEntry,
  type MonthRow,
  type TransactionState,
} from "./ledger-lib";
import type { AccountInput, BudgetInput, FiscalActionInput, LedgerFilters, ReverseInput, TransactionCreateInput, TransactionPatchInput } from "./ledger-schemas";
import { formatChf, parseChf } from "./money";
import { searchWhere } from "./pagination";
import { fiscalStartOf, getVereinSettings } from "./settings";
import type { UploadCheck } from "./files";

type Tx = Prisma.TransactionClient;
export type LedgerActor = { id: string; name: string };
export type LedgerRoleActor = LedgerActor & { roles: readonly string[] };

const conflict = (message: string): never => {
  throw new ApiError(409, "CONFLICT", message);
};
const invalid = (field: string, message: string): never => {
  throw new ApiError(422, "VALIDATION_ERROR", message, { [field]: message });
};

export async function getFiscalStart(): Promise<FiscalStart> {
  return fiscalStartOf(await getVereinSettings());
}

export async function currentFiscalYear(): Promise<number> {
  return fiscalYearOf(todayZurich(), await getFiscalStart());
}

// ---- Konten -----------------------------------------------------------------------------------------------------------------

const accountSelect = { id: true, kind: true, number: true, name: true, openingBalanceRappen: true, active: true, sortOrder: true } satisfies Prisma.AccountCategorySelect;

export async function loadAccounts(): Promise<LedgerAccount[]> {
  return db.accountCategory.findMany({ select: accountSelect, orderBy: [{ sortOrder: "asc" }, { number: "asc" }] });
}

export type AccountRow = LedgerAccount & { usage: number };

/** Konten mit der Zahl ihrer Verwendungen (Buchungen, Gegenkonto, Budget, Rechnungspositionen). */
export async function listAccountsWithUsage(): Promise<AccountRow[]> {
  const rows = await db.accountCategory.findMany({
    select: { ...accountSelect, _count: { select: { transactions: true, counterTransactions: true, budgets: true, invoiceItems: true } } },
    orderBy: [{ sortOrder: "asc" }, { number: "asc" }],
  });
  return rows.map(({ _count, ...a }) => ({ ...a, usage: _count.transactions + _count.counterTransactions + _count.budgets + _count.invoiceItems }));
}

async function anyLockedYear(client: Tx | typeof db): Promise<boolean> {
  return (await client.fiscalYear.count({ where: { lockedAt: { not: null } } })) > 0;
}

async function assertAccountNameFree(client: Tx | typeof db, kind: string, name: string, exceptId?: string): Promise<void> {
  const same = await client.accountCategory.findMany({ where: { kind }, select: { id: true, name: true } });
  if (same.some((a) => a.id !== exceptId && a.name.trim().toLowerCase() === name.trim().toLowerCase())) invalid("name", "Ein Konto dieser Art mit diesem Namen gibt es schon.");
}

export async function createAccount(admin: LedgerActor, input: AccountInput): Promise<{ id: string }> {
  if (input.kind !== "VERMOEGEN" && input.openingBalance !== 0) invalid("openingBalance", "Einen Anfangsbestand gibt es nur bei Vermögenskonten.");
  return db.$transaction(async (tx) => {
    if (await tx.accountCategory.findUnique({ where: { number: input.number }, select: { id: true } })) invalid("number", "Diese Nummer ist bereits vergeben.");
    await assertAccountNameFree(tx, input.kind, input.name);
    if (input.kind === "VERMOEGEN" && input.openingBalance !== 0 && (await anyLockedYear(tx))) {
      conflict("Ein Anfangsbestand kann nicht mehr festgelegt werden, weil bereits ein Geschäftsjahr abgeschlossen ist.");
    }
    const created = await tx.accountCategory.create({
      data: { kind: input.kind, number: input.number, name: input.name, openingBalanceRappen: input.openingBalance, active: input.active, sortOrder: input.sortOrder },
      select: { id: true },
    });
    await logAudit(tx, {
      actor: auditActor(admin),
      action: "account.create",
      objectType: "AccountCategory",
      objectId: created.id,
      summary: `Konto ${input.number} «${input.name}» angelegt`,
      after: { art: input.kind, nummer: input.number, name: input.name, anfangsbestand: input.openingBalance },
    });
    return created;
  });
}

export async function createStandardAccounts(admin: LedgerActor): Promise<{ created: number }> {
  return db.$transaction(async (tx) => {
    const existing = await tx.accountCategory.findMany({ select: { kind: true, number: true, name: true, sortOrder: true } });
    const plan = planStandardAccounts(existing);
    for (const p of plan) await tx.accountCategory.create({ data: { kind: p.kind, number: p.number, name: p.name, sortOrder: p.sortOrder } });
    if (plan.length > 0) {
      await logAudit(tx, { actor: auditActor(admin), action: "account.template", objectType: "AccountCategory", summary: `${plan.length} Standardkonten angelegt`, after: { konten: plan.map((p) => `${p.number} ${p.name}`) } });
    }
    return { created: plan.length };
  });
}

export async function updateAccount(admin: LedgerActor, id: string, patch: Partial<AccountInput>): Promise<void> {
  await db.$transaction(async (tx) => {
    const before = await tx.accountCategory.findUnique({
      where: { id },
      select: { ...accountSelect, _count: { select: { transactions: true, counterTransactions: true, budgets: true, invoiceItems: true } } },
    });
    if (!before) throw new ApiError(404, "NOT_FOUND", "Konto nicht gefunden.");
    const used = before._count.transactions + before._count.counterTransactions + before._count.budgets + before._count.invoiceItems > 0;
    const kind = patch.kind ?? before.kind;
    if (patch.kind !== undefined && patch.kind !== before.kind && used) conflict("Die Art eines Kontos, das schon verwendet wird, lässt sich nicht ändern. Lege ein neues Konto an.");
    const opening = patch.openingBalance ?? before.openingBalanceRappen;
    if (kind !== "VERMOEGEN" && opening !== 0) invalid("openingBalance", "Einen Anfangsbestand gibt es nur bei Vermögenskonten.");
    if (patch.openingBalance !== undefined && patch.openingBalance !== before.openingBalanceRappen && (await anyLockedYear(tx))) {
      conflict("Der Anfangsbestand lässt sich nicht mehr ändern, weil bereits ein Geschäftsjahr abgeschlossen ist. Er ist Teil der abgeschlossenen Jahresrechnung.");
    }
    if (patch.number !== undefined && patch.number !== before.number) {
      if (await tx.accountCategory.findUnique({ where: { number: patch.number }, select: { id: true } })) invalid("number", "Diese Nummer ist bereits vergeben.");
    }
    if (patch.name !== undefined || patch.kind !== undefined) await assertAccountNameFree(tx, kind, patch.name ?? before.name, id);
    const data = {
      ...(patch.kind !== undefined ? { kind: patch.kind } : {}),
      ...(patch.number !== undefined ? { number: patch.number } : {}),
      ...(patch.name !== undefined ? { name: patch.name } : {}),
      ...(patch.openingBalance !== undefined ? { openingBalanceRappen: patch.openingBalance } : {}),
      ...(patch.active !== undefined ? { active: patch.active } : {}),
      ...(patch.sortOrder !== undefined ? { sortOrder: patch.sortOrder } : {}),
    };
    const after = await tx.accountCategory.update({ where: { id }, data, select: accountSelect });
    const { before: b, after: a } = diffObjects(
      { art: before.kind, nummer: before.number, name: before.name, anfangsbestand: before.openingBalanceRappen, aktiv: before.active, reihenfolge: before.sortOrder },
      { art: after.kind, nummer: after.number, name: after.name, anfangsbestand: after.openingBalanceRappen, aktiv: after.active, reihenfolge: after.sortOrder },
    );
    await logAudit(tx, { actor: auditActor(admin), action: "account.update", objectType: "AccountCategory", objectId: id, summary: `Konto ${after.number} «${after.name}» geändert`, before: b, after: a });
  });
}

export async function deleteAccount(admin: LedgerActor, id: string): Promise<void> {
  await db.$transaction(async (tx) => {
    const a = await tx.accountCategory.findUnique({
      where: { id },
      select: { ...accountSelect, _count: { select: { transactions: true, counterTransactions: true, budgets: true, invoiceItems: true } } },
    });
    if (!a) throw new ApiError(404, "NOT_FOUND", "Konto nicht gefunden.");
    const c = a._count;
    if (c.transactions + c.counterTransactions + c.invoiceItems > 0) conflict("Das Konto wird in Buchungen oder Rechnungen verwendet und kann nicht gelöscht werden (Aufbewahrungspflicht). Deaktiviere es stattdessen.");
    await tx.accountCategory.delete({ where: { id } });
    await logAudit(tx, { actor: auditActor(admin), action: "account.delete", objectType: "AccountCategory", objectId: id, summary: `Konto ${a.number} «${a.name}» gelöscht`, before: { art: a.kind, nummer: a.number, name: a.name } });
  });
}

// ---- Buchungen: Lesen -----------------------------------------------------------------------------------------------------

export function transactionWhere(f: Pick<LedgerFilters, "q" | "year" | "direction" | "source" | "accountId" | "noReceipt">): Prisma.TransactionWhereInput {
  const and: Prisma.TransactionWhereInput[] = [];
  if (f.year !== null) and.push({ fiscalYear: f.year });
  if (f.direction) and.push({ direction: f.direction });
  if (f.source) and.push({ source: f.source });
  if (f.accountId) and.push({ OR: [{ categoryId: f.accountId }, { counterAccountId: f.accountId }] });
  if (f.noReceipt) and.push({ receipts: { none: {} } });
  if (f.q) {
    const text = searchWhere(f.q, ["text", "voucherRef", "voucherNo"]);
    const amount = /\d/.test(f.q) && !/[A-Za-z]/.test(f.q) ? parseChf(f.q) : null;
    and.push(amount !== null && amount > 0 ? { OR: [{ amountRappen: amount }, { AND: text.AND }] } : { AND: text.AND });
  }
  return and.length ? { AND: and } : {};
}

const listSelect = {
  id: true,
  bookingDate: true,
  fiscalYear: true,
  voucherNo: true,
  direction: true,
  amountRappen: true,
  text: true,
  voucherRef: true,
  source: true,
  category: { select: { number: true, name: true } },
  counterAccount: { select: { number: true, name: true } },
  reversedBy: { select: { id: true } },
  reversalOfId: true,
  _count: { select: { receipts: true } },
} satisfies Prisma.TransactionSelect;
export type TransactionListRow = Prisma.TransactionGetPayload<{ select: typeof listSelect }> & { state: TransactionState };

const ORDER: Prisma.TransactionOrderByWithRelationInput[] = [{ bookingDate: "desc" }, { createdAt: "desc" }, { id: "desc" }];

export async function listTransactions(f: LedgerFilters, skip: number, take: number): Promise<{ rows: TransactionListRow[]; total: number }> {
  const where = transactionWhere(f);
  const [rows, total] = await Promise.all([db.transaction.findMany({ where, orderBy: ORDER, skip, take, select: listSelect }), db.transaction.count({ where })]);
  return { rows: rows.map((r) => ({ ...r, state: transactionState({ reversed: r.reversedBy !== null, isReversal: r.reversalOfId !== null }) })), total };
}

export type FilterTotals = { incomeRappen: number; expenseRappen: number; resultRappen: number; count: number };

/** Summen der gefilterten Buchungen (Gegenbuchungen zählen negativ, Umbuchungen nicht). */
export async function filterTotals(f: LedgerFilters): Promise<FilterTotals> {
  const groups = await db.transaction.groupBy({ by: ["direction", "source"], where: transactionWhere(f), _sum: { amountRappen: true }, _count: { _all: true } });
  let income = 0;
  let expense = 0;
  let count = 0;
  for (const g of groups) {
    const a = (g._sum.amountRappen ?? 0) * (g.source === "STORNO" ? -1 : 1);
    count += g._count._all;
    if (g.direction === "EINNAHME") income += a;
    else if (g.direction === "AUSGABE") expense += a;
  }
  return { incomeRappen: income, expenseRappen: expense, resultRappen: income - expense, count };
}

export async function listTransactionsForExport(f: LedgerFilters, limit = 20000): Promise<ExportTransaction[]> {
  const rows = await db.transaction.findMany({
    where: transactionWhere(f),
    orderBy: [{ bookingDate: "asc" }, { createdAt: "asc" }, { id: "asc" }],
    take: limit,
    select: {
      bookingDate: true,
      fiscalYear: true,
      voucherNo: true,
      direction: true,
      amountRappen: true,
      text: true,
      voucherRef: true,
      source: true,
      createdByName: true,
      category: { select: { number: true, name: true } },
      counterAccount: { select: { number: true, name: true } },
      reversalOf: { select: { voucherNo: true } },
      _count: { select: { receipts: true } },
    },
  });
  return rows.map((r) => ({
    bookingDate: r.bookingDate,
    fiscalYear: r.fiscalYear,
    voucherNo: r.voucherNo,
    direction: r.direction,
    amountRappen: r.amountRappen,
    text: r.text,
    voucherRef: r.voucherRef,
    source: r.source,
    reversalOfVoucherNo: r.reversalOf?.voucherNo ?? "",
    category: r.category,
    counterAccount: r.counterAccount,
    receiptCount: r._count.receipts,
    createdByName: r.createdByName,
  }));
}

export type ReceiptMeta = { id: string; fileName: string; mimeType: string; sizeBytes: number; uploadedByName: string; createdAt: Date };

export type TransactionDetail = {
  id: string;
  bookingDate: Date;
  fiscalYear: number;
  voucherNo: string;
  direction: string;
  amountRappen: number;
  categoryId: string;
  counterAccountId: string | null;
  text: string;
  voucherRef: string;
  source: string;
  createdByName: string;
  createdAt: Date;
  updatedAt: Date;
  category: { number: string; name: string; active: boolean };
  counterAccount: { number: string; name: string; active: boolean } | null;
  receipts: ReceiptMeta[];
  reversalOf: { id: string; voucherNo: string; text: string } | null;
  reversedBy: { id: string; voucherNo: string; bookingDate: Date } | null;
  payment: { id: string; invoiceId: string | null; invoiceNumber: string | null } | null;
  locked: boolean;
  state: TransactionState;
  editBlock: string | null;
  reverseBlock: string | null;
  receiptRemoveBlock: string | null;
};

export async function getTransactionDetail(id: string): Promise<TransactionDetail | null> {
  const t = await db.transaction.findUnique({
    where: { id },
    select: {
      id: true,
      bookingDate: true,
      fiscalYear: true,
      voucherNo: true,
      direction: true,
      amountRappen: true,
      categoryId: true,
      counterAccountId: true,
      text: true,
      voucherRef: true,
      source: true,
      createdByName: true,
      createdAt: true,
      updatedAt: true,
      category: { select: { number: true, name: true, active: true } },
      counterAccount: { select: { number: true, name: true, active: true } },
      receipts: { select: { id: true, fileName: true, mimeType: true, sizeBytes: true, uploadedByName: true, createdAt: true }, orderBy: { createdAt: "asc" } },
      reversalOf: { select: { id: true, voucherNo: true, text: true } },
      reversedBy: { select: { id: true, voucherNo: true, bookingDate: true } },
      payment: { select: { id: true, invoice: { select: { id: true, number: true } } } },
    },
  });
  if (!t) return null;
  const fy = await db.fiscalYear.findUnique({ where: { year: t.fiscalYear }, select: { lockedAt: true } });
  const locked = Boolean(fy?.lockedAt);
  const facts = { source: t.source, reversed: t.reversedBy !== null, isReversal: t.reversalOf !== null, locked };
  const { payment, ...rest } = t;
  return {
    ...rest,
    payment: payment ? { id: payment.id, invoiceId: payment.invoice?.id ?? null, invoiceNumber: payment.invoice?.number ?? null } : null,
    locked,
    state: transactionState(facts),
    editBlock: editBlockReason(facts),
    reverseBlock: reverseBlockReason(facts),
    receiptRemoveBlock: receiptRemoveBlockReason(locked),
  };
}

// ---- Buchungen: Ändern ------------------------------------------------------------------------------------------------------

async function loadRefs(tx: Tx, ids: Array<string | null>): Promise<Map<string, AccountRef>> {
  const wanted = ids.filter((x): x is string => Boolean(x));
  const rows = await tx.accountCategory.findMany({ where: { id: { in: wanted } }, select: { id: true, kind: true, active: true, name: true } });
  return new Map(rows.map((r) => [r.id, r]));
}

function bookingProblem(direction: string, refs: Map<string, AccountRef>, categoryId: string, counterId: string | null, checkActive: { category: boolean; counter: boolean }): void {
  const problem = validateBookingAccounts(direction, refs.get(categoryId) ?? null, counterId ? (refs.get(counterId) ?? null) : null, { checkActive });
  if (problem) invalid(problem.field, problem.message);
}

export async function createTransaction(admin: LedgerActor, input: TransactionCreateInput): Promise<{ id: string; voucherNo: string }> {
  const fiscal = await getFiscalStart();
  const fy = fiscalYearOf(input.bookingDate, fiscal);
  return db.$transaction(async (tx) => {
    await assertYearUnlocked(tx, fy);
    const refs = await loadRefs(tx, [input.categoryId, input.counterAccountId]);
    bookingProblem(input.direction, refs, input.categoryId, input.counterAccountId, { category: true, counter: true });
    const voucher = await nextVoucherNumber(tx, fy);
    const created = await tx.transaction.create({
      data: {
        bookingDate: input.bookingDate,
        fiscalYear: fy,
        voucherNo: voucher.number,
        direction: input.direction,
        amountRappen: input.amount,
        categoryId: input.categoryId,
        counterAccountId: input.counterAccountId,
        text: input.text,
        voucherRef: input.voucherRef,
        source: "MANUELL",
        createdById: admin.id,
        createdByName: admin.name,
      },
      select: { id: true, voucherNo: true },
    });
    await logAudit(tx, {
      actor: auditActor(admin),
      action: "transaction.create",
      objectType: "Transaction",
      objectId: created.id,
      summary: `Buchung ${created.voucherNo} erfasst: ${input.text} (CHF ${formatChf(input.amount)})`,
      after: { beleg: created.voucherNo, datum: input.bookingDate, art: input.direction, betragRappen: input.amount, konto: refs.get(input.categoryId)?.name, gegenkonto: refs.get(input.counterAccountId)?.name, text: input.text },
    });
    return created;
  });
}

export async function updateTransaction(admin: LedgerActor, id: string, patch: TransactionPatchInput): Promise<void> {
  const fiscal = await getFiscalStart();
  await db.$transaction(async (tx) => {
    const t = await tx.transaction.findUnique({
      where: { id },
      select: {
        id: true,
        bookingDate: true,
        fiscalYear: true,
        voucherNo: true,
        direction: true,
        amountRappen: true,
        categoryId: true,
        counterAccountId: true,
        text: true,
        voucherRef: true,
        source: true,
        reversalOfId: true,
        reversedBy: { select: { id: true } },
        category: { select: { number: true, name: true } },
        counterAccount: { select: { number: true, name: true } },
      },
    });
    if (!t) throw new ApiError(404, "NOT_FOUND", "Buchung nicht gefunden.");
    const fy = await tx.fiscalYear.findUnique({ where: { year: t.fiscalYear }, select: { lockedAt: true } });
    const blocked = editBlockReason({ source: t.source, reversed: t.reversedBy !== null, isReversal: t.reversalOfId !== null, locked: Boolean(fy?.lockedAt) });
    if (blocked) conflict(blocked);

    const bookingDate = patch.bookingDate ?? t.bookingDate;
    if (patch.bookingDate && fiscalYearOf(bookingDate, fiscal) !== t.fiscalYear) {
      conflict(`Das Datum liegt in einem anderen Geschäftsjahr als die Buchung (${t.fiscalYear}). Storniere die Buchung und erfasse sie neu.`);
    }
    const categoryId = patch.categoryId ?? t.categoryId;
    const counterId = patch.counterAccountId ?? t.counterAccountId;
    const refs = await loadRefs(tx, [categoryId, counterId]);
    bookingProblem(t.direction, refs, categoryId, counterId, { category: categoryId !== t.categoryId, counter: counterId !== t.counterAccountId });

    const after = await tx.transaction.update({
      where: { id },
      data: {
        bookingDate,
        amountRappen: patch.amount ?? t.amountRappen,
        categoryId,
        counterAccountId: counterId,
        text: patch.text ?? t.text,
        voucherRef: patch.voucherRef ?? t.voucherRef,
      },
      select: { bookingDate: true, amountRappen: true, text: true, voucherRef: true },
    });
    const name = (r: { number: string; name: string } | undefined | null) => (r ? `${r.number} ${r.name}` : null);
    const newCat = refs.get(categoryId);
    const newCounter = counterId ? refs.get(counterId) : null;
    const { before: b, after: a } = diffObjects(
      { datum: t.bookingDate, betragRappen: t.amountRappen, konto: name(t.category), gegenkonto: name(t.counterAccount), text: t.text, belegReferenz: t.voucherRef },
      {
        datum: after.bookingDate,
        betragRappen: after.amountRappen,
        konto: categoryId === t.categoryId ? name(t.category) : (newCat?.name ?? null),
        gegenkonto: counterId === t.counterAccountId ? name(t.counterAccount) : (newCounter?.name ?? null),
        text: after.text,
        belegReferenz: after.voucherRef,
      },
    );
    await logAudit(tx, { actor: auditActor(admin), action: "transaction.update", objectType: "Transaction", objectId: id, summary: `Buchung ${t.voucherNo} geändert`, before: b, after: a });
  });
}

export async function reverseTransaction(admin: LedgerActor, id: string, input: ReverseInput): Promise<{ id: string; voucherNo: string }> {
  const fiscal = await getFiscalStart();
  const date = input.bookingDate ?? todayZurich();
  const fy = fiscalYearOf(date, fiscal);
  return db.$transaction(async (tx) => {
    const t = await tx.transaction.findUnique({
      where: { id },
      select: { id: true, bookingDate: true, voucherNo: true, direction: true, amountRappen: true, categoryId: true, counterAccountId: true, text: true, voucherRef: true, source: true, reversalOfId: true, reversedBy: { select: { id: true } } },
    });
    if (!t) throw new ApiError(404, "NOT_FOUND", "Buchung nicht gefunden.");
    const blocked = reverseBlockReason({ reversed: t.reversedBy !== null, isReversal: t.reversalOfId !== null });
    if (blocked) conflict(blocked);
    if (date.getTime() < t.bookingDate.getTime()) invalid("bookingDate", `Die Gegenbuchung kann nicht vor der Buchung (${formatDateCh(t.bookingDate)}) liegen.`);
    await assertYearUnlocked(tx, fy);
    const voucher = await nextVoucherNumber(tx, fy);
    const created = await tx.transaction.create({
      data: {
        bookingDate: date,
        fiscalYear: fy,
        voucherNo: voucher.number,
        direction: t.direction,
        amountRappen: t.amountRappen,
        categoryId: t.categoryId,
        counterAccountId: t.counterAccountId,
        text: reversalText(t, input.reason),
        voucherRef: t.voucherRef,
        source: "STORNO",
        reversalOfId: t.id,
        createdById: admin.id,
        createdByName: admin.name,
      },
      select: { id: true, voucherNo: true },
    });
    await logAudit(tx, {
      actor: auditActor(admin),
      action: "transaction.reverse",
      objectType: "Transaction",
      objectId: id,
      summary: `Buchung ${t.voucherNo} storniert (Gegenbuchung ${created.voucherNo})`,
      after: { gegenbuchung: created.voucherNo, datum: date, betragRappen: t.amountRappen, grund: input.reason, quelle: t.source },
    });
    return created;
  });
}

// ---- Belege ------------------------------------------------------------------------------------------------------------------

export async function addReceipt(admin: LedgerActor, transactionId: string, upload: Extract<UploadCheck, { ok: true }>): Promise<ReceiptMeta> {
  return db.$transaction(async (tx) => {
    const t = await tx.transaction.findUnique({ where: { id: transactionId }, select: { id: true, voucherNo: true, receipts: { select: { sha256: true } } } });
    if (!t) throw new ApiError(404, "NOT_FOUND", "Buchung nicht gefunden.");
    if (t.receipts.length >= MAX_RECEIPTS_PER_TRANSACTION) conflict(`Pro Buchung sind höchstens ${MAX_RECEIPTS_PER_TRANSACTION} Belege möglich.`);
    if (t.receipts.some((r) => r.sha256 === upload.sha256)) conflict("Diese Datei ist bereits als Beleg angehängt.");
    const created = await tx.receipt.create({
      data: {
        transactionId,
        fileName: upload.fileName,
        mimeType: upload.mimeType,
        sizeBytes: upload.sizeBytes,
        sha256: upload.sha256,
        data: new Uint8Array(upload.data),
        uploadedById: admin.id,
        uploadedByName: admin.name,
      },
      select: { id: true, fileName: true, mimeType: true, sizeBytes: true, uploadedByName: true, createdAt: true },
    });
    await logAudit(tx, {
      actor: auditActor(admin),
      action: "receipt.add",
      objectType: "Transaction",
      objectId: transactionId,
      summary: `Beleg «${upload.fileName}» zu Buchung ${t.voucherNo} hinzugefügt`,
      after: { datei: upload.fileName, typ: upload.mimeType, bytes: upload.sizeBytes, pruefsumme: upload.sha256.slice(0, 16) },
    });
    return created;
  });
}

export async function deleteReceipt(admin: LedgerActor, receiptId: string): Promise<void> {
  await db.$transaction(async (tx) => {
    const r = await tx.receipt.findUnique({ where: { id: receiptId }, select: { id: true, fileName: true, sha256: true, transactionId: true, transaction: { select: { voucherNo: true, fiscalYear: true } } } });
    if (!r) throw new ApiError(404, "NOT_FOUND", "Beleg nicht gefunden.");
    const fy = await tx.fiscalYear.findUnique({ where: { year: r.transaction.fiscalYear }, select: { lockedAt: true } });
    const blocked = receiptRemoveBlockReason(Boolean(fy?.lockedAt));
    if (blocked) conflict(blocked);
    await tx.receipt.delete({ where: { id: receiptId } });
    await logAudit(tx, {
      actor: auditActor(admin),
      action: "receipt.delete",
      objectType: "Transaction",
      objectId: r.transactionId,
      summary: `Beleg «${r.fileName}» von Buchung ${r.transaction.voucherNo} entfernt`,
      before: { datei: r.fileName, pruefsumme: r.sha256.slice(0, 16) },
    });
  });
}

export async function getReceiptFile(id: string): Promise<{ fileName: string; mimeType: string; sizeBytes: number; data: Buffer } | null> {
  const r = await db.receipt.findUnique({ where: { id }, select: { fileName: true, mimeType: true, sizeBytes: true, data: true } });
  return r ? { fileName: r.fileName, mimeType: r.mimeType, sizeBytes: r.sizeBytes, data: Buffer.from(r.data) } : null;
}

// ---- Auswertungen ------------------------------------------------------------------------------------------------------------

/** Alle Buchungen bis und mit `year`, nach Jahr, Richtung, Quelle und Konten zusammengefasst (klein und schnell). */
export async function loadEntriesUpTo(year: number): Promise<LedgerEntry[]> {
  const groups = await db.transaction.groupBy({
    by: ["fiscalYear", "direction", "source", "categoryId", "counterAccountId"],
    where: { fiscalYear: { lte: year } },
    _sum: { amountRappen: true },
  });
  return groups.map((g) => ({
    fiscalYear: g.fiscalYear,
    direction: g.direction,
    amountRappen: g._sum.amountRappen ?? 0,
    categoryId: g.categoryId,
    counterAccountId: g.counterAccountId,
    reversal: g.source === "STORNO",
  }));
}

async function loadDatedEntries(year: number): Promise<LedgerDatedEntry[]> {
  const rows = await db.transaction.findMany({ where: { fiscalYear: year }, select: { bookingDate: true, fiscalYear: true, direction: true, amountRappen: true, categoryId: true, counterAccountId: true, source: true } });
  return rows.map((r) => ({ bookingDate: r.bookingDate, fiscalYear: r.fiscalYear, direction: r.direction, amountRappen: r.amountRappen, categoryId: r.categoryId, counterAccountId: r.counterAccountId, reversal: r.source === "STORNO" }));
}

export type FiscalYearInfo = { year: number; startsOn: Date; endsOn: Date; locked: boolean; lockedAt: Date | null; lockedByName: string; approvedAt: Date | null; note: string };

export async function getFiscalYearInfo(year: number, start?: FiscalStart): Promise<FiscalYearInfo> {
  const fiscal = start ?? (await getFiscalStart());
  const row = await db.fiscalYear.findUnique({ where: { year } });
  const range = fiscalYearRange(year, fiscal);
  return {
    year,
    startsOn: row?.startsOn ?? range.start,
    endsOn: row?.endsOn ?? range.end,
    locked: Boolean(row?.lockedAt),
    lockedAt: row?.lockedAt ?? null,
    lockedByName: row?.lockedByName ?? "",
    approvedAt: row?.approvedAt ?? null,
    note: row?.note ?? "",
  };
}

export type AnnualReport = {
  fiscal: FiscalStart;
  info: FiscalYearInfo;
  accounts: LedgerAccount[];
  statement: AnnualStatement;
  months: MonthRow[];
  budget: BudgetComparison;
  bookingCount: number;
  receiptMissingCount: number;
};

export async function loadBudgetMap(year: number): Promise<Map<string, number>> {
  const rows = await db.budget.findMany({ where: { year }, select: { categoryId: true, amountRappen: true } });
  return new Map(rows.map((r) => [r.categoryId, r.amountRappen]));
}

export async function getAnnualReport(year: number): Promise<AnnualReport> {
  const fiscal = await getFiscalStart();
  const [accounts, entries, dated, budgets, info, bookingCount, receiptMissingCount] = await Promise.all([
    loadAccounts(),
    loadEntriesUpTo(year),
    loadDatedEntries(year),
    loadBudgetMap(year),
    getFiscalYearInfo(year, fiscal),
    db.transaction.count({ where: { fiscalYear: year } }),
    db.transaction.count({ where: { fiscalYear: year, source: "MANUELL", receipts: { none: {} } } }),
  ]);
  const statement = buildAnnualStatement(accounts, entries, year);
  return {
    fiscal,
    info,
    accounts,
    statement,
    months: monthlySeries(accounts, dated, year, fiscal, statement.assetStartRappen),
    budget: budgetComparison(accounts, budgets, entries, year),
    bookingCount,
    receiptMissingCount,
  };
}

/** Jahre für Auswahllisten: Jahre mit Buchungen, Budgets oder Abschluss plus das laufende. */
export async function knownYears(): Promise<{ years: number[]; current: number }> {
  const [tx, budgets, fiscalRows, current] = await Promise.all([
    db.transaction.groupBy({ by: ["fiscalYear"] }),
    db.budget.groupBy({ by: ["year"] }),
    db.fiscalYear.findMany({ select: { year: true } }),
    currentFiscalYear(),
  ]);
  const known = [...tx.map((r) => r.fiscalYear), ...budgets.map((r) => r.year), ...fiscalRows.map((r) => r.year)];
  return { years: yearChoices(known, current), current };
}

export async function getAnnualStatementOnly(year: number): Promise<AnnualStatement> {
  const [accounts, entries] = await Promise.all([loadAccounts(), loadEntriesUpTo(year)]);
  return buildAnnualStatement(accounts, entries, year);
}

// ---- Budget -------------------------------------------------------------------------------------------------------------------

export type BudgetEditor = { year: number; locked: boolean; comparison: BudgetComparison; previous: BudgetComparison };

export async function getBudgetEditor(year: number): Promise<BudgetEditor> {
  const [accounts, entries, budgets, prevBudgets, info] = await Promise.all([loadAccounts(), loadEntriesUpTo(year), loadBudgetMap(year), loadBudgetMap(year - 1), getFiscalYearInfo(year)]);
  return {
    year,
    locked: info.locked,
    comparison: budgetComparison(accounts, budgets, entries, year),
    previous: budgetComparison(accounts, prevBudgets, entries, year - 1),
  };
}

export async function saveBudget(admin: LedgerActor, input: BudgetInput): Promise<{ saved: number; removed: number }> {
  return db.$transaction(async (tx) => {
    await assertYearUnlocked(tx, input.year);
    const ids = [...new Set(input.items.map((i) => i.categoryId))];
    const accounts = await tx.accountCategory.findMany({ where: { id: { in: ids } }, select: { id: true, kind: true, number: true, name: true } });
    const byId = new Map(accounts.map((a) => [a.id, a]));
    for (const i of input.items) {
      const a = byId.get(i.categoryId);
      if (!a || (a.kind !== "EINNAHMEN" && a.kind !== "AUSGABEN")) invalid("items", "Ein Budget gibt es nur für Einnahmen- und Ausgabenkonten.");
    }
    const existing = new Map((await tx.budget.findMany({ where: { year: input.year, categoryId: { in: ids } }, select: { categoryId: true, amountRappen: true } })).map((b) => [b.categoryId, b.amountRappen]));
    const before: Record<string, number> = {};
    const after: Record<string, number | null> = {};
    let saved = 0;
    let removed = 0;
    for (const i of input.items) {
      const a = byId.get(i.categoryId)!;
      const old = existing.get(i.categoryId) ?? null;
      if (old === i.amount) continue;
      const label = `${a.number} ${a.name}`;
      if (old !== null) before[label] = old;
      after[label] = i.amount;
      if (i.amount === null) {
        await tx.budget.deleteMany({ where: { year: input.year, categoryId: i.categoryId } });
        removed += 1;
      } else {
        await tx.budget.upsert({
          where: { year_categoryId: { year: input.year, categoryId: i.categoryId } },
          create: { year: input.year, categoryId: i.categoryId, amountRappen: i.amount },
          update: { amountRappen: i.amount },
        });
        saved += 1;
      }
    }
    if (saved + removed > 0) {
      await logAudit(tx, {
        actor: auditActor(admin),
        action: "budget.update",
        objectType: "Budget",
        objectId: String(input.year),
        summary: `Budget ${input.year} geändert (${saved} gesetzt, ${removed} entfernt)`,
        before,
        after,
      });
    }
    return { saved, removed };
  });
}

// ---- Geschäftsjahre ---------------------------------------------------------------------------------------------------------

export type FiscalYearListRow = FiscalYearInfo & { bookingCount: number; resultRappen: number; assetEndRappen: number; unbookedPayments: number };

async function unbookedPaymentCount(range: { start: Date; end: Date }): Promise<number> {
  return db.payment.count({ where: { receivedAt: { gte: range.start, lte: range.end }, transaction: { is: null } } });
}

export async function listFiscalYears(): Promise<FiscalYearListRow[]> {
  const fiscal = await getFiscalStart();
  const { years } = await knownYears();
  const maxYear = Math.max(...years);
  const [accounts, entries, counts] = await Promise.all([loadAccounts(), loadEntriesUpTo(maxYear), db.transaction.groupBy({ by: ["fiscalYear"], _count: { _all: true } })]);
  const countBy = new Map(counts.map((c) => [c.fiscalYear, c._count._all]));
  const rows: FiscalYearListRow[] = [];
  for (const year of years) {
    const info = await getFiscalYearInfo(year, fiscal);
    const s = buildAnnualStatement(accounts, entries, year);
    rows.push({ ...info, bookingCount: countBy.get(year) ?? 0, resultRappen: s.resultRappen, assetEndRappen: s.assetEndRappen, unbookedPayments: await unbookedPaymentCount({ start: info.startsOn, end: info.endsOn }) });
  }
  return rows;
}

/** Jahre mit Buchungen, die vor `year` liegen und noch nicht abgeschlossen sind. */
async function earlierOpenYears(tx: Tx, year: number): Promise<number[]> {
  const withBookings = await tx.transaction.groupBy({ by: ["fiscalYear"], where: { fiscalYear: { lt: year } } });
  if (withBookings.length === 0) return [];
  const locked = new Set((await tx.fiscalYear.findMany({ where: { lockedAt: { not: null }, year: { lt: year } }, select: { year: true } })).map((r) => r.year));
  return withBookings.map((r) => r.fiscalYear).filter((y) => !locked.has(y));
}

export async function applyFiscalAction(admin: LedgerRoleActor, year: number, input: FiscalActionInput): Promise<void> {
  if (!canCloseFiscalYear(admin.roles)) throw new ApiError(403, "FORBIDDEN", "Geschäftsjahre schliessen oder öffnen dürfen nur Rollen mit Schreibrecht in der Kassa (Voreinstellung: Kassier und Präsident).");
  const fiscal = await getFiscalStart();
  const range = fiscalYearRange(year, fiscal);
  const today = todayZurich();

  if (input.action === "lock") {
    const pending = await unbookedPaymentCount(range);
    if (pending > 0 && !input.confirmUnbooked) {
      throw new ApiError(409, "UNBOOKED_PAYMENTS", `${pending === 1 ? "Eine Zahlung ist" : `${pending} Zahlungen sind`} in diesem Geschäftsjahr noch nicht in der Kassa gebucht. Buche sie unter «Beiträge» nach oder bestätige den Abschluss trotzdem.`);
    }
    await db.$transaction(async (tx) => {
      const row = await tx.fiscalYear.findUnique({ where: { year }, select: { lockedAt: true } });
      const reason = lockBlockReason({ year, fiscal, today, alreadyLocked: Boolean(row?.lockedAt), earlierOpenYears: await earlierOpenYears(tx, year) });
      if (reason) conflict(reason);
      const accounts = await tx.accountCategory.findMany({ select: accountSelect });
      const groups = await tx.transaction.groupBy({ by: ["fiscalYear", "direction", "source", "categoryId", "counterAccountId"], where: { fiscalYear: { lte: year } }, _sum: { amountRappen: true } });
      const s = buildAnnualStatement(
        accounts,
        groups.map((g) => ({ fiscalYear: g.fiscalYear, direction: g.direction, amountRappen: g._sum.amountRappen ?? 0, categoryId: g.categoryId, counterAccountId: g.counterAccountId, reversal: g.source === "STORNO" })),
        year,
      );
      await tx.fiscalYear.upsert({
        where: { year },
        create: { year, startsOn: range.start, endsOn: range.end, lockedAt: new Date(), lockedByName: admin.name, note: input.note },
        update: { startsOn: range.start, endsOn: range.end, lockedAt: new Date(), lockedByName: admin.name, ...(input.note ? { note: input.note } : {}) },
      });
      await logAudit(tx, {
        actor: auditActor(admin),
        action: "fiscalyear.lock",
        objectType: "FiscalYear",
        objectId: String(year),
        summary: `Geschäftsjahr ${year} abgeschlossen (Ergebnis CHF ${formatChf(s.resultRappen)}, Vermögen CHF ${formatChf(s.assetEndRappen)})`,
        after: { einnahmenRappen: s.totalIncomeRappen, ausgabenRappen: s.totalExpenseRappen, ergebnisRappen: s.resultRappen, vermoegenRappen: s.assetEndRappen, nichtGebuchteZahlungen: pending, bemerkung: input.note },
      });
    });
    return;
  }

  if (input.action === "unlock") {
    if (!input.note.trim()) invalid("note", "Bitte begründe die Wiedereröffnung. Sie wird im Änderungsprotokoll festgehalten.");
    await db.$transaction(async (tx) => {
      const row = await tx.fiscalYear.findUnique({ where: { year }, select: { lockedAt: true, approvedAt: true } });
      const later = (await tx.fiscalYear.findMany({ where: { lockedAt: { not: null }, year: { gt: year } }, select: { year: true } })).map((r) => r.year);
      const reason = unlockBlockReason({ year, locked: Boolean(row?.lockedAt), laterLockedYears: later });
      if (reason) conflict(reason);
      await tx.fiscalYear.update({ where: { year }, data: { lockedAt: null, lockedByName: "", approvedAt: null } });
      await logAudit(tx, {
        actor: auditActor(admin),
        action: "fiscalyear.unlock",
        objectType: "FiscalYear",
        objectId: String(year),
        summary: `Geschäftsjahr ${year} wieder geöffnet`,
        before: { abgeschlossen: true, genehmigt: row?.approvedAt ?? null },
        after: { abgeschlossen: false, grund: input.note },
      });
    });
    return;
  }

  await db.$transaction(async (tx) => {
    const row = await tx.fiscalYear.findUnique({ where: { year }, select: { lockedAt: true, approvedAt: true } });
    if (!row?.lockedAt) conflict(`Das Geschäftsjahr ${year} muss zuerst abgeschlossen werden.`);
    if (input.action === "approve") {
      if (!input.date) invalid("date", "Bitte das Datum der Genehmigung angeben.");
      if (input.date! > today) invalid("date", "Das Datum der Genehmigung kann nicht in der Zukunft liegen.");
      await tx.fiscalYear.update({ where: { year }, data: { approvedAt: input.date } });
      await logAudit(tx, { actor: auditActor(admin), action: "fiscalyear.approve", objectType: "FiscalYear", objectId: String(year), summary: `Jahresrechnung ${year} als genehmigt vermerkt (${formatDateCh(input.date!)})`, before: { genehmigt: row?.approvedAt ?? null }, after: { genehmigt: input.date } });
    } else {
      if (!row?.approvedAt) conflict("Die Jahresrechnung ist nicht als genehmigt vermerkt.");
      await tx.fiscalYear.update({ where: { year }, data: { approvedAt: null } });
      await logAudit(tx, { actor: auditActor(admin), action: "fiscalyear.unapprove", objectType: "FiscalYear", objectId: String(year), summary: `Genehmigung der Jahresrechnung ${year} zurückgenommen`, before: { genehmigt: row?.approvedAt ?? null }, after: { genehmigt: null } });
    }
  });
}

// ---- Kurzüberblick für die Übersicht -----------------------------------------------------------------------------------------

export type LedgerSummary = { year: number; incomeRappen: number; expenseRappen: number; resultRappen: number; assetEndRappen: number; unbookedPayments: number; hasAccounts: boolean };

/** Kennzahlen des laufenden Geschäftsjahres (für das Dashboard; Aufrufer prüft das Leserecht auf «ledger»). */
export async function getLedgerSummary(): Promise<LedgerSummary> {
  const fiscal = await getFiscalStart();
  const year = fiscalYearOf(todayZurich(), fiscal);
  const [accounts, entries, pending] = await Promise.all([loadAccounts(), loadEntriesUpTo(year), unbookedPaymentCount(fiscalYearRange(year, fiscal))]);
  const s = buildAnnualStatement(accounts, entries, year);
  return { year, incomeRappen: s.totalIncomeRappen, expenseRappen: s.totalExpenseRappen, resultRappen: s.resultRappen, assetEndRappen: s.assetEndRappen, unbookedPayments: pending, hasAccounts: accounts.length > 0 };
}
