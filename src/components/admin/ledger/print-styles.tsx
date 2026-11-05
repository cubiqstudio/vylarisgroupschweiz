/**
 * Druckregeln für den Kassabericht: A4, die Verwaltungsoberfläche (Menü, Kopfzeile) bleibt beim Drucken weg und der Hintergrund wird weiss.
 * Gilt nur für Seiten, die diese Komponente einbinden.
 */
export function PrintStyles() {
  return (
    <style>{`
      @page { size: A4 portrait; margin: 14mm; }
      @media print {
        html, body { background: #fff !important; color: #000 !important; }
        aside, body header, nav, [aria-live] { display: none !important; }
        main { padding: 0 !important; }
        main > div { max-width: none !important; }
        .ledger-sheet, .ledger-sheet * { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
        .ledger-sheet header { display: block !important; }
        .break-before-page { break-before: page; }
      }
    `}</style>
  );
}
