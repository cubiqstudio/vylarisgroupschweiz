// QR-Code der QR-Rechnung als Vektorgrafik. Reine Funktionen (kein Seiteneffekt): Inhalt rein, Geometrie bzw. SVG-Text raus.
//  - Bibliothek «qrcode» (MIT), Fehlerkorrektur M, UTF-8 (Byte-Modus), höchstens QR-Version 25.
//  - Der QR-Code ist 46 × 46 mm gross (ohne Ruhezone; die 5 mm Rand liegen im Layout des Zahlteils).
//  - In der Mitte sitzt das Schweizer Kreuz, 7 × 7 mm (schwarzes Quadrat mit weissem Kreuz und weissem Rand).
import QRCode from "qrcode";
import { QR_BILL_LAYOUT, QR_BILL_MAX_VERSION, QrBillError } from "./qr-bill";

/** Die Zeichnung des Schweizer Kreuzes in einer Box von 19.8 × 19.8 Einheiten (Mass der offiziellen Vorlage). */
const CROSS_BOX = 19.8;
const CROSS_BLACK = { x: 0.7, y: 0.7, size: 18.4 };
const CROSS_V = { x: 8.3, y: 4, w: 3.3, h: 11 };
const CROSS_H = { x: 4.4, y: 7.9, w: 11, h: 3.3 };

export type QrBillQrGeometry = {
  /** Anzahl Module je Seite (z. B. 97) */
  modules: number;
  version: number;
  /** Anzahl Datensegmente im QR-Code (immer 1: ein UTF-8-Byte-Segment) */
  segments: number;
  /** SVG-Pfad aller dunklen Module in Moduleinheiten (viewBox 0 0 modules modules) */
  pathD: string;
  /** Schweizer Kreuz: Position und Grösse in Moduleinheiten sowie Skalierung der 19.8er Zeichenbox */
  cross: { x: number; y: number; size: number; scale: number };
};

/** Berechnet die Geometrie des QR-Codes. Wirft QrBillError, wenn der Inhalt nicht in Version 25 passt. */
export function qrBillQrGeometry(payload: string): QrBillQrGeometry {
  // Ein einziges Byte-Segment (UTF-8) wie in den Referenzimplementierungen; ohne Vorgabe würde die Bibliothek Byte-/Zahlen-Segmente mischen.
  const qr = QRCode.create([{ data: new TextEncoder().encode(payload), mode: "byte" }], { errorCorrectionLevel: "M" });
  if (qr.version > QR_BILL_MAX_VERSION) {
    throw new QrBillError([{ field: "payload", message: "Der QR-Code-Inhalt ist zu lang für die QR-Rechnung (höchstens QR-Version 25)." }]);
  }
  const size = qr.modules.size;
  const data = qr.modules.data;
  let d = "";
  for (let y = 0; y < size; y++) {
    let x = 0;
    while (x < size) {
      if (!data[y * size + x]) {
        x++;
        continue;
      }
      let run = 1;
      while (x + run < size && data[y * size + x + run]) run++;
      d += `M${x} ${y}h${run}v1h-${run}z`;
      x += run;
    }
  }
  const crossSize = (QR_BILL_LAYOUT.crossSizeMm * size) / QR_BILL_LAYOUT.qrSizeMm;
  const crossPos = (size - crossSize) / 2;
  return { modules: size, version: qr.version, segments: qr.segments.length, pathD: d, cross: { x: crossPos, y: crossPos, size: crossSize, scale: crossSize / CROSS_BOX } };
}

/** Das Schweizer Kreuz als Rechtecke in der 19.8er Zeichenbox. */
export const SWISS_CROSS = { box: CROSS_BOX, black: CROSS_BLACK, vertical: CROSS_V, horizontal: CROSS_H } as const;

const f = (n: number) => Number(n.toFixed(4)).toString();

/** Vollständiges SVG (46 × 46 mm) als Text, z. B. für Downloads und Tests. Enthält nur berechnete Zahlen, keine Eingabetexte. */
export function qrBillQrSvg(payload: string): string {
  const g = qrBillQrGeometry(payload);
  const { cross } = g;
  const mm = QR_BILL_LAYOUT.qrSizeMm;
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${mm}mm" height="${mm}mm" viewBox="0 0 ${g.modules} ${g.modules}" shape-rendering="crispEdges">` +
    `<rect width="${g.modules}" height="${g.modules}" fill="#fff"/>` +
    `<path d="${g.pathD}" fill="#000"/>` +
    `<g transform="translate(${f(cross.x)} ${f(cross.y)}) scale(${f(cross.scale)})">` +
    `<rect width="${CROSS_BOX}" height="${CROSS_BOX}" fill="#fff"/>` +
    `<rect x="${CROSS_BLACK.x}" y="${CROSS_BLACK.y}" width="${CROSS_BLACK.size}" height="${CROSS_BLACK.size}" fill="#000"/>` +
    `<rect x="${CROSS_V.x}" y="${CROSS_V.y}" width="${CROSS_V.w}" height="${CROSS_V.h}" fill="#fff"/>` +
    `<rect x="${CROSS_H.x}" y="${CROSS_H.y}" width="${CROSS_H.w}" height="${CROSS_H.h}" fill="#fff"/>` +
    `</g></svg>`
  );
}
