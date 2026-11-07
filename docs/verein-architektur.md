# Vereinsverwaltung: Architektur

Diese Seite beschreibt, wie die Vereinsverwaltung (ZGB Art. 60 ff.) in die bestehende Website-Software eingebaut ist. Sie richtet sich an Entwicklerinnen und Entwickler. Wo Statuten, Beträge oder Fristen betroffen sind, gilt: Der Verein trägt sie selbst ein, die Statuten gehen vor. Die Software macht keine Rechtsberatung.

## 1. Überblick

Die Software besteht aus drei Teilen, die dieselbe Datenbank und dieselbe Anmeldung nutzen:

| Teil | Wo | Wer |
| --- | --- | --- |
| Öffentliche Website | `src/app/(site)/**` | alle Besuchenden (Beitrittsformular, Anlässe, Statuten) |
| Mitgliederportal | `src/app/(site)/account/**` | angemeldete Website-Konten, mit einem Mitglied verknüpft (`/account/verein/**`) |
| Verwaltung | `src/app/admin/(panel)/**`, `src/app/api/admin/**` | Admin-Konten mit Rolle |

Bestehendes bleibt erhalten: Website, Konten, Tickets, Newsletter, Lizenzen und das Admin-Dashboard. Neu sind die Module Mitglieder, Beiträge, Kasse, Versammlungen, Anlässe, Dokumente und Aufgaben samt Vereinseinstellungen.

## 2. Mitglieder, Website-Konten und Admin-Konten

Es gibt drei getrennte Dinge, die bewusst nicht in einer Tabelle zusammenfallen:

| Begriff | Tabelle | Zweck | Anmeldung |
| --- | --- | --- | --- |
| Mitglied | `Member` | Person im Verein (Stammdaten, Status, Beitrag, Ämter) | keine eigene |
| Website-Konto | `User` | Registrierung auf der Website (E-Mail bestätigt) | Sitzung `kind = "user"` |
| Admin-Konto | `AdminUser` | Zugang zur Verwaltung mit Rolle | Sitzung `kind = "admin"` |

Verknüpfungen (alle optional, alle 1:1):

```mermaid
flowchart LR
  M[Member] -- "Member.userId" --> U[User]
  A[AdminUser] -- "AdminUser.memberId" --> M
```

- Ein Mitglied braucht kein Konto. Wer kein Konto hat, wird per E-Mail oder Post bedient.
- `Member.userId` verbindet ein Mitglied mit seinem Website-Konto. Erst damit gibt es das Mitgliederportal. Die Verknüpfung setzt der Vorstand im Mitglieder-Detail, oder das Konto wird über die bestätigte E-Mail-Adresse zugeordnet (nur wenn `User.emailVerifiedAt` gesetzt ist, die Adresse genau mit `Member.email` übereinstimmt und das Mitglied noch kein Konto hat). Eine Verknüpfung allein aufgrund einer Angabe in der Anfrage gibt es nie.
- `AdminUser.memberId` verbindet ein Admin-Konto mit dem Mitglied, dem es gehört (Vorstandsmitglieder). Damit funktionieren Aufgaben-Zuteilung, Anzeige im Protokoll und das Mitgliederportal auch mit einer Admin-Sitzung.
- Das Amt (`Office`, z. B. Präsident) beschreibt die Funktion im Verein und die Amtszeit. Die Rolle (`AdminUser.role`) beschreibt, was jemand in der Software darf. Beides ist absichtlich getrennt: Wer gewählt ist, bekommt nicht automatisch Zugriff, und die Zugriffsrechte lassen sich ohne Wahl ändern.

### Wer ist angemeldet?

- `getCurrentAdmin()` (`src/lib/auth.ts`) liefert den Admin inklusive `roles` (alle wirksamen Rollen) und `memberId`.
- `getCurrentUser()` liefert das Website-Konto.
- `getCurrentMember()` (`src/lib/verein/guard.ts`) liefert das zur Sitzung gehörende Mitglied. Massgeblich ist nur die serverseitige Verknüpfung, nie eine ID aus der Anfrage.

## 3. Rollen und Rechte

### Rollen

`AdminUser.role` ist die Hauptrolle. `AdminUser.extraRoles` (kommagetrennt) nimmt weitere Rollen auf, wenn jemand mehrere Ämter hat, z. B. Vize-Präsident und Kassier (`role = "VIZEPRAESIDENT"`, `extraRoles = "KASSIER"`). Wirksam ist die Vereinigung aller Rollen; je Modul gilt die höchste Stufe.

Bisherige Werte (`OWNER`, `ADMIN`, `EDITOR`) bleiben gültig und behalten ihre Bedeutung. Neu: `PRAESIDENT`, `VIZEPRAESIDENT`, `KASSIER`, `AKTUAR`, `REVISOR`. Die Tokens der Sitzung enthalten nur die Hauptrolle; die Rollen und die wirksame Rechtematrix (siehe unten) werden bei jeder Anfrage serverseitig bestimmt, eine Änderung wirkt also sofort (die Rechtematrix steht höchstens 15 Sekunden im Zwischenspeicher, im speichernden Prozess ist sie sofort aktuell).

### Module und Stufen

Jede Rolle hat je Modul die Stufe «kein Zugriff», `read` (lesen) oder `write` (lesen und ändern). Die **Voreinstellung** (`DEFAULT_MATRIX`) steht in `src/lib/verein/permissions.ts`; sie ist einstellbar (siehe «Einstellbare Rechte»).

| Modul | OWNER / ADMIN | Präsident | Vize | Kassier | Aktuar | Revisor | Redakteur |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `dashboard` (Übersicht) | W | R | R | R | R | R | R |
| `members` | W | W | W | R | W | – | – |
| `fees` (Beiträge, Rechnungen) | W | R | R | W | – | R | – |
| `ledger` (Kasse) | W | W | R | W | – | R | – |
| `meetings` | W | W | W | R | W | R | – |
| `events` | W | W | W | R | W | – | – |
| `documents` | W | W | W | W | W | R | – |
| `tasks` | W | W | W | W | W | – | – |
| `verein_settings` | W | W | R | R | R | – | – |
| `finance_settings` (IBAN, Fristen) | W | R | R | W | – | – | – |
| `audit` (Änderungsprotokoll) | W | R | R | – | – | R | – |
| `website` (Dienste, Status, Blog, Tickets, Lizenzen, Website-Benutzer) | W | W | W | – | – | – | W |
| `newsletter` | W | W | W | – | W | – | W |
| `system` (Zugänge, Mailserver, Registrierung, Impressum, Rollen und Rechte) | W | R | – | – | – | – | – |
| `self` (eigenes Passwort) | W | W | W | W | W | W | W |

