import type { Messages } from "@/i18n";
import type { beitraege } from "@/i18n/verein-beitraege";
import { PaymentDetailsBlock } from "@/components/verein/payment-details-block";
import { QrBillSlip } from "@/components/verein/qr-bill-slip";
import { formatDateCh } from "@/lib/verein/dates";
import { balanceOf } from "@/lib/verein/fees-calc";
import type { InvoiceBill } from "@/lib/verein/fees-bill";
import { formatChf } from "@/lib/verein/money";

type Msgs = typeof beitraege extends Messages<infer T> ? T : never;

export type DocumentInvoice = {
  number: string;
  subject: string;
  status: string;
  issueDate: Date;
  dueDate: Date;
  totalRappen: number;
  paidRappen: number;
  paidAt: Date | null;
  cancelledAt: Date | null;
  reminderLevel: number;
  recipientName: string;
  recipientAddress: string;
  member: { memberNumber: number };
  items: Array<{ id: string; description: string; quantity: number; unitRappen: number; totalRappen: number }>;
  /** Frist der zuletzt versandten Mahnung */
  lastReminderDueDate: Date | null;
};

const FONT = "Arial, Helvetica, sans-serif";
// Hinweis: keine Zeichen "<", ">", "&" und keine Anführungszeichen im CSS (React würde sie im style-Element maskieren).
const PRINT_CSS = `
@page { size: A4; margin: 0; }
.invoice-sheet { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
@media print {
  html, body { background: #fff !important; }
  body *:not(:has(.invoice-sheet)):not(.invoice-sheet):not(.invoice-sheet *) { display: none !important; }
  .invoice-wrap { position: static !important; overflow: visible !important; padding: 0 !important; }
  .invoice-sheet { position: absolute !important; left: 0 !important; top: 0 !important; margin: 0 !important; box-shadow: none !important; min-height: 296mm !important; }
}
`;

/**
 * Rechnung im A4-Format mit dem Zahlteil der QR-Rechnung am unteren Rand (Schweizer Konto) oder dem Block «Einzahlungsangaben» (ausländische
 * IBAN, ohne QR-Code). Wird im Admin, im Portal und auf der Seite mit dem Mail-Link verwendet. Zum Drucken oder «Als PDF speichern» genügt der
 * Druckdialog des Browsers. Sind die Zahlungsangaben nicht möglich (fehlende Angaben), steht eine klare Meldung statt einer ungültigen QR-Rechnung.
 * Bezahlte und stornierte Rechnungen zeigen keine Zahlungsangaben.
 */
