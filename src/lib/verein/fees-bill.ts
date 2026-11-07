// Zahlungsangaben einer Vereinsrechnung zusammenstellen (rein): aus Vereinseinstellungen, Anschrift des Vereins und Rechnung entsteht
//  - bei einem Schweizer Konto (IBAN oder QR-IBAN aus CH/LI) die Eingabe für die QR-Rechnung, ihr Inhalt und die Darstellungstexte,
//  - bei einer ausländischen IBAN die «Einzahlungsangaben» (IBAN, BIC, Bank, Zahlungsreferenz) als Text. Eine Schweizer QR-Rechnung
//    ist mit einer ausländischen IBAN nach den Swiss Payment Standards nicht zulässig und wird nie erzeugt.
// Fehlt etwas, gibt es eine klare Liste statt einer ungültigen Rechnung.
import { billModeOf, chooseBillAccount, type BillMode } from "./fees-calc";
import { formatIban, ibanCountryOf, isValidBic, isValidCreditorReference, isValidIban, normalizeBic } from "./iban";
import { formatChf, openAmount } from "./money";
import {
  addressDisplayLines,
  buildQrBillPayload,
  describeQrBill,
  parseAddressBlock,
  splitStreet,
  splitZipTown,
  toQrBillText,
  validateQrBill,
  QR_BILL_LIMITS,
  type QrBillAddress,
  type QrBillDisplay,
  type QrBillInput,
} from "./qr-bill";

export type { BillMode } from "./fees-calc";

export type BillContext = {
  accountHolder: string;
  iban: string;
  qrIban: string;
  /** BIC/SWIFT des Hauptkontos (optional) */
  bic?: string;
  /** Bank (optional, nur zur Anzeige in den Einzahlungsangaben) */
  bank?: string;
  /** Zahlungsempfänger, falls abweichend vom Kontoinhaber (optional) */
  payeeName?: string;
  /** Anschrift des Vereins (Einstellungen → Rechtliches) */
  legal: { street: string; zipCity: string; country: string };
};

export type BillInvoice = {
  number: string;
  year: number;
  seq: number;
  totalRappen: number;
  paidRappen: number;
  paymentReference: string;
  recipientName: string;
  recipientAddress: string;
};

/** Einzahlungsangaben bei ausländischer IBAN: alles, was die Zahlenden für die Überweisung brauchen. */
export type PaymentDetails = {
  /** Zahlungsempfänger: Name, Strasse, PLZ Ort */
  payeeLines: string[];
  /** IBAN in Vierergruppen */
  iban: string;
  /** Länderkürzel der IBAN («IE») */
  ibanCountry: string;
  bic: string | null;
  bank: string | null;
  currency: "CHF";
  /** «40.00» oder null (offener Betrag) */
  amount: string | null;
  /** Creditor Reference (RF…) in Vierergruppen: «RF18 5390 0754 7034» */
  reference: string;
  /** Zahlungszweck: «Rechnung 2026-0001» */
  message: string;
};

export type InvoiceBill =
  | { ok: true; mode: "QR_BILL"; input: QrBillInput; payload: string; display: QrBillDisplay }
  | { ok: true; mode: "DETAILS"; details: PaymentDetails }
  | { ok: false; mode: BillMode; problems: string[] };

/** Meldung, wenn die Zahlungsangaben der Rechnung nicht erstellt werden können (ohne Doppelpunkt). */
export const billUnavailableMessage = (mode: BillMode): string =>
  mode === "DETAILS" ? "Die Einzahlungsangaben können noch nicht erstellt werden" : "Die QR-Rechnung kann noch nicht erstellt werden";

/** Referenz der Rechnung in der Darstellung des Zahlteils bzw. der Einzahlungsangaben (null, wenn es keine gibt). */
export function billReferenceOf(bill: InvoiceBill): string | null {
  if (!bill.ok) return null;
  return bill.mode === "QR_BILL" ? bill.display.reference : bill.details.reference;
}

/** Ländercode aus der Angabe in den Rechtlichen Einstellungen («Schweiz» → CH); leer/unbekannt → Vorgabe. */
export function countryCodeOf(name: string, fallback: string): string {
  const n = name.trim().toLowerCase();
  if (/^[a-z]{2}$/.test(n)) return n.toUpperCase();
  if (["schweiz", "suisse", "svizzera", "switzerland", "svizra"].includes(n)) return "CH";
  if (n === "liechtenstein") return "LI";
  return fallback;
}

/** Name des Zahlungsempfängers: der abweichende Zahlungsempfänger, sonst der Kontoinhaber. */
export function payeeNameOf(ctx: Pick<BillContext, "accountHolder" | "payeeName">): string {
  return (ctx.payeeName ?? "").trim() || ctx.accountHolder.trim();
}

/**
 * Anschrift des Vereins als strukturierte Adresse oder Fehlermeldungen. Das Land ist das der Anschrift (Einstellungen → Rechtliches,
 * ohne Angabe die Schweiz) und hängt nie vom Land der IBAN ab: Das Konto kann im Ausland liegen, der Verein bleibt in der Schweiz.
 */