W = lesen und ändern, R = nur lesen. Das ist eine Voreinstellung für die übliche Aufgabenverteilung im Vorstand. Der Präsident darf in der Kasse buchen und Konten ändern (zusammen mit dem Kassier); der Vize-Präsident nur lesen. Die Statuten gehen vor: Wo sie etwas anderes regeln, stellt der Verein die Rechte entsprechend ein.

Änderung gegenüber früher: `EDITOR` hatte bisher Zugriff auf alle Admin-Bereiche. Jetzt darf die Rolle Website-Inhalte und Newsletter bearbeiten, aber keine Systemeinstellungen (Mailserver, Registrierung, Impressum) mehr.

### Einzelrechte

Neben den Modulstufen gibt es drei Einzelrechte je Rolle (Schalter):

| Einzelrecht | Schlüssel | Wirkung | Voreinstellung |
| --- | --- | --- | --- |
| Vorstandsnotizen bei Mitgliedern sehen | `boardNotes` | `Member.boardNotes` anzeigen, erfassen und ändern (`canSeeBoardNotes`, früher fest `hasBoardRole`) | an für Inhaber, Administrator, Präsident, Vize, Kassier, Aktuar; aus für Revisor und Redakteur (Datenminimierung) |
| Dokumente «Nur Vorstand» sehen | `boardDocuments` | Dokumente mit der Sichtbarkeit `VORSTAND` in Liste, Suche, Zähler, Einzelansicht und Download; ohne das Recht sind sie auch nicht änderbar und nicht anlegbar | wie oben |
| Geschäftsjahr abschliessen und wieder öffnen | `fiscalYearClose` | Abschluss, Wiedereröffnung und Genehmigungsvermerk eines Geschäftsjahres in der Kasse (`canCloseFiscalYear`, serverseitig in `applyFiscalAction` und im Hinweis der Seite «Geschäftsjahre») | an für Inhaber, Administrator, Präsident und Kassier; aus für Vize-Präsident, Aktuar, Revisor und Redakteur |

Beim Recht «Geschäftsjahr abschliessen» gilt: Es wirkt nur zusammen mit mindestens Leserecht auf `ledger` (Kasse); ohne Zugriff auf die Kasse gibt es keinen Abschluss, auch wenn der Schalter an ist (die Oberfläche weist darauf hin, Vorschau und Rollenerklärung zeigen das Recht dann nicht als erlaubt). Das Schreibrecht auf `ledger` genügt nicht mehr und ist nicht nötig: Buchen, Stornieren, Konten und Budget bleiben am Schreibrecht. Inhaber und Administrator haben das Recht immer. Eine gespeicherte Konfiguration ohne das Feld bleibt gültig und bekommt die Voreinstellung; eine Änderung steht im Änderungsprotokoll wie die anderen Einzelrechte (`ROLLE.fiscalYearClose`, Vorher/Nachher).

Beim Dokumentenrecht reicht das Leserecht auf `documents` allein nicht mehr: Ein Revisor mit Leserecht sieht «Nur Vorstand»-Dokumente nur, wenn der Verein ihm das Einzelrecht gibt. Das wird serverseitig in den Datenbankabfragen erzwungen (`documents-data.ts`, `boardOnly`) und im Download (`/api/documents/[id]/download`, `/api/admin/documents/[id]/download`, Publikum `STAFF` ohne, `BOARD` mit dem Recht), nicht nur in der Anzeige. Das Modul `audit` ist unabhängig von diesem Recht: Deshalb schreiben Dokumente «Nur Vorstand» nur neutral ins Änderungsprotokoll («Dokument (Nur Vorstand) hochgeladen», ohne Titel, Kategorie und Dateiname; `documents-lib.ts`, `redactBoardAuditValues`), und alte Einträge mit Klartext-Titel blenden Liste, Suche, Zähler und Export für Rollen ohne das Recht aus (`audit-data.ts`, `legacyBoardDocumentRows`).

### Einstellbare Rechte

Inhaber und Administrator stellen unter **Verwaltung > Rollen und Rechte** (`/admin/verein/rollen`, Modul `system`) ein, was die Rollen dürfen: Tabelle Rollen × Module mit «Kein Zugriff / Lesen / Ändern», die drei Einzelrechte als Schalter, Erklärung je Rolle (dynamisch aus der wirksamen Matrix), Vorschau «Diese Person darf …» und «Auf Voreinstellung zurücksetzen» je Rolle und gesamt. Jede Änderung steht im Änderungsprotokoll (`permissions.update`, Vorher/Nachher als `ROLLE.modul` ohne Personendaten).

- **Speicherort:** nur die Abweichungen von der Voreinstellung, als JSON in `SiteSetting` mit dem Schlüssel `verein.permissions.v1`, z. B. `{"levels":{"KASSIER":{"ledger":"read"}},"flags":{"REVISOR":{"boardDocuments":true}}}`. `none` nimmt eine Stufe weg. Ist nichts abweichend, gibt es den Eintrag nicht. Format und Zod-Prüfung: `permissions-config.ts`.
- **Wirksame Matrix:** `resolveMatrix(overrides)` in `permissions.ts` ist die einzige Stelle, die sie bildet. Unbekannte Rollen und Module, ungültige Werte, Inhaber/Administrator und alles, was die Schranken verletzt, werden verworfen; es gilt die Voreinstellung. Kaputtes JSON, falsche Form oder ein Lesefehler ergeben die Voreinstellung. Eine gespeicherte Matrix kann also nie mehr Rechte geben, als die Schranken zulassen.
- **Laden:** `getEffectiveMatrix()` (`permissions-data.ts`) liest mit 15 Sekunden Zwischenspeicher; Speichern macht ihn im Prozess sofort ungültig. `getCurrentAdmin()` hängt die Matrix mit `withMatrix` an `admin.roles`. Alle reinen Funktionen (`canAccess`, `levelFor`, `visibleModules`, `levelsFor`, `filterNav`, `canSeeBoardNotes`, `canSeeBoardDocuments`, `canCloseFiscalYear`, `describeAccess`, `roleHint`) lesen sie von dort. Eine Rollenliste ohne Matrix (Tests, Kopien, Client) nutzt die Voreinstellung; Client-Komponenten bekommen deshalb fertig berechnete Stufen als Props (`levelsFor`, `filterNavByLevels`). Wer `admin.roles` kopiert oder umbaut, verliert die Matrix: immer die Liste selbst weitergeben.
- **Speichern:** `saveRolePermissions` (`permissions-save.ts`) prüft selbst, dass die Person das Modul `system` ändern darf (nur Inhaber/Administrator), schreibt Einstellung und Protokolleintrag in einer Transaktion. Die Route `/api/admin/settings/verein/rollen` ist in `PATH_MODULES` dem Modul `system` zugeordnet.

