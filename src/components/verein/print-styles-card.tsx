/**
 * Druckregeln für den Mitgliederausweis (nur aktiv, solange die Ausweis-Seite angezeigt wird: das style-Element verschwindet mit der Seite).
 *
 * Ergebnis: ein PDF im Kartenformat CR80 / ISO 7810 ID-1 (85.6 × 54 mm), Seite 1 = Vorderseite, Seite 2 = Rückseite. Jede Seite ist
 * randlos (Vollfläche, keine runden Ecken, kein Rahmen, kein Schatten; die Rundung entsteht beim Stanzen der Karte). `@page { margin: 0 }`
 * entfernt auch Kopf- und Fusszeile des Browsers. Alles ausser den beiden Kartenseiten (Seitenkopf mit Rolle, Name und E-Mail, Reiter,
 * Hinweise, Schaltflächen) wird nicht gedruckt: Jedes Element, das weder die Kartenfläche (.ausweis-print-root) noch deren Vorfahre oder
 * Nachfahre ist, wird ausgeblendet (Seitenhintergrund = Kartenfarbe, damit Rundungsreste der PDF-Seitengrösse nie als weisser Strich erscheinen); die Vorfahren verlieren Abstände und Grössen. Text und QR-Code liegen innerhalb von 4.7 mm Rand
 * (Sicherheitszone, siehe membership-card.tsx).
 *
 * Die Regeln gelten nur hier: andere Druckansichten (Rechnung, QR-Rechnung, Protokoll, Jahresbericht) binden diese Komponente nicht ein
 * und haben eigene @page-Regeln.
 *
 * Hinweis: keine Zeichen "<", ">" und "&" im CSS (React würde sie im style-Element maskieren); die Kindwahl erfolgt über :not() und :has().
 */
export function CardPrintStyles() {
  return (
    <style>{`
      @page { size: 85.6mm 54mm; margin: 0; }
      @media print {
        html, body { width: 85.6mm !important; height: auto !important; min-height: 0 !important; margin: 0 !important; padding: 0 !important; background: #0f1f4d !important; color: #000 !important; overflow: visible !important; display: block !important; print-color-adjust: exact; -webkit-print-color-adjust: exact; }
        body *:not(.ausweis-print-root):not(.ausweis-print-root *):not(:has(.ausweis-print-root)) { display: none !important; }
        body *:has(.ausweis-print-root) { display: block !important; position: static !important; width: auto !important; max-width: none !important; height: auto !important; min-height: 0 !important; margin: 0 !important; padding: 0 !important; border: 0 !important; background: none !important; box-shadow: none !important; overflow: visible !important; transform: none !important; }
        .ausweis-hide-print { display: none !important; }
        .ausweis-print-root { display: block !important; width: 85.6mm !important; max-width: none !important; margin: 0 !important; padding: 0 !important; }
        .ausweis-face { display: block !important; width: 85.6mm !important; max-width: none !important; height: 54mm !important; margin: 0 !important; padding: 0 !important; overflow: hidden !important; break-inside: avoid !important; break-after: page !important; page-break-after: always !important; }
        .ausweis-face:last-of-type { break-after: auto !important; page-break-after: auto !important; }
        .membership-card { width: 85.6mm !important; max-width: none !important; height: 54mm !important; aspect-ratio: auto !important; margin: 0 !important; border: 0 !important; border-radius: 0 !important; box-shadow: none !important; filter: none !important; }
        .membership-card, .membership-card * { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
      }
    `}</style>
  );
}
