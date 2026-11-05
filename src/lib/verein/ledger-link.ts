// Schnittstelle Zahlungseingang → Kassa (Buchung). Besitzer: Beiträge. Das Kassa-Modul darf die Innenleben ersetzen, solange die
// Signaturen dieser Datei erhalten bleiben (siehe Abschlussbericht).
//
// Regeln:
//  - Jede Zahlung wird, wenn Konten bekannt sind, in derselben Datenbank-Transaktion als Einnahme gebucht (source «ZAHLUNG», paymentId).
//  - Die Belegnummer vergibt nextVoucherNumber innerhalb dieser Transaktion (lückenlos).
//  - Liegt das Datum in einem abgeschlossenen Geschäftsjahr (FiscalYear.lockedAt), wird die Zahlung abgelehnt (409).
//  - Der Verein hat keine vorgegebenen Konten. Fehlt die Kontenwahl, wird die Zahlung trotzdem erfasst und als «noch nicht gebucht»
//    gemeldet; sie kann später über bookExistingPayment nachgebucht werden. Es wird nie ein Konto geraten.
import "server-only";
import type { Prisma } from "@prisma/client";
import { ApiError } from "@/lib/api";
import { db } from "@/lib/db";
import { fiscalYearOf, type FiscalStart } from "./dates";
import { nextVoucherNumber } from "./ids";

export type LedgerClient = Prisma.TransactionClient;

export type BookingOutcome =
  | { status: "BOOKED"; transactionId: string; voucherNo: string }
  | { status: "PENDING"; reason: string };

export type BookPaymentInput = {
  payment: { id: string; receivedAt: Date; amountRappen: number; reference: string };
  invoice: { number: string; subject: string; categoryIds: Array<string | null> } | null;
  /** Vermögenskonto (Bank, Kasse), auf das die Zahlung eingegangen ist */
  assetAccountId: string | null;
  /** Ertragskonto; sonst das Konto der Rechnungsposition */
  incomeAccountId: string | null;
  fiscalStart: FiscalStart;
  actor: { id: string | null; name: string };
};

/** Wirft 409, wenn das Geschäftsjahr des Datums abgeschlossen ist. Gibt das Geschäftsjahr zurück. */
export async function assertFiscalYearOpen(client: LedgerClient, date: Date, fiscalStart: FiscalStart): Promise<number> {
  const year = fiscalYearOf(date, fiscalStart);
  const fy = await client.fiscalYear.findUnique({ where: { year }, select: { lockedAt: true } });
  if (fy?.lockedAt) {
    throw new ApiError(409, "FISCAL_YEAR_LOCKED", `Das Geschäftsjahr ${year} ist abgeschlossen. Mit diesem Datum kann nichts mehr gebucht oder geändert werden. Wähle ein Datum im offenen Geschäftsjahr oder korrigiere in der Kassa mit einer Gegenbuchung.`);
  }
  return year;
}