**Schranken** (gegen Aussperrung und Rechteausweitung, `isAllowedLevel`):

| Regel | Grund |
| --- | --- |
| Inhaber und Administrator sind fest: immer alles, nie einschränkbar | Es bleibt immer ein Zugang mit vollem Zugriff |
| `self` bleibt für jede Rolle «Ändern» | Jede Person kann ihr Passwort ändern |
| `dashboard` mindestens «Lesen» | Nach der Anmeldung landet niemand im Leeren |
| `system` für andere Rollen höchstens «Lesen», nie «Ändern» | Sonst könnte sich jemand selbst mehr Rechte geben |
| Nur wer `system` ändern darf, darf die Matrix ändern | siehe oben |

### Wie man Rechte prüft

Grundregel: Der Wächter ist die erste Anweisung jedes Handlers und jeder Seite. Layouts genügen nicht, weil sie bei der Navigation innerhalb des Bereichs nicht neu rendern. `scripts/check-admin-guards.mts` (Teil von `npm run check`) schlägt fehl, wenn eine Admin-Route oder Admin-Seite keinen Wächter enthält.

API-Route unter `/api/admin/**`:

```ts
export const GET = handle(async (req: Request) => {
  const admin = await requireAdmin(req); // Sitzung + Origin + Rolle
  ...
});
```

`requireAdmin` (`src/lib/api.ts`) leitet das Modul aus dem Pfad ab (`moduleForPath`) und die Stufe aus der Methode (GET = lesen, sonst ändern). Eine Route unter `/api/admin/ledger/**` verlangt also `ledger`. Unbekannte Pfade fallen auf `system` (nur Inhaber/Administrator): ein neuer Bereich ist erst offen, wenn er in `PATH_MODULES` eingetragen ist.

Strengere oder andere Prüfung innerhalb eines Handlers:

```ts
const admin = await requireAdminModule(req, "fees", "write"); // src/lib/verein/guard.ts
```

Ohne drittes Argument folgt die Stufe der Methode. Beispiel: Ein Zahlungseingang unter `/api/admin/members/[id]/payments` berührt `fees` und braucht `requireAdminModule(req, "fees", "write")` zusätzlich zum Pfadmodul `members`.

Server-Seite unter `/admin`:

```ts
export default async function Page() {
  const admin = await requireModulePage("members", "write"); // Stufe ist standardmässig "read"
  ...
}
```

Ohne Admin-Sitzung antwortet die Seite mit 404 (der Bereich verrät sich nicht), ohne Recht leitet sie auf `/admin/keine-berechtigung` weiter. Innerhalb der Seite blendet man Schaltflächen mit `canAccess(admin.roles, "members", "write")` aus; die Prüfung im API-Handler bleibt trotzdem Pflicht.

Mitgliederportal und Mitglieder-Endpunkte:

```ts
const { member } = await requireMember(req);        // Sitzung + verknüpftes Mitglied (jeder Status)
const { member } = await requireActiveMember(req);   // nur Status AKTIV
const member = await requireMemberPage();            // Seite: sonst Weiterleitung
```

Keine IDOR: Jede Abfrage im Portal filtert mit `memberId: member.id` (bzw. holt Datensätze über Beziehungen des Mitglieds). IDs aus der URL werden nie ohne diesen Filter verwendet. Beispiel: `db.invoice.findFirst({ where: { id, memberId: member.id } })`; liefert nichts, antwortet der Handler mit 404.

Navigation: `filterNavByLevels` blendet Einträge ohne Leserecht aus (`AdminShell`; die Stufen berechnet der Server mit `levelsFor(admin.roles)` aus der wirksamen Matrix). Neue Menüpunkte tragen ihr Modul im Eintrag.

## 4. Modulgrenzen und Besitzer

Jedes Modul besitzt seine Routen, Komponenten (`src/components/admin/<modul>/**`), Zod-Schemas und Fachlogik (`src/lib/verein/<modul>-*.ts`) und ändert nur seine eigenen Prisma-Modelle. Alles andere kommt aus dem gemeinsamen Kern.

| Besitzer | Seiten und Routen | Modelle |
| --- | --- | --- |
| mitglieder | `/admin/members/**`, `/api/admin/members/**`, `/mitglied-werden`, `/account/verein/mitgliedschaft` | `Member`, `MembershipType`, `Office` |
| beitraege | `/admin/fees/**` (inkl. `/admin/fees/invoices/[id]/print`), `/api/admin/fees/**`, `/api/admin/invoices/**`, `/account/verein/beitraege` | `FeePeriod`, `FeePeriodRate`, `Invoice`, `InvoiceItem`, `Payment`, `Reminder` |
| kasse | `/admin/ledger/**`, `/api/admin/ledger/**` | `AccountCategory`, `Transaction`, `Budget`, `Receipt`, `FiscalYear` |
| versammlungen | `/admin/meetings/**`, `/api/admin/meetings/**`, `/account/verein/versammlungen` | `Meeting`, `AgendaItem`, `Attendance`, `Resolution` |
| anlaesse | `/admin/events/**`, `/api/admin/events/**`, `/anlaesse/**`, `/api/events/**`, `/account/verein/anlaesse` | `Event`, `EventRegistration` |
| dokumente-aufgaben | `/admin/documents/**`, `/admin/tasks/**`, `/api/admin/documents/**`, `/api/admin/tasks/**`, `/api/documents/**`, `/account/verein/dokumente`, `/verein/statuten` | `Document`, `DocumentVersion`, `BoardTask` |
| uebersicht-einstellungen | `/admin` (Dashboard), `/admin/verein/**` (Einstellungen, Finanzen, Zugänge, Protokoll), `/api/admin/settings/verein/**`, `/api/admin/access/**`, `/api/admin/audit/**`, `/account/verein` (Übersicht, Mitgliederausweis), Newsletter-Segmente | `AuditLog` (lesen), Einstellungen `verein.*`, `AdminUser` (Rollen), `NewsletterCampaign.segment*` |