export function InvoiceDocument({
  inv,
  bill,
  sender,
  m,
  showBillProblems = false,
}: {
  inv: DocumentInvoice;
  bill: InvoiceBill | null;
  sender: { name: string; lines: string[] };
  m: Msgs;
  /** Fehlende Angaben im Detail zeigen (nur für die Verwaltung) */
  showBillProblems?: boolean;
}) {
  const d = m.document;
  const { openRappen } = balanceOf(inv);
  const reminder =
    inv.status === "OFFEN" && inv.reminderLevel > 0 && inv.lastReminderDueDate
      ? inv.reminderLevel === 1
        ? d.reminderFirst(formatDateCh(inv.lastReminderDueDate))
        : d.reminder(inv.reminderLevel, formatDateCh(inv.lastReminderDueDate))
      : null;
  const addressLines = inv.recipientAddress.split("\n").filter(Boolean);
  const payable = inv.status === "OFFEN" || inv.status === "ENTWURF";

  return (
    <div className="invoice-wrap overflow-x-auto pb-6">
      <style>{PRINT_CSS}</style>
      <article
        className="invoice-sheet mx-auto shadow-lg"
        aria-label={`${d.title} ${inv.number}`}
        style={{ width: "210mm", minHeight: "297mm", background: "#fff", color: "#000", fontFamily: FONT, boxSizing: "border-box", display: "flex", flexDirection: "column", position: "relative" }}
      >
        <div style={{ padding: "18mm 20mm 6mm", flex: "1 0 auto" }}>
          {inv.status === "ENTWURF" && (
            <p style={{ position: "absolute", right: "20mm", top: "10mm", margin: 0, fontSize: "11pt", fontWeight: 700, color: "#b45309", border: "0.4mm solid #b45309", padding: "1mm 3mm" }}>{d.draft}</p>
          )}
          <header style={{ fontSize: "9pt", lineHeight: "12pt" }}>
            <p style={{ margin: 0, fontSize: "11pt", fontWeight: 700 }}>{sender.name}</p>
            {sender.lines.map((l) => (
              <p key={l} style={{ margin: 0 }}>
                {l}
              </p>
            ))}
          </header>

          <div style={{ marginLeft: "98mm", marginTop: "14mm", fontSize: "10pt", lineHeight: "13pt", minHeight: "24mm" }}>
            <p style={{ margin: 0, fontWeight: 700 }}>{inv.recipientName}</p>
            {addressLines.map((l) => (
              <p key={l} style={{ margin: 0 }}>
                {l}
              </p>
            ))}
          </div>

          <h1 style={{ margin: "10mm 0 0", fontSize: "14pt", fontWeight: 700 }}>
            {d.title} {inv.number}
          </h1>
          {inv.subject && <p style={{ margin: "1mm 0 0", fontSize: "10pt" }}>{inv.subject}</p>}
          <dl style={{ margin: "4mm 0 0", display: "grid", gridTemplateColumns: "auto 1fr", columnGap: "6mm", rowGap: "0.5mm", fontSize: "9pt", maxWidth: "90mm" }}>
            <dt>{d.date}</dt>
            <dd style={{ margin: 0 }}>{formatDateCh(inv.issueDate)}</dd>
            <dt>{d.due}</dt>
            <dd style={{ margin: 0 }}>{formatDateCh(inv.dueDate)}</dd>
            <dt>{d.member}</dt>
            <dd style={{ margin: 0 }}>{inv.member.memberNumber}</dd>
          </dl>

          {reminder && <p style={{ margin: "5mm 0 0", fontSize: "10pt", fontWeight: 700 }}>{reminder}</p>}

          <table style={{ width: "100%", marginTop: "7mm", borderCollapse: "collapse", fontSize: "9.5pt" }}>
            <thead>
              <tr style={{ borderBottom: "0.3mm solid #000", textAlign: "left" }}>
                <th style={{ padding: "1mm 0", fontWeight: 700 }}>{d.position}</th>
                <th style={{ padding: "1mm 2mm", fontWeight: 700, textAlign: "right" }}>{d.quantity}</th>
                <th style={{ padding: "1mm 2mm", fontWeight: 700, textAlign: "right" }}>{d.unit}</th>
                <th style={{ padding: "1mm 0", fontWeight: 700, textAlign: "right" }}>{d.amount}</th>
              </tr>
            </thead>
            <tbody>
              {inv.items.map((i) => (
                <tr key={i.id} style={{ borderBottom: "0.1mm solid #bbb", verticalAlign: "top" }}>
                  <td style={{ padding: "1.5mm 0" }}>{i.description}</td>
                  <td style={{ padding: "1.5mm 2mm", textAlign: "right" }}>{i.quantity}</td>
                  <td style={{ padding: "1.5mm 2mm", textAlign: "right", whiteSpace: "nowrap" }}>{formatChf(i.unitRappen)}</td>
                  <td style={{ padding: "1.5mm 0", textAlign: "right", whiteSpace: "nowrap" }}>{formatChf(i.totalRappen)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={3} style={{ padding: "2mm 2mm 0 0", textAlign: "right", fontWeight: 700 }}>
                  {d.total}
                </td>
                <td style={{ padding: "2mm 0 0", textAlign: "right", fontWeight: 700, whiteSpace: "nowrap" }}>{formatChf(inv.totalRappen)}</td>
              </tr>
              {inv.paidRappen > 0 && inv.status !== "STORNIERT" && (
                <>
                  <tr>
                    <td colSpan={3} style={{ padding: "1mm 2mm 0 0", textAlign: "right" }}>
                      {d.paid}
                    </td>
                    <td style={{ padding: "1mm 0 0", textAlign: "right", whiteSpace: "nowrap" }}>-{formatChf(inv.paidRappen)}</td>
                  </tr>
                  <tr>
                    <td colSpan={3} style={{ padding: "1mm 2mm 0 0", textAlign: "right", fontWeight: 700 }}>
                      {d.openAmount}
                    </td>
                    <td style={{ padding: "1mm 0 0", textAlign: "right", fontWeight: 700, whiteSpace: "nowrap" }}>{formatChf(openRappen)}</td>
                  </tr>
                </>
              )}
            </tfoot>
          </table>

          {inv.status === "BEZAHLT" && <p style={{ margin: "7mm 0 0", fontSize: "10pt", fontWeight: 700 }}>{d.paidOn(inv.paidAt ? formatDateCh(inv.paidAt) : "")}</p>}
          {inv.status === "STORNIERT" && <p style={{ margin: "7mm 0 0", fontSize: "10pt", fontWeight: 700 }}>{d.cancelledOn(inv.cancelledAt ? formatDateCh(inv.cancelledAt) : "")}</p>}
          {payable && <p style={{ margin: "7mm 0 0", fontSize: "9.5pt" }}>{d.thanks}</p>}
        </div>

        {payable && bill?.ok && bill.mode === "QR_BILL" && (
          <div style={{ flex: "0 0 auto", marginTop: "auto", breakInside: "avoid", pageBreakInside: "avoid", paddingTop: "5mm" }}>
            <QrBillSlip display={bill.display} payload={bill.payload} m={m.slip} />
          </div>
        )}
        {payable && bill?.ok && bill.mode === "DETAILS" && (
          <div style={{ flex: "0 0 auto", marginTop: "auto", breakInside: "avoid", pageBreakInside: "avoid", paddingTop: "5mm" }}>
            <PaymentDetailsBlock details={bill.details} dueDate={formatDateCh(inv.dueDate)} m={m.paymentDetails} />
          </div>
        )}
        {payable && bill && !bill.ok && (
          <div style={{ padding: "0 20mm 15mm", fontSize: "10pt" }} role="alert">
            <p style={{ margin: 0, fontWeight: 700 }}>{bill.mode === "DETAILS" ? d.detailsUnavailable : d.billUnavailable}</p>
            <p style={{ margin: "1mm 0 0" }}>{bill.mode === "DETAILS" ? d.detailsUnavailableHint : d.billUnavailableHint}</p>
            {showBillProblems && (
              <ul style={{ margin: "2mm 0 0", paddingLeft: "5mm" }}>
                {bill.problems.map((p) => (
                  <li key={p}>{p}</li>
                ))}
              </ul>
            )}
          </div>
        )}
      </article>
    </div>
  );
}
