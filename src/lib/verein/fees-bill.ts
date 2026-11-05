// QR-Rechnung einer Vereinsrechnung zusammenstellen (rein): aus Vereinseinstellungen, Anschrift des Vereins und Rechnung entsteht
// die Eingabe für die QR-Rechnung, ihr Inhalt und die Darstellungstexte. Fehlt etwas, gibt es eine klare Liste statt einer ungültigen QR-Rechnung.
import { chooseBillAccount } from "./fees-calc";
import { openAmount } from "./money";
import {
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

export type BillContext = {
  accountHolder: string;
  iban: string;
  qrIban: string;
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

export type InvoiceBill = { ok: true; input: QrBillInput; payload: string; display: QrBillDisplay } | { ok: false; problems: string[] };

/** Ländercode aus der Angabe in den Rechtlichen Einstellungen («Schweiz» → CH); leer/unbekannt → Vorgabe. */
export function countryCodeOf(name: string, fallback: string): string {
  const n = name.trim().toLowerCase();
  if (/^[a-z]{2}$/.test(n)) return n.toUpperCase();
  if (["schweiz", "suisse", "svizzera", "switzerland", "svizra"].includes(n)) return "CH";
  if (n === "liechtenstein") return "LI";
  return fallback;
}

/** Anschrift des Vereins als strukturierte Adresse oder Fehlermeldungen. */
export function creditorFrom(ctx: BillContext, ibanCountry: string): { address: QrBillAddress | null; problems: string[] } {
  const problems: string[] = [];
  const name = toQrBillText(ctx.accountHolder, QR_BILL_LIMITS.name);
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
      country: countryCodeOf(ctx.legal.country, ibanCountry),
    },
    problems,
  };
}

/**
 * Stellt die QR-Rechnung für den noch offenen Betrag einer Rechnung zusammen.
 * `amountOverrideRappen` ist für Ausnahmen gedacht (z. B. Anzeige des vollen Betrags); Standard ist der offene Betrag.
 */
export function composeInvoiceBill(ctx: BillContext, inv: BillInvoice, amountOverrideRappen?: number | null): InvoiceBill {
  const problems: string[] = [];
  const account = chooseBillAccount(ctx, inv);
  if (!account) problems.push("Es ist weder eine IBAN noch eine QR-IBAN hinterlegt (Vereinseinstellungen → Finanzen).");
  const { address: creditor, problems: creditorProblems } = creditorFrom(ctx, account ? account.account.slice(0, 2) : "CH");
  problems.push(...creditorProblems);
  const amount = amountOverrideRappen === undefined ? openAmount(inv.totalRappen, inv.paidRappen) : amountOverrideRappen;
  if (amount !== null && amount <= 0) problems.push("Es ist kein Betrag offen.");
  if (!account || !creditor || problems.length > 0) return { ok: false, problems };

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
  if (issues.length > 0) return { ok: false, problems: issues.map((i) => i.message) };
  return { ok: true, input, payload: buildQrBillPayload(input), display: describeQrBill(input) };
}