Schnittstelle für die Türkontrolle: Die getrennte Android-App «Vylaris Scanner» greift über `/api/scanner/v1/**` (Bearer-Token eines gekoppelten Geräts, Modell `ScannerDevice`) auf Mitgliederausweis, Anlass-Anmeldungen und Anwesenheit zu. Die Geräteverwaltung liegt unter `/admin/scanner` und `/api/admin/scanner-devices/**` (Modul `system`). Beschreibung der Schnittstelle, Kopplung und des Datenschutzes: [verein-scanner.md](verein-scanner.md).

Mitgliederausweis (Aufbau): Vorderseite (Logo, Vereinsname, «Mitgliederausweis») und Rückseite (Name, Mitgliedernummer, Eintrittsdatum, QR-Code), Komponente `src/components/verein/membership-card.tsx`, Seite `/account/verein/ausweis`. Die Druckdatei ist eine Kartenvorlage im Format CR80 / ISO 7810 ID-1 (85.6 × 54 mm, 2 Seiten, randlos, Sicherheitszone 4 mm; Regeln in `print-styles-card.tsx`, nur auf dieser Seite aktiv). Der QR-Inhalt (signierte Prüfadresse) ist unverändert; dieselbe Adresse zeigt die Seite zum Kopieren für NFC-Karten (NDEF-«URL»). Einzelheiten: [verein-uebersicht.md](verein-uebersicht.md).

Gemeinsamer Kern (nur über Rückfrage ändern): `prisma/schema.prisma` (Grundstruktur, `Counter`), `src/lib/verein/*`, `src/components/admin/core/*`, Navigation, `src/lib/api.ts`, `src/lib/auth.ts`.

Mitglieder-Seiten (`/account/verein/**`) liegen im gemeinsamen Rahmen `src/app/(site)/account/verein/layout.tsx` (zweite Reiterebene). Platzhalterseiten tragen im Kopf den Vermerk «Platzhalter (Besitzer: …)» und sind zu ersetzen.

## 5. Namenskonventionen

- Dateien: kleingeschrieben, Bindestriche. Routen auf Deutsch ohne Umlaute (`/anlaesse`, `/beitraege`, `/mitglied-werden`) ausser bestehenden englischen Routen (`/admin/members`, `/admin/fees`, `/admin/ledger`, `/admin/meetings`, `/admin/events`, `/admin/documents`, `/admin/tasks`).
- Bibliothek: `src/lib/verein/<modul>-<thema>.ts` für Fachlogik des Moduls (rein, ohne `server-only`, mit Test), `src/lib/verein/<modul>-data.ts` o. Ä. für Datenbankzugriff (`import "server-only"`).
- Komponenten: `src/components/admin/<modul>/…` (Verwaltung), `src/components/verein/…` (öffentlich und Portal).
- Texte: Öffentliche und Portal-Texte über `defineMessages` in `src/i18n/verein.ts` (oder eigener Datei `src/i18n/verein-<modul>.ts`). Admin-Texte dürfen direkt in den Komponenten stehen.
- Statuswerte: Grossbuchstaben ohne Umlaute (`AUSGETRETEN`, `UEBERWEISUNG`), definiert in `src/lib/verein/constants.ts` mit Bezeichnungen (`*_LABEL`) und Farben (`*_TONE`, `TONE_CLASS`). Zod-Schemas verwenden diese Listen.
- Beträge: Feldnamen enden auf `Rappen`. Datumsfelder ohne Uhrzeit enden auf `Date`/`On`/`At` je nach Bedeutung; Zeitpunkte auf `At`.
- API-Antworten: `{ data }` bzw. `{ error: { code, message, fields } }` über `adminOk`, `handle`, `ApiError` (`src/app/api/_lib/http.ts`, `src/lib/api.ts`).
- Änderungen lesen mit `parsePatch` (nur gesendete Felder), Listen mit `listParams` / `searchWhere` / `pageMeta` (`src/lib/verein/pagination.ts`).

## 6. Datenmodell

```mermaid
erDiagram
  User ||--o| Member : "userId"
  AdminUser |o--o| Member : "memberId"
  MembershipType ||--o{ Member : "membershipTypeId"
  MembershipType ||--o{ FeePeriodRate : ""
  MembershipType ||--o{ NewsletterCampaign : "segmentTypeId"
  Member ||--o{ Office : ""
  Member ||--o{ Invoice : ""
  Member ||--o{ Payment : ""
  Member ||--o{ Attendance : ""
  Member ||--o{ EventRegistration : ""
  Member ||--o{ BoardTask : "assigneeMemberId"
  AdminUser ||--o{ BoardTask : "assigneeAdminId"
  FeePeriod ||--o{ FeePeriodRate : ""
  FeePeriod ||--o{ Invoice : ""
  Invoice ||--|{ InvoiceItem : ""
  Invoice ||--o{ Payment : ""
  Invoice ||--o{ Reminder : ""
  AccountCategory ||--o{ InvoiceItem : "categoryId"
  AccountCategory ||--o{ Transaction : "categoryId"
  AccountCategory ||--o{ Transaction : "counterAccountId"
  AccountCategory ||--o{ Budget : ""
  Payment |o--o| Transaction : "paymentId"
  Transaction |o--o| Transaction : "reversalOfId"
  Transaction ||--o{ Receipt : ""
  Meeting ||--o{ AgendaItem : ""
  Meeting ||--o{ Attendance : ""
  Meeting ||--o{ Resolution : ""
  Meeting ||--o{ BoardTask : ""
  Meeting ||--o{ Document : ""
  AgendaItem ||--o{ Resolution : ""
  Resolution ||--o{ BoardTask : ""
  Event ||--o{ EventRegistration : ""
  Document ||--|{ DocumentVersion : ""
```

Nicht dargestellt: `AuditLog` (bewusst ohne Fremdschlüssel), `Counter` (Nummernkreise), `FiscalYear` (Abschluss je Jahr, ohne Fremdschlüssel; `Transaction.fiscalYear` ist eine Zahl), `SiteSetting` (Einstellungen).

### Konventionen im Schema

