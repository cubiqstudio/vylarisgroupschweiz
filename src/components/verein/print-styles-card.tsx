/**
 * Druckregeln für den Mitgliederausweis: Menü, Kopf- und Fusszeile der Website bleiben weg, der Ausweis wird in Kartengrösse
 * (85.6 × 54 mm) gedruckt. Gilt nur für Seiten, die diese Komponente einbinden.
 */
export function CardPrintStyles() {
  return (
    <style>{`
      @page { size: A4 portrait; margin: 15mm; }
      @media print {
        html, body { background: #fff !important; color: #000 !important; }
        body header, body footer, body nav, [aria-live], .ausweis-hide-print { display: none !important; }
        .membership-card { width: 85.6mm !important; max-width: none !important; height: 54mm !important; aspect-ratio: auto !important; box-shadow: none !important; break-inside: avoid; }
        .membership-card * { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
      }
    `}</style>
  );
}
