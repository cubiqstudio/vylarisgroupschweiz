# Kasse und Buchhaltung

Die Kasse bildet eine einfache Vereinsbuchhaltung ab: Einnahmen, Ausgaben und Vermögenslage (Art. 69a ZGB). Vereine, die im Handelsregister eingetragen sind oder bestimmte Grössen überschreiten, können weitergehenden Pflichten nach Art. 957 ff. OR unterliegen; die Statuten gehen vor, im Zweifel klärt der Verein dies mit seiner Revisionsstelle oder Treuhand.

## Begriffe

- Konto (`AccountCategory`): Art `EINNAHMEN`, `AUSGABEN` oder `VERMOEGEN` (Bank, Kasse). Nummer ist ein frei gewähltes Kürzel. Der Anfangsbestand gilt nur für Vermögenskonten und lässt sich nicht mehr ändern, sobald ein Geschäftsjahr abgeschlossen ist.
- Buchung (`Transaction`): positiver Betrag, Richtung `EINNAHME` (Einnahmenkonto + Vermögenskonto), `AUSGABE` (Ausgabenkonto + Vermögenskonto) oder `UMBUCHUNG` (Vermögenskonto nach Vermögenskonto).
- Gegenbuchung: Statt zu löschen, storniert man. Die Gegenbuchung übernimmt Richtung und Konten, hebt die Wirkung auf (`source = STORNO`, `reversalOfId`) und liegt in einem offenen Geschäftsjahr. Gelöscht wird nie, ausser dass das Löschen einer Zahlung unter «Beiträge» ihre Buchung entfernt, solange das Jahr offen und die Buchung nicht storniert ist.
- Geschäftsjahr (`FiscalYear`): benannt nach dem Beginnjahr. Abgeschlossen = keine Änderung mehr (Buchungen, Konten-Anfangsbestand, Budget, Belege entfernen). Belege dürfen auch danach ergänzt werden.
- Ergebnis = Einnahmen minus Ausgaben. Es entspricht der Veränderung der Vermögenskonten, solange jede Einnahme und Ausgabe ein Vermögenskonto trägt (die Jahresrechnung weist eine Abweichung aus).

## Rechte

| Aktion | Wer |
| --- | --- |
| Lesen, Exportieren, Kassenbericht drucken | Rollen mit Leserecht auf `ledger` (Kassier, Präsident, Vize, Revisor, Inhaber, Administration) |
| Buchen, Stornieren, Konten, Budget, Belege | Schreibrecht auf `ledger` (Kassier, Inhaber, Administration) |
| Geschäftsjahr abschliessen, wieder öffnen, Genehmigung vermerken | Einzelrecht «Geschäftsjahr abschliessen und wieder öffnen» (`fiscalYearClose`, `canCloseFiscalYear`) zusammen mit mindestens Leserecht auf die Kasse. Voreinstellung: Präsident, Kassier, Inhaber und Administration. Einstellbar unter «Rollen und Rechte» |

Aktuar und Redaktion haben keinen Zugriff.

## Regeln beim Abschluss

- Ein Jahr lässt sich erst nach seinem Ende abschliessen, und frühere Jahre mit Buchungen müssen zuerst abgeschlossen sein.
- Wieder öffnen geht nur ohne spätere abgeschlossene Jahre und verlangt eine Begründung (Protokoll `fiscalyear.unlock`); ein Genehmigungsvermerk fällt dabei weg.
- Zahlungen aus «Beiträge», die in dem Jahr noch nicht gebucht sind, werden gemeldet; Abschluss nur mit ausdrücklicher Bestätigung.

## Schnittstelle zu Beiträgen

`src/lib/verein/ledger-link.ts`: `bookPayment(tx, …)` bucht einen Zahlungseingang als Einnahme (idempotent: ein zweiter Aufruf gleicht Betrag und Datum der bestehenden Buchung an, solange das Jahr offen ist), `removePaymentBooking`, `assertYearUnlocked`, `assertFiscalYearOpen`, `listBookingAccounts`.

## Dateien

- Fachlogik (rein, mit Tests in `scripts/test/ledger.test.mts`): `ledger-lib.ts`, `ledger-schemas.ts`, `ledger-export.ts`.
- Datenzugriff (server-only): `ledger-data.ts`. `getLedgerSummary()` liefert Kennzahlen für die Übersicht.
- API: `/api/admin/ledger/**` (Buchungen, Gegenbuchung, Belege, Konten, Budget, Geschäftsjahre, CSV-Export).
- Seiten: `/admin/ledger` (Buchungen), `/new`, `/[id]`, `/accounts`, `/budget`, `/reports`, `/reports/[year]/print` (Kassenbericht A4), `/years`.

## Datenschutz und Aufbewahrung

Belege liegen in der Datenbank (PDF, PNG, JPEG, WebP, höchstens 5 MB, Typ am Inhalt geprüft). Buchungen, Belege und Konten werden nicht gelöscht (Aufbewahrung, voreingestellt 10 Jahre). Exporte und alle Änderungen stehen im Änderungsprotokoll (`export.ledger`, `transaction.*`, `receipt.*`, `account.*`, `budget.update`, `fiscalyear.*`).