- Keine Enums: Statuswerte sind Strings (SQLite lokal, PostgreSQL produktiv). Die zulässigen Werte stehen in `constants.ts`.
- Beträge sind Integer in Rappen. Gerechnet und formatiert wird nur mit `money.ts`.
- Datum ohne Uhrzeit wird als Mittag UTC des Kalendertags gespeichert (`dateOnly`), Zeitpunkte als echte Instants. Gelesen und angezeigt wird immer in Zürcher Zeit (`dates.ts`). Eingaben `TT.MM.JJJJ HH:mm` gelten als Zürcher Zeit.
- `onDelete`: Personendaten ohne eigenen Wert (Ämter, Anwesenheiten, Anmeldungen) fallen mit dem Mitglied (`Cascade`). Buchhaltungsrelevante Datensätze (Rechnungen, Zahlungen, Buchungen, Kategorien) sind mit `Restrict` geschützt: Sie lassen sich nicht löschen, solange sie gebraucht werden. Optionale Verweise auf Sitzungen, Beschlüsse und Dokumente sind `SetNull`.
- Rechnungen halten den Empfänger als Momentaufnahme (`recipientName`, `recipientAddress`); die Rechnung bleibt gültig, auch wenn sich das Mitglied ändert oder anonymisiert wird.
- Bytes-Spalten (`Receipt.data`, `DocumentVersion.data`) nie in Listen laden: immer `select` ohne `data`.
- `Document` trägt die Metadaten, die Datei liegt in `DocumentVersion` (frühere Fassungen bleiben erhalten, `Document.currentVersion` zeigt die aktuelle).
- `EventRegistration.cancelTokenHash` ist der SHA-256 des Abmelde-Tokens; das Token selbst steht nur in der Bestätigungsmail (`createHash("sha256")`, wie `src/lib/tokens.ts`).

## 7. Fortlaufende Nummern

`src/lib/verein/ids.ts` vergibt Mitgliedernummer, Rechnungsnummer pro Jahr (`2026-0001`) und Belegnummer pro Jahr (`B-2026-0001`) über die Tabelle `Counter`. Die Vergabe ist atomar und muss in derselben Transaktion stehen, die den Datensatz anlegt, sonst entstehen bei Fehlern Lücken:

```ts
const invoice = await db.$transaction(async (tx) => {
  const { number, year, seq } = await nextInvoiceNumber(tx, yearOf(issueDate));
  return tx.invoice.create({ data: { number, year, seq, ... } });
});
```

Das Jahr der Rechnungsnummer ist das Jahr des Rechnungsdatums in Zürcher Zeit (`yearOf`).

## 8. Änderungen protokollieren (Audit)

Sensible Änderungen schreiben einen Eintrag in `AuditLog`: Mitglied angelegt, geändert, ausgetreten oder ausgeschlossen; Rolle geändert; Rechnung erstellt, storniert oder bezahlt; Buchung geändert oder korrigiert; Jahr abgeschlossen; Einstellungen geändert; Export von Mitgliederlisten.

```ts
await db.$transaction(async (tx) => {
  const after = await tx.member.update({ where: { id }, data });
  await logAudit(tx, {
    actor: auditActor(admin),
    action: "member.update",
    objectType: "Member",
    objectId: id,
    summary: `Mitglied ${after.memberNumber} geändert`,
    ...diffForAudit(before, after), // nur geänderte Felder
  });
});
```

- `logAudit` läuft mit demselben Client wie die Änderung: Innerhalb einer Transaktion wird beides zusammen gespeichert oder zurückgerollt.
- Werte werden als JSON-Text abgelegt, ohne Geheimnisse (Schlüssel mit `pass`, `secret`, `token`, `hash`, `key` werden verborgen), gekürzt und ohne Zirkelbezüge (`serializeAuditValue`).
- Aktionsnamen: `<objekt>.<verb>` (`member.create`, `member.exit`, `invoice.cancel`, `payment.create`, `transaction.reverse`, `fiscalyear.lock`, `settings.update`, `role.change`, `export.members`).
- Akteure: `auditActor(admin)`, `auditActorMember(member)`, `SYSTEM_ACTOR`.
- Türkontrolle: `scanner.device.create|revoke|activate|update|delete` (Admin als Akteur, nie mit Token) sowie `scanner.checkin` und `scanner.undo` (Akteur `SYSTEM` mit Namen «Scanner: <Bezeichnung>», Mitgliedernummer, keine Namen). Lesbare Bezeichnungen: `src/lib/verein/audit-view.ts`.
- Das Protokoll wird nie bearbeitet oder gelöscht. Lesen dürfen es Rollen mit `audit` (`/admin/verein/protokoll`).

## 9. Gemeinsame Helfer (`src/lib/verein`)

| Datei | Inhalt |
| --- | --- |
| `permissions.ts` | Rollen, Module, Voreinstellung, `resolveMatrix`, Schranken, `canAccess`, `levelFor`, `effectiveRoles`, `moduleForPath`, `filterNav`, `canSeeBoardNotes`, `canSeeBoardDocuments` |
| `permissions-config.ts`, `permissions-data.ts`, `permissions-save.ts` | Rollenrechte: Speicherformat und Zod-Prüfung, Laden mit Zwischenspeicher, Speichern mit Protokoll |
| `guard.ts` | `requireAdminModule`, `requireModulePage`, `getCurrentMember`, `requireMember`, `requireActiveMember`, `requireMemberPage` |
| `money.ts` | Rappen formatieren und lesen (`1’234.50`), Rundung auf 5 Rappen, anteiliger Jahresbeitrag |
| `dates.ts` | Zürcher Zeit, Datum ohne Uhrzeit, Geschäftsjahr, Fristen, Austrittstermin, Einladungsfrist |
| `ids.ts` | fortlaufende Nummern (atomar) |
| `audit.ts` | `logAudit`, `diffObjects`, sicheres Serialisieren |
| `csv.ts` | CSV für Excel (Semikolon, BOM, CRLF), Schutz vor Formel-Injektion, `csvResponse` |
| `ics.ts` | iCalendar für Anlässe und Versammlungen, `icsResponse` |
| `files.ts` | Upload-Prüfung (Grösse, Typ am Inhalt erkannt, SHA-256), sichere Dateinamen, `downloadHeaders` |
| `iban.ts` | IBAN (Prüfsumme und Länge je Land), BIC/SWIFT, QR-IBAN, QR-Referenz und Creditor Reference prüfen und bauen |
| `pagination.ts` | `listParams`, `pageMeta`, `searchWhere`, `listHref` |
| `validation.ts` | gemeinsame Zod-Bausteine (E-Mail, Betrag, Datum, Telefon, …) |
| `settings-schema.ts`, `settings.ts` | Vereinseinstellungen: Schlüssel, Zod-Schema, Lesen und Schreiben mit Protokoll |
| `links.ts` | Links für Mails und Seiten auf der festen Basis-URL |
| `mail.ts` | `sendVereinMail` im Marken-Layout, Signatur und Antwortadresse aus den Einstellungen |
| `constants.ts` | Wertelisten, Bezeichnungen, Farben |

### Sicherheitsregeln