export function creditorFrom(ctx: BillContext): { address: QrBillAddress | null; problems: string[] } {
  const problems: string[] = [];
  const name = toQrBillText(payeeNameOf(ctx), QR_BILL_LIMITS.name);
  if (!name) problems.push("Der Kontoinhaber fehlt (Vereinseinstellungen → Finanzen).");
  const zt = splitZipTown(ctx.legal.zipCity);
  if (!zt) problems.push("Die Anschrift des Vereins (PLZ und Ort) fehlt oder ist nicht lesbar. Trage sie unter Einstellungen → Rechtliches ein, z. B. «9000 Musterort».");
  if (!name || !zt) return { address: null, problems };
  const st = ctx.legal.street.trim() ? splitStreet(ctx.legal.street) : { street: "", houseNo: "" };
  return {
    address: {
      name,
      street: toQrBillText(st.street, QR_BILL_LIMITS.street),
      houseNo: toQrBillText(st.houseNo, QR_BILL_LIMITS.houseNo),
      zip: toQrBillText(zt.zip, QR_BILL_LIMITS.zip),
      town: toQrBillText(zt.town, QR_BILL_LIMITS.town),
      country: countryCodeOf(ctx.legal.country, "CH"),
    },
    problems,
  };
}

/** Einzahlungsangaben aus Konto, Anschrift und Betrag (bei ausländischer IBAN). Prüft IBAN und Referenz. */
function composePaymentDetails(ctx: BillContext, inv: BillInvoice, account: string, reference: string, creditor: QrBillAddress, amount: number | null): { details: PaymentDetails } | { problems: string[] } {
  const problems: string[] = [];
  if (!isValidIban(account)) problems.push("Die IBAN ist ungültig (Länge oder Prüfziffern). Bitte unter Vereinseinstellungen → Finanzen prüfen.");
  if (!isValidCreditorReference(reference)) problems.push("Die Zahlungsreferenz (Creditor Reference, RF…) ist ungültig.");
  if (problems.length > 0) return { problems };
  // Der Name wird nicht auf den QR-Zeichensatz gekürzt: In den Einzahlungsangaben steht er, wie ihn der Verein eingetragen hat.
  const payeeLines = addressDisplayLines({ ...creditor, name: payeeNameOf(ctx) });
  const bic = ctx.bic && isValidBic(ctx.bic) ? normalizeBic(ctx.bic) : null;
  const bank = (ctx.bank ?? "").trim() || null;
  return {
    details: {
      payeeLines,
      iban: formatIban(account),
      ibanCountry: ibanCountryOf(account),
      bic,
      bank,
      currency: "CHF",
      amount: amount === null ? null : formatChf(amount),
      reference: reference.replace(/(.{4})/g, "$1 ").trim(),
      message: toQrBillText(`Rechnung ${inv.number}`, 140),
    },
  };
}

/**
 * Stellt die Zahlungsangaben für den noch offenen Betrag einer Rechnung zusammen: QR-Rechnung bei Schweizer Konto, Einzahlungsangaben bei
 * ausländischer IBAN. `amountOverrideRappen` ist für Ausnahmen gedacht (z. B. Anzeige des vollen Betrags); Standard ist der offene Betrag.
 */
export function composeInvoiceBill(ctx: BillContext, inv: BillInvoice, amountOverrideRappen?: number | null): InvoiceBill {
  const problems: string[] = [];
  const account = chooseBillAccount(ctx, inv);
  const mode: BillMode = account?.mode ?? billModeOf(ctx) ?? "QR_BILL";
  if (!account) problems.push("Es ist weder eine IBAN noch eine QR-IBAN hinterlegt (Vereinseinstellungen → Finanzen).");
  const { address: creditor, problems: creditorProblems } = creditorFrom(ctx);
  problems.push(...creditorProblems);
  const amount = amountOverrideRappen === undefined ? openAmount(inv.totalRappen, inv.paidRappen) : amountOverrideRappen;
  if (amount !== null && amount <= 0) problems.push("Es ist kein Betrag offen.");
  if (!account || !creditor || problems.length > 0) return { ok: false, mode, problems };

  if (account.mode === "DETAILS") {
    const res = composePaymentDetails(ctx, inv, account.account, account.reference, creditor, amount);
    return "problems" in res ? { ok: false, mode, problems: res.problems } : { ok: true, mode: "DETAILS", details: res.details };
  }

  const debtor = parseAddressBlock(inv.recipientName, inv.recipientAddress);
  const input: QrBillInput = {
    account: account.account,
    creditor,
    amountRappen: amount,
    currency: "CHF",
    debtor,
    referenceType: account.referenceType,
    reference: account.reference,
    message: toQrBillText(`Rechnung ${inv.number}`, 140),
  };
  const issues = validateQrBill(input);
  if (issues.length > 0) return { ok: false, mode, problems: issues.map((i) => i.message) };
  return { ok: true, mode: "QR_BILL", input, payload: buildQrBillPayload(input), display: describeQrBill(input) };
}
