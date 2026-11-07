import type { CSSProperties, ReactNode } from "react";
import type { Messages } from "@/i18n";
import type { beitraege } from "@/i18n/verein-beitraege";
import type { PaymentDetails } from "@/lib/verein/fees-bill";

type DetailsMessages = (typeof beitraege extends Messages<infer T> ? T : never)["paymentDetails"];

const FONT = "Arial, Helvetica, sans-serif";

const labelStyle: CSSProperties = { margin: 0, fontSize: "8pt", lineHeight: "11pt", fontWeight: 700 };
const valueStyle: CSSProperties = { margin: 0, fontSize: "10pt", lineHeight: "13pt", overflowWrap: "anywhere" };

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "40mm 1fr", columnGap: "4mm", padding: "1.2mm 0", breakInside: "avoid" }}>
      <dt style={labelStyle}>{label}</dt>
      <dd style={{ margin: 0 }}>{children}</dd>
    </div>
  );
}

/**
 * Einzahlungsangaben statt Schweizer QR-Zahlteil, wenn das Konto des Vereins eine ausländische IBAN hat (eine QR-Rechnung ist nur mit
 * CH/LI-IBAN zulässig). Im Stil des Zahlteils am Ende der Rechnung, ohne QR-Code: Zahlungsempfänger, IBAN, BIC, Bank, Währung und
 * Betrag, Zahlungsreferenz (Creditor Reference «RF…») und Frist. Texte aus den Nachrichten (i18n).
 */
export function PaymentDetailsBlock({ details, dueDate, m }: { details: PaymentDetails; dueDate: string; m: DetailsMessages }) {
  return (
    <section
      className="payment-details"
      aria-label={m.title}
      style={{ background: "#fff", color: "#000", fontFamily: FONT, boxSizing: "border-box", borderTop: "0.3mm dashed #000", padding: "6mm 20mm 12mm", WebkitPrintColorAdjust: "exact", printColorAdjust: "exact" }}
    >
      <h2 style={{ margin: 0, fontSize: "11pt", lineHeight: "14pt", fontWeight: 700 }}>{m.title}</h2>
      <dl style={{ margin: "3mm 0 0" }}>
        <Row label={m.payee}>
          {details.payeeLines.map((l, i) => (
            <p key={i} style={{ ...valueStyle, fontWeight: i === 0 ? 700 : 400 }}>
              {l}
            </p>
          ))}
        </Row>
        <Row label={m.iban}>
          <p style={{ ...valueStyle, fontWeight: 700, fontSize: "11pt", letterSpacing: "0.02em" }}>{details.iban}</p>
        </Row>
        {details.bic && (
          <Row label={m.bic}>
            <p style={valueStyle}>{details.bic}</p>
          </Row>
        )}
        {details.bank && (
          <Row label={m.bank}>
            <p style={valueStyle}>{details.bank}</p>
          </Row>
        )}
        <Row label={`${m.currency} / ${m.amount}`}>
          <p style={valueStyle}>
            {details.currency}
            {details.amount ? ` ${details.amount}` : ""}
          </p>
        </Row>
        <Row label={m.reference}>
          <p style={{ ...valueStyle, fontWeight: 700, fontSize: "11pt", letterSpacing: "0.02em" }}>{details.reference}</p>
          <p style={{ ...valueStyle, fontSize: "8pt", lineHeight: "10pt" }}>{m.referenceHint}</p>
        </Row>
        {details.message && (
          <Row label={m.message}>
            <p style={valueStyle}>{details.message}</p>
          </Row>
        )}
        <Row label={m.due}>
          <p style={valueStyle}>{dueDate}</p>
        </Row>
      </dl>
      <p style={{ margin: "3mm 0 0", fontSize: "8pt", lineHeight: "10pt" }}>{m.foreignNote(details.ibanCountry)}</p>
    </section>
  );
}