- Jede Admin-Route und -Seite prüft serverseitig die Berechtigung (Abschnitt 3). Mitglieder-Endpunkte prüfen die Sitzung und filtern nach dem eigenen Mitglied.
- Alle Eingaben laufen durch Zod. Ausgaben ohne rohes HTML (Markdown nur über `react-markdown` wie bisher).
- Uploads: `checkUpload(file, { maxBytes, kinds })` prüft Grösse und den Inhalt (nicht den vom Browser gemeldeten Typ). Grenzen: Belege 5 MB (`RECEIPT_MAX_BYTES`), Dokumente 10 MB (`DOCUMENT_MAX_BYTES`). Downloads immer mit `downloadHeaders` (Anhang, `nosniff`, kein öffentliches Caching).
- CSV: Alle Textzellen laufen durch `csvField`; Zellen, die mit `=`, `+`, `-`, `@`, Tabulator oder Wagenrücklauf beginnen, werden mit `'` neutralisiert. Zahlen nur über `csvNumber`/`csvMoney`.
- Mails: Links ausschliesslich über `links.ts` (`SITE_URL` bzw. Vereinsdomain), nie aus dem Host-Header. Empfängeradressen vorher mit `emailSchema` prüfen.
- Datenschutz (revDSG): nur erheben, was der Verein braucht (Geburtsdatum ist optional); Mitgliederlisten und Exporte nur für Rollen mit Leserecht auf `members`; sensible Änderungen und Exporte in `AuditLog`.

## 10. Vereinseinstellungen

Die Einstellungen liegen in `SiteSetting` (Schlüssel/Wert), Schlüssel mit Präfix `verein.`. Schema, Voreinstellungen und Vollständigkeitsprüfung: `settings-schema.ts`; Lesen und Schreiben (mit Protokolleintrag): `settings.ts` (`getVereinSettings`, `saveVereinSettings`).

| Feld | Schlüssel | Voreinstellung |
| --- | --- | --- |
| `accountHolder` | `verein.account.holder` | leer |
| `iban` | `verein.account.iban` | leer (Hauptkonto: jede gültige IBAN, aber keine QR-IBAN) |
| `qrIban` | `verein.account.qrIban` | leer (nur Schweizer Konten, Institutskennung 30000–31999) |
| `bank` | `verein.account.bank` | leer (z. B. «SumUp Payments Limited»; erscheint in den Einzahlungsangaben) |
| `bic` | `verein.account.bic` | leer (BIC/SWIFT, 8 oder 11 Zeichen) |
| `payeeName` | `verein.account.payeeName` | leer (Zahlungsempfänger, falls abweichend vom Kontoinhaber) |
| `paymentDays` | `verein.fees.paymentDays` | nicht festgelegt |
| `reminderAfterDays` | `verein.fees.reminderAfterDays` | nicht festgelegt |
| `reminderDays1`, `reminderDays2`, `reminderDays3` | `verein.fees.reminderDays1` … `3` | nicht festgelegt |
| `reminderFee1Rappen` … `3` | `verein.fees.reminderFee1Rappen` … `3` | nicht festgelegt (= 0) |
| `fiscalStartMonth`, `fiscalStartDay` | `verein.fiscal.startMonth`, `verein.fiscal.startDay` | 1 / 1 (Kalenderjahr, gemäss Statuten anpassen) |
| `invitationDays` | `verein.assembly.invitationDays` | nicht festgelegt (Einladungsfrist gemäss Statuten) |
| `exitMode` | `verein.exit.mode` | `KALENDERJAHR` |
| `exitNoticeMonths` | `verein.exit.noticeMonths` | 6 |
| `senderName`, `senderSignature` | `verein.texts.senderName`, `verein.texts.signature` | leer |
| `invoiceMailIntro`, `reminderMailIntro`, `invitationMailIntro`, `welcomeMailText` | `verein.texts.*` | leer (die Module bringen neutrale Standardtexte mit) |
| `replyToEmail` | `verein.mail.replyTo` | leer |
| `applyEnabled` | `verein.public.applyEnabled` | `false` (Beitrittsformular aus) |
| `applyNotifyEmail` | `verein.public.applyNotifyEmail` | leer |

Die Vereinsstammdaten liegen getrennt davon unter eigenen Schlüsseln (`src/lib/verein/profile-schema.ts`, Lesen und Schreiben in `profile.ts`, mit Protokolleintrag):

| Feld | Schlüssel | Voreinstellung |
| --- | --- | --- |
| `name` | `verein.profile.name` | Rechtsträger der Website (`src/lib/sites.ts`) |
| `seat` | `verein.profile.seat` | leer (Sitz gemäss Statuten) |
| `foundedOn` | `verein.profile.foundedOn` | leer |
| `purpose` | `verein.profile.purpose` | leer (Zweck gemäss Statuten) |
| `uid` | `verein.profile.uid` | leer (UID mit Prüfziffer geprüft) |
| `register` | `verein.profile.register` | leer |

Wer den Vereinsnamen braucht (Mails, Impressum, Dokumente), nutzt `getVereinName()` aus `profile.ts`.

Keine erfundenen Werte: Beträge, Fristen und Kontodaten sind leer, bis der Verein sie einträgt. Fehlt etwas, das eine Funktion braucht, meldet `missingForInvoicing`, `missingForReminders` bzw. `missingForInvitations` genau, was fehlt. Die Funktion bleibt bis dahin gesperrt, mit Hinweis und Link auf `/admin/verein/finanzen` bzw. `/admin/verein`.

Zwei Voreinstellungen haben eine Grundlage im Gesetz bzw. sind neutral und sind in der Oberfläche mit «gemäss Statuten anpassen» zu kennzeichnen:

- Austritt: ZGB Art. 70 Abs. 2 sieht, wenn die Statuten nichts anderes bestimmen, den Austritt nur auf Ende eines Kalenderjahres vor, mit Ankündigung spätestens sechs Monate vorher. `earliestExitDate(eingang, exitRuleOf(settings), fiscalStartOf(settings))` berechnet den frühestmöglichen Termin.
- Stimmrecht: ZGB Art. 67 gibt allen Mitgliedern das gleiche Stimmrecht, sofern die Statuten nichts anderes bestimmen. Die Mitgliedschaftsarten werden entsprechend mit Stimmrecht angelegt.

Die Mitgliedschaftsarten «Aktivmitglied» und «Passivmitglied» legt der Seed als Vorlagen an, mit Beitrag 0 CHF und dem Hinweis, dass der Verein Beitrag und Rechte festlegt.

### Konto und Zahlungsangaben