/** Bucht einen Zahlungseingang als Einnahme. Muss in der Transaktion der Zahlung aufgerufen werden. */
export async function bookPayment(tx: LedgerClient, input: BookPaymentInput): Promise<BookingOutcome> {
  const fiscalYear = await assertFiscalYearOpen(tx, input.payment.receivedAt, input.fiscalStart);
  const incomeId = input.incomeAccountId ?? input.invoice?.categoryIds.find((c): c is string => Boolean(c)) ?? null;
  if (!input.assetAccountId) return { status: "PENDING", reason: "Es wurde kein Konto gewählt, auf das die Zahlung eingegangen ist." };
  if (!incomeId) return { status: "PENDING", reason: "Es ist kein Ertragskonto bekannt (weder gewählt noch bei der Rechnungsposition hinterlegt)." };

  const [asset, income] = await Promise.all([
    tx.accountCategory.findUnique({ where: { id: input.assetAccountId }, select: { id: true, kind: true, active: true, name: true } }),
    tx.accountCategory.findUnique({ where: { id: incomeId }, select: { id: true, kind: true, active: true, name: true } }),
  ]);
  if (!asset || asset.kind !== "VERMOEGEN" || !asset.active) throw new ApiError(422, "VALIDATION_ERROR", "Das gewählte Konto ist kein aktives Vermögenskonto.", { assetAccountId: "Bitte ein aktives Vermögenskonto wählen." });
  if (!income || income.kind !== "EINNAHMEN" || !income.active) throw new ApiError(422, "VALIDATION_ERROR", "Das gewählte Ertragskonto ist kein aktives Einnahmenkonto.", { incomeAccountId: "Bitte ein aktives Einnahmenkonto wählen." });

  const voucher = await nextVoucherNumber(tx, fiscalYear);
  const text = input.invoice ? `Zahlung Rechnung ${input.invoice.number}${input.invoice.subject ? `, ${input.invoice.subject}` : ""}`.slice(0, 200) : "Zahlungseingang";
  const created = await tx.transaction.create({
    data: {
      bookingDate: input.payment.receivedAt,
      fiscalYear,
      voucherNo: voucher.number,
      direction: "EINNAHME",
      amountRappen: input.payment.amountRappen,
      categoryId: income.id,
      counterAccountId: asset.id,
      text,
      voucherRef: input.invoice?.number ?? input.payment.reference.slice(0, 100),
      source: "ZAHLUNG",
      paymentId: input.payment.id,
      createdById: input.actor.id,
      createdByName: input.actor.name,
    },
    select: { id: true, voucherNo: true },
  });
  return { status: "BOOKED", transactionId: created.id, voucherNo: created.voucherNo };
}

/**
 * Entfernt die Buchung einer Zahlung (beim Löschen der Zahlung). Abgeschlossene Geschäftsjahre bleiben unberührt: dort wird mit einer
 * Gegenbuchung in der Kassa korrigiert. Gibt true zurück, wenn eine Buchung entfernt wurde.
 */
export async function removePaymentBooking(tx: LedgerClient, paymentId: string): Promise<boolean> {
  const t = await tx.transaction.findUnique({ where: { paymentId }, select: { id: true, fiscalYear: true, reversedBy: { select: { id: true } } } });
  if (!t) return false;
  const fy = await tx.fiscalYear.findUnique({ where: { year: t.fiscalYear }, select: { lockedAt: true } });
  if (fy?.lockedAt) {
    throw new ApiError(409, "FISCAL_YEAR_LOCKED", `Die Buchung dieser Zahlung gehört zum abgeschlossenen Geschäftsjahr ${t.fiscalYear}. Korrigiere sie in der Kassa mit einer Gegenbuchung.`);
  }
  if (t.reversedBy) throw new ApiError(409, "CONFLICT", "Die Buchung dieser Zahlung wurde bereits mit einer Gegenbuchung korrigiert. Die Zahlung kann nicht gelöscht werden.");
  await tx.transaction.delete({ where: { id: t.id } });
  return true;
}

export type BookingAccountOption = { id: string; number: string; name: string };

/** Aktive Konten für die Auswahl im Zahlungsformular: Vermögenskonten (Eingang) und Einnahmenkonten (Ertrag). */
export async function listBookingAccounts(): Promise<{ assets: BookingAccountOption[]; incomes: BookingAccountOption[] }> {
  const rows = await db.accountCategory.findMany({
    where: { active: true, kind: { in: ["VERMOEGEN", "EINNAHMEN"] } },
    orderBy: [{ sortOrder: "asc" }, { number: "asc" }],
    select: { id: true, number: true, name: true, kind: true },
  });
  const pick = (kind: string) => rows.filter((r) => r.kind === kind).map(({ id, number, name }) => ({ id, number, name }));
  return { assets: pick("VERMOEGEN"), incomes: pick("EINNAHMEN") };
}
