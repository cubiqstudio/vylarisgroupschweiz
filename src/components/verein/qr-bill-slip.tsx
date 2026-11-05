import type { CSSProperties, ReactNode } from "react";
import { Scissors } from "lucide-react";
import type { Messages } from "@/i18n";
import type { beitraege } from "@/i18n/verein-beitraege";
import { QR_BILL_LAYOUT, type QrBillDisplay } from "@/lib/verein/qr-bill";
import { qrBillQrGeometry, SWISS_CROSS } from "@/lib/verein/qr-bill-svg";

type SlipMessages = (typeof beitraege extends Messages<infer T> ? T : never)["slip"];

const FONT = "Arial, Helvetica, sans-serif";
const L = QR_BILL_LAYOUT;
const mm = (n: number) => `${n}mm`;

const abs = (left: number, top: number, width?: number, height?: number, extra: CSSProperties = {}): CSSProperties => ({
  position: "absolute",
  left: mm(left),
  top: mm(top),
  ...(width !== undefined ? { width: mm(width) } : {}),
  ...(height !== undefined ? { height: mm(height) } : {}),
  ...extra,
});

function Heading({ children, pt, first = false }: { children: ReactNode; pt: number; first?: boolean }) {
  return <p style={{ margin: first ? 0 : `${pt * 0.9}pt 0 0`, fontSize: `${pt}pt`, lineHeight: `${pt + 3}pt`, fontWeight: 700 }}>{children}</p>;
}

function Lines({ lines, pt, lh }: { lines: readonly string[]; pt: number; lh: number }) {
  return (
    <>
      {lines.map((l, i) => (
        <p key={i} style={{ margin: 0, fontSize: `${pt}pt`, lineHeight: `${lh}pt`, overflowWrap: "anywhere" }}>
          {l}
        </p>
      ))}
    </>
  );
}

/** Rahmen mit Eckmarken für Felder, die von Hand ausgefüllt werden (offener Betrag, Zahlbar durch). */
function CornerBox({ left, top, width, height }: { left?: number; top?: number; width: number; height: number }) {
  const arm = 3;
  const line = "0.2mm solid #000";
  const corner = (style: CSSProperties): CSSProperties => ({ position: "absolute", width: mm(arm), height: mm(arm), ...style });
  return (
    <div aria-hidden style={left === undefined || top === undefined ? { position: "relative", width: mm(width), height: mm(height), marginTop: "1.5mm" } : abs(left, top, width, height)}>
      <span style={corner({ left: 0, top: 0, borderLeft: line, borderTop: line })} />
      <span style={corner({ right: 0, top: 0, borderRight: line, borderTop: line })} />
      <span style={corner({ left: 0, bottom: 0, borderLeft: line, borderBottom: line })} />
      <span style={corner({ right: 0, bottom: 0, borderRight: line, borderBottom: line })} />
    </div>
  );
}

/**
 * Zahlteil der Schweizer QR-Rechnung (Empfangsschein 62 mm + Zahlteil 148 mm = 210 × 105 mm) mit Schweizer Kreuz und Trennlinie.
 * Alle Masse in Millimetern, Schriftgrössen 6 bis 11 Punkt (Arial/Helvetica) nach den Vorgaben der Implementation Guidelines.
 * Die Texte kommen aus den Nachrichten (i18n); der QR-Code entsteht nur aus dem geprüften Inhalt.
 */