Der Verein hat **ein Hauptkonto** (`iban`). Es darf eine beliebige gültige IBAN sein (Prüfsumme nach ISO 13616 mod 97 und Länge je Land nach IBAN-Register, für unbekannte Länder 15–34 Zeichen); gespeichert wird normalisiert (ohne Leerzeichen, Grossbuchstaben, `normalizeIban`). Welche Zahlungsangaben auf der Rechnung stehen, bestimmt das Land der IBAN (`billModeOf`, `chooseBillAccount` in `fees-calc.ts`, `composeInvoiceBill` in `fees-bill.ts`):

| Hauptkonto | Rechnung | Referenz |
| --- | --- | --- |
| Schweizer oder liechtensteinische IBAN (CH/LI) | Schweizer **QR-Rechnung** (Empfangsschein und Zahlteil mit QR-Code) | Creditor Reference (`SCOR`, «RF…») |
| CH/LI-IBAN mit zusätzlicher **QR-IBAN** (`qrIban`) | QR-Rechnung mit der QR-IBAN | QR-Referenz (`QRR`, 27 Ziffern) |
| **Ausländische IBAN** (z. B. IE bei SumUp) | **Einzahlungsangaben** statt QR-Rechnung: Zahlungsempfänger (Vereinsname und Anschrift, oder der abweichende Zahlungsempfänger), IBAN in Vierergruppen, BIC/SWIFT und Bank (wenn erfasst), Währung CHF und Betrag, Zahlungsreferenz, Zahlbar bis | immer Creditor Reference «RF…» (ISO 11649, international gültig), nie `QRR` |

- **Warum keine QR-Rechnung mit ausländischer IBAN:** Die Swiss Payment Standards erlauben in der QR-Rechnung nur IBAN mit Länderkürzel CH oder LI. Mit einer ausländischen IBAN wird deshalb kein Swiss-QR-Code erzeugt (`validateQrBill` lehnt sie ab). Es gibt auch keinen EPC-QR («GiroCode»): Er kennt nur Euro, die Rechnungen lauten auf CHF.
- **Einstellungen:** Vereinseinstellungen → Finanzen. Die Oberfläche zeigt live Land und Art der IBAN («Schweizer IBAN», «Ausländische IBAN (IE) – keine Schweizer QR-Rechnung möglich») und bei ausländischer IBAN einen Hinweis: Rechnungen lauten auf CHF; Zahlungen aus der Schweiz auf ein Euro-Konto im Ausland sind für die Zahlenden Auslandüberweisungen mit Umrechnung und möglichen Gebühren, ob das Konto CHF-Zahlungen annimmt, klärt der Verein mit dem Zahlungsanbieter. Eine QR-IBAN neben einer ausländischen IBAN wird beim Speichern abgelehnt (`accountConflicts`).
- **Anschrift:** Name und Anschrift des Zahlungsempfängers sind die des Vereins (Kontoinhaber bzw. abweichender Zahlungsempfänger, Anschrift aus Einstellungen → Rechtliches). Das Land der Anschrift hängt nie vom Land der IBAN ab (ohne Angabe: Schweiz).
- **Darstellung:** Rechnungsansicht im Admin und unter `/rechnung/…`, Portal und Druck (A4) zeigen den Block «Einzahlungsangaben» (`payment-details-block.tsx`) am Ende der Rechnung, wo sonst der Zahlteil steht. Rechnungs- und Mahnmails (`fees-mail-text.ts`) enthalten bei ausländischer IBAN die Einzahlungsangaben als Text und sprechen weder von «QR-Rechnung» noch von «Zahlteil».
- **Bestehende Rechnungen:** Die Zahlungsangaben werden bei jeder Ansicht aus den aktuellen Einstellungen berechnet. Wechselt das Hauptkonto, zeigen auch bereits versendete, noch offene Rechnungen das neue Konto; die Referenz wird (bei einem Wechsel auf eine ausländische IBAN) als Creditor Reference neu gebildet, die gespeicherte Referenz bleibt für den Zahlungsabgleich gültig. Bereits ausgedruckte oder versendete Rechnungen mit altem Konto sollte der Verein bei einem Kontowechsel neu versenden.

### Zahlungseingang

Zahlungen werden über die **Zahlungsreferenz** (QR-Referenz oder Creditor Reference «RF…», auch gruppiert und auch im Verwendungszweck) oder die **Rechnungsnummer** im Text (`2026-0001`) einer Rechnung zugeordnet (`fees-import.ts`). Die Zuordnung setzt keine Schweizer IBAN voraus, weder beim eigenen Konto noch bei der Gegenseite.

- **CSV-Import** (Beiträge → «Zahlungen aus einer Liste einlesen»): Kopfzeile mit «Betrag» (in CHF) und mindestens «Referenz» oder «Text»/«Verwendungszweck» (auch `Amount`, `Description`, `Reference`), optional «Datum». Das genügt für den CSV-Export eines ausländischen Zahlungsanbieters mit Verwendungszweck. Der Import zeigt zuerst die Zuordnung, gebucht wird erst nach Bestätigung. Ein CAMT-Import (ISO 20022 XML) ist nicht vorhanden.
- **Manuell erfassen**, wenn das Format des Anbieters nicht passt (andere Spalten, Währung nicht CHF, kein CSV): Rechnung öffnen → «Zahlung erfassen» (Datum, Betrag in CHF, Referenz optional), oder unter Beiträge → «Zahlung ohne Rechnung erfassen» für Zahlungen ohne Rechnung (z. B. Spenden). Teil- und Überzahlungen werden angezeigt; die Buchung in die Kasse erfolgt in derselben Transaktion.
- Zahlt jemand in einer anderen Währung als CHF, weicht der gutgeschriebene Betrag vom Rechnungsbetrag ab: Der Betrag in CHF wird manuell erfasst, die Rechnung bleibt sonst offen (Teilzahlung).

## 11. Datenschutz und Aufbewahrung