export function QrBillSlip({ display, payload, m }: { display: QrBillDisplay; payload: string; m: SlipMessages }) {
  const g = qrBillQrGeometry(payload);
  const f = L.fonts;
  const px = L.receiptWidthMm; // Beginn des Zahlteils
  const cross = g.cross;

  return (
    <div
      className="qr-bill-slip"
      style={{ position: "relative", width: mm(L.widthMm), height: mm(L.heightMm), background: "#fff", color: "#000", fontFamily: FONT, boxSizing: "border-box", borderTop: "0.3mm dashed #000", WebkitPrintColorAdjust: "exact", printColorAdjust: "exact" }}
    >
      {/* Trennlinien */}
      <span aria-hidden style={abs(px, 0, 0, L.heightMm, { borderLeft: "0.3mm dashed #000" })} />
      <p style={abs(0, -4.6, undefined, undefined, { margin: 0, width: mm(L.widthMm), textAlign: "center", fontSize: "6pt", lineHeight: "8pt" })}>
        <Scissors aria-hidden width={9} height={9} style={{ display: "inline", verticalAlign: "middle", marginRight: 3 }} />
        {m.tearOff}
      </p>

      {/* Empfangsschein */}
      <section aria-label={m.receipt} style={abs(0, 0, px, L.heightMm)}>
        <p style={abs(L.marginMm, 5, 52, 7, { margin: 0, fontSize: `${f.titlePt}pt`, lineHeight: "14pt", fontWeight: 700 })}>{m.receipt}</p>
        <div style={abs(L.marginMm, 12, 52, 56)}>
          <Heading pt={f.receiptHeadingPt} first>
            {m.account}
          </Heading>
          <Lines lines={[display.account, ...display.creditorLines]} pt={f.receiptValuePt} lh={9} />
          {display.reference && (
            <>
              <Heading pt={f.receiptHeadingPt}>{m.reference}</Heading>
              <Lines lines={[display.reference]} pt={f.receiptValuePt} lh={9} />
            </>
          )}
          <Heading pt={f.receiptHeadingPt}>{display.debtorLines ? m.payableBy : m.payableByName}</Heading>
          {display.debtorLines ? <Lines lines={display.debtorLines} pt={f.receiptValuePt} lh={9} /> : <CornerBox width={52} height={20} />}
        </div>
        <div style={abs(L.marginMm, 68, 14, 14)}>
          <Heading pt={f.receiptHeadingPt} first>
            {m.currency}
          </Heading>
          <Lines lines={[display.currency]} pt={f.receiptValuePt} lh={11} />
        </div>
        <div style={abs(L.marginMm + 14, 68, 38, 14)}>
          <Heading pt={f.receiptHeadingPt} first>
            {m.amount}
          </Heading>
          {display.amount && <Lines lines={[display.amount]} pt={f.receiptValuePt} lh={11} />}
        </div>
        {!display.amount && <CornerBox left={L.marginMm + 14} top={71.5} width={30} height={10} />}
        <p style={abs(L.marginMm, 82, 52, 18, { margin: 0, textAlign: "right", fontSize: `${f.receiptHeadingPt}pt`, lineHeight: "9pt", fontWeight: 700 })}>{m.acceptance}</p>
      </section>

      {/* Zahlteil */}
      <section aria-label={m.paymentPart} style={abs(px, 0, L.paymentPartWidthMm, L.heightMm)}>
        <p style={abs(L.marginMm, 5, 51, 7, { margin: 0, fontSize: `${f.titlePt}pt`, lineHeight: "14pt", fontWeight: 700 })}>{m.paymentPart}</p>
        <div role="img" aria-label={m.qrLabel} style={abs(L.marginMm, 17, L.qrSizeMm, L.qrSizeMm)}>
          <svg xmlns="http://www.w3.org/2000/svg" width={mm(L.qrSizeMm)} height={mm(L.qrSizeMm)} viewBox={`0 0 ${g.modules} ${g.modules}`} shapeRendering="crispEdges" style={{ display: "block" }}>
            <rect width={g.modules} height={g.modules} fill="#fff" />
            <path d={g.pathD} fill="#000" />
            <g transform={`translate(${cross.x} ${cross.y}) scale(${cross.scale})`}>
              <rect width={SWISS_CROSS.box} height={SWISS_CROSS.box} fill="#fff" />
              <rect x={SWISS_CROSS.black.x} y={SWISS_CROSS.black.y} width={SWISS_CROSS.black.size} height={SWISS_CROSS.black.size} fill="#000" />
              <rect x={SWISS_CROSS.vertical.x} y={SWISS_CROSS.vertical.y} width={SWISS_CROSS.vertical.w} height={SWISS_CROSS.vertical.h} fill="#fff" />
              <rect x={SWISS_CROSS.horizontal.x} y={SWISS_CROSS.horizontal.y} width={SWISS_CROSS.horizontal.w} height={SWISS_CROSS.horizontal.h} fill="#fff" />
            </g>
          </svg>
        </div>
        <div style={abs(L.marginMm, 68, 14, 22)}>
          <Heading pt={f.paymentHeadingPt} first>
            {m.currency}
          </Heading>
          <Lines lines={[display.currency]} pt={f.paymentValuePt} lh={12} />
        </div>
        <div style={abs(L.marginMm + 14, 68, 37, 22)}>
          <Heading pt={f.paymentHeadingPt} first>
            {m.amount}
          </Heading>
          {display.amount && <Lines lines={[display.amount]} pt={f.paymentValuePt} lh={12} />}
        </div>
        {!display.amount && <CornerBox left={L.marginMm + 14} top={72} width={40} height={15} />}

        <div style={abs(L.marginMm + L.qrSizeMm + 5, 5, 87, 85)}>
          <Heading pt={f.paymentHeadingPt} first>
            {m.account}
          </Heading>
          <Lines lines={[display.account, ...display.creditorLines]} pt={f.paymentValuePt} lh={11} />
          {display.reference && (
            <>
              <Heading pt={f.paymentHeadingPt}>{m.reference}</Heading>
              <Lines lines={[display.reference]} pt={f.paymentValuePt} lh={11} />
            </>
          )}
          {(display.message || display.billInformation) && (
            <>
              <Heading pt={f.paymentHeadingPt}>{m.additional}</Heading>
              <Lines lines={[display.message, display.billInformation].filter(Boolean)} pt={f.paymentValuePt} lh={11} />
            </>
          )}
          <Heading pt={f.paymentHeadingPt}>{display.debtorLines ? m.payableBy : m.payableByName}</Heading>
          {display.debtorLines ? <Lines lines={display.debtorLines} pt={f.paymentValuePt} lh={11} /> : <CornerBox width={65} height={25} />}
        </div>
      </section>
    </div>
  );
}