- Zweckbindung und Datensparsamkeit: Pflichtangaben sind Name und eine Kontaktmöglichkeit. Adresse, Telefon und Geburtsdatum sind optional bzw. nur, wenn der Verein sie braucht. Mit dem Beitrittsantrag bestätigen Personen Statuten und Datenschutzhinweis (`Member.consentAt`).
- Zugriff: Mitgliederlisten, Exporte und Vorstandsnotizen nur für berechtigte Rollen; Vorstandsnotizen und Dokumente «Nur Vorstand» nur mit dem jeweiligen Einzelrecht (Voreinstellung: nicht für Revisor und Redakteur). Mitglieder sehen im Portal ausschliesslich ihre eigenen Daten.
- Protokoll: Sensible Änderungen stehen im `AuditLog` (Abschnitt 8). Das Protokoll enthält keine Passwörter oder Tokens.
- Buchhaltungsunterlagen (Rechnungen, Zahlungen, Buchungen, Belege): Aufbewahrung 10 Jahre als Voreinstellung der Software. Sie dürfen in dieser Zeit nicht gelöscht werden (`Restrict`). Die Rechnung enthält dafür den Empfänger als Momentaufnahme. Massgeblich sind die Vorgaben, die für den Verein gelten; im Zweifel klärt der Verein sie mit seiner Revisionsstelle oder Treuhand ab.
- Mitgliederdaten nach Austritt: nur noch soweit nötig, also für offene Forderungen, Buchhaltungsbelege, Protokolle und das Mitgliederverzeichnis der Vereinsgeschichte. Darüber hinaus entfernt der Vorstand Personendaten (Kontaktdaten, Geburtsdatum, Notizen) und setzt `Member.anonymizedAt`; Mitgliedernummer, Status, Eintritts- und Austrittsdatum bleiben. Das Modul Mitglieder bietet dafür die Aktion «Personendaten entfernen» an, die nur ohne offene Forderungen möglich ist und im Protokoll steht.
- Löschbegehren (revDSG): werden über dieselbe Aktion umgesetzt, soweit keine gesetzliche Aufbewahrung entgegensteht.
- Anmeldungen von Gästen zu Anlässen: Name und E-Mail nur für den Anlass; nach dem Anlass entfernen oder anonymisieren.
- Newsletter: bleibt Double-Opt-In. Segmente nach Mitgliedschaftsart gleichen Abonnenten über die E-Mail-Adresse mit aktiven Mitgliedern ab; ein Mitglied ohne Newsletter-Anmeldung erhält keinen Newsletter. Vereinsmitteilungen (Einladung, Rechnung, Mahnung) sind Mitteilungen im Rahmen der Mitgliedschaft und laufen über `sendVereinMail`.

## Hintergrundläufe

Zeitgesteuerte Arbeiten laufen nicht im Webserver, sondern werden von aussen ausgelöst:

- Der Dienst `cron` (`docker-compose.yml`, gleiches Image wie die App, `scripts/cron-runner.mjs`, reines Node) ruft täglich um 03:15 Uhr Zeit Europe/Zurich `POST /api/cron/daily` auf (Bearer-Token `CRON_SECRET`, mind. 24 Zeichen; ohne Geheimnis antwortet die Route mit 404). `install.sh` erzeugt das Geheimnis automatisch.
- Die Aufgaben stehen in `DAILY_TASKS` (`src/lib/verein/cron.ts`): fällige Austritte vollziehen (`completeDueExitsAs(SYSTEM_ACTOR)`, dieselbe Fachlogik wie «Austritt vollziehen»), Anlass-Erinnerungen (`sendEventReminders`), unbestätigte Gast-Anmeldungen löschen (`purgeExpiredUnconfirmedRegistrations`), Angaben von Gästen 30 Tage nach dem Anlass entfernen (`anonymizePastGuestRegistrations`, `events-guests.ts`). Eine neue Aufgabe ist ein Eintrag in dieser Liste plus ein Anzeigename in `CRON_TASK_LABELS` (`cron-lib.ts`). Aufgaben müssen wiederholbar sein; jede läuft einzeln abgesichert, ein Fehler stoppt die anderen nicht. Eine Aufgabe kann ein Ergebnis mit `note` liefern (übersprungen, `ok` bleibt wahr): so die Erinnerungen ohne eingerichteten Mailserver (`sendEventReminders` zählt `skipped`, markiert nichts als erinnert; Text `MAIL_SKIPPED_NOTE` in `cron-lib.ts`). Der Vollzug fälliger Austritte verschickt keine Mails und hängt nicht vom Mailserver ab. Der Dienst `cron` schaltet den geerbten Healthcheck des Images ab; fehlt `CRON_SECRET`, meldet der Läufer das im Log und wartet (keine Neustart-Schleife); `/api/cron/*` ist in Caddy und im Tunnel von aussen gesperrt, abgewiesene Aufrufe erscheinen (gedrosselt) im App-Log.
- Das Ergebnis (Zeit, je Aufgabe Name, Erfolg, Anzahl; keine Personendaten) steht in `SiteSetting` unter `cron.lastRun`. Die Übersicht zeigt es Rollen mit Recht `system` oder `verein_settings` (nur lesend); nach mehr als 36 Stunden ohne Lauf erscheint eine Warnung. `GET /api/cron/daily` liefert dasselbe mit gültigem Token und dient dem Läufer beim Start, um einen verpassten Lauf nachzuholen.
- Der Zugriffsschutz (`cron-auth.ts`) gilt auch für `POST /api/events/reminders` (`CRON_SECRET` oder weiterhin `EVENTS_CRON_SECRET`).
- Tests: `scripts/test/cron.test.mts` (Zeitplan inkl. Sommerzeit, Wiederholung, Nachholen) und `scripts/test/cron-db.test.mts` (Temp-SQLite: Austritte, Fehlerisolation, Speichern, Routen, Übersicht).

## 12. Prüfen

- `npm run typecheck`, `npm run lint` (ohne Warnungen)
- `npm run test` enthält `scripts/test/verein-core.test.mts` (Geld, Datum, Fristen, CSV, Audit, Rechte, Nummern, IBAN, ICS, Uploads, Einstellungen), `scripts/test/foreign-iban.test.mts` (ausländische IBAN: IBAN- und BIC-Prüfung, Einstellungen, QR-Rechnung oder Einzahlungsangaben, Mailtexte, Zahlungsabgleich), `scripts/test/permissions.test.mts` (einstellbare Rechte: Auflösung, Schranken, Aussperr- und Ausweitungsschutz, kaputte Daten) und `scripts/test/permissions-db.test.mts` (eigene Temp-SQLite: Speichern nur mit System-Recht, Protokoll, Dokumentensichtbarkeit)
- `npx tsx scripts/check-admin-guards.mts` prüft die Wächter (Teil von `npm run check`)
- Datenbank lokal: `DATABASE_URL="file:./dev.db" flock /tmp/prisma.lock npx prisma db push --skip-generate && flock /tmp/prisma.lock npx prisma generate`

Reine Fachlogik gehört in eigene Dateien ohne Seiteneffekte mit einem Test unter `scripts/test/` (Muster: `verein-core.test.mts`), eingehängt in `npm run test`.
