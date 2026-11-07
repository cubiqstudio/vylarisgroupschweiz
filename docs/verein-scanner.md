# Türkontrolle mit der Scanner-App

Diese Seite beschreibt die Seite der **Website**: die Scanner-Schnittstelle v1 und die Geräteverwaltung. Die Android-App «Vylaris Scanner» ist ein eigenes Projekt und der Verbraucher dieser Schnittstelle; ihr Code gehört nicht in dieses Repository.

## Zweck

An der Tür scannt die App den QR-Code des digitalen Mitgliederausweises. Sie zeigt sofort, ob die Mitgliedschaft gültig ist (mit Name, Mitgliedernummer, Status, Mitglied seit, Mitgliedschaftsart und aktuellen Ämtern), bei einem gewählten Anlass, ob eine Anmeldung besteht («Ticket»), und trägt die Person auf Wunsch als anwesend ein (Check-in). Ein Ticket ist die Anmeldung (`EventRegistration`) des Mitglieds mit Status `ANGEMELDET`; Anwesenheit ist `attendedAt`.

Der Ausweis-QR (`https://<Domain>/verein/pruefen/<Token>`) und die öffentliche Prüfseite bleiben unverändert (dort steht nur «Vorname N.»).

## Geräte koppeln, Schritt für Schritt

1. In der Verwaltung **System → Scanner** (`/admin/scanner`) auf «Neues Gerät» klicken. Nötig ist das Recht «System ändern» (Inhaber, Administration; andere Rollen sehen die Seite höchstens lesend).
2. Bezeichnung eingeben (1 bis 60 Zeichen, z. B. «Eingang links») und festlegen, ob das Gerät einchecken darf. Ohne dieses Recht kann das Gerät Ausweise nur prüfen.
3. Die Seite zeigt **einmal** das Token (`vgst_…`) und einen Kopplungs-QR-Code (mit der in der Norm verlangten Ruhezone von 4 Modulen). Der Code enthält `vylarisscanner://pair?server=<URL-kodierte Basis-URL>&token=<Token>`.
4. Auf dem Telefon die App öffnen, «Gerät koppeln» wählen und den Code scannen. Alternativ Adresse der Website und Token von Hand eingeben. Die App ruft `GET /me` auf und speichert Adresse und Token im Schlüsselspeicher von Android.
5. Das Token ist danach nicht mehr abrufbar. In der Liste steht nur noch der Anfang (`tokenHint`). Geht das Token verloren, Gerät löschen und ein neues anlegen.

In der Liste stehen je Gerät: Status (aktiv, gesperrt), «darf einchecken», Anfang des Tokens, Anlegedatum und der Zeitpunkt der letzten Nutzung. Aktionen: sperren, wieder aktivieren, «darf einchecken» ändern, löschen (mit Bestätigung).

### Verlorenes Gerät sperren

Geht ein Telefon verloren oder wird es gestohlen: unter **Scanner** das Gerät **sperren**. Sein Token ist dann sofort ungültig (die Schnittstelle antwortet mit 401), es gibt keine Mitgliederdaten mehr heraus. Taucht das Telefon wieder auf, kann das Gerät mit «Wieder aktivieren» freigegeben werden. «Löschen» entfernt das Gerät endgültig. Zusätzlich sollte das Telefon selbst gesperrt oder zurückgesetzt werden.

## Schnittstelle v1

Basis: `https://<Vereinsdomain>/api/scanner/v1/…`, nur HTTPS, JSON, UTF-8. Anmeldung: `Authorization: Bearer vgst_<43 Zeichen base64url>`. Keine Cookies, kein CORS (native App). Der Pfad liegt weder unter `/api/admin` noch unter `/api/account`; die Middleware lässt ihn durch, die Anmeldung prüft die Schnittstelle selbst.

Antwortform wie überall auf der Website: Erfolg `{ "data": … }`, Fehler `{ "error": { "code": "…", "message": "…" } }`, alle Antworten mit `Cache-Control: no-store`. Zeitpunkte sind ISO 8601 (UTC, `…Z`), reine Daten `JJJJ-MM-TT`. Für nicht vorgesehene HTTP-Methoden (zum Beispiel `POST /me`) antwortet Next.js selbst mit der Standardantwort 405 (ohne Fehlerkörper der Schnittstelle).

| Endpunkt | Zweck |
| --- | --- |
| `GET /me` | Token prüfen; liefert Verein, Gerät (`id`, `label`, `canCheckIn`) und `serverTime` |
| `GET /events` | Anlässe der Tür: veröffentlicht, Beginn höchstens 14 Tage in der Zukunft, Ende (sonst Beginn + 6 h) höchstens 6 Stunden vorbei; aufsteigend, höchstens 20; mit `stats` (`registered`, `waitlist`, `attended`) |
| `POST /scan` | Ausweis prüfen: Body `{ "token", "eventId"?, "checkIn"? }`. Mit `eventId` und `checkIn: true` wird atomar eingecheckt (nur mit `canCheckIn`, gültigem Ticket und wenn noch nicht eingecheckt) |
| `GET /members?q=…&eventId=…` | Manuelle Suche (`q` mindestens 2 Zeichen: nur Ziffern = Mitgliedernummer, sonst Teilstring in Vor- oder Nachname, ohne Rücksicht auf Gross-/Kleinschreibung, auch bei Umlauten), höchstens 20 Treffer, nie anonymisierte Mitglieder und nie Status `ANTRAG`/`ABGELEHNT`; mit `eventId` je Treffer die Anmeldung. Enger begrenzt als die übrigen Routen: 60 Anfragen pro Minute und Gerät |
| `PATCH /events/{eventId}/attendance` | Anwesenheit von Hand setzen oder zurücknehmen: Body `{ "memberId", "attended" }`; verlangt `canCheckIn` |

### Ausweis prüfen (`/scan`)

Antwort bei gültigem Ausweis: `valid: true`, `reason: null`, `member` (`id`, `memberNumber`, `firstName`, `lastName`, `status`, `membershipType`, `joinedAt`, `validUntil`, `offices`) und `event` (`null` ohne `eventId`; sonst `id`, `title`, `ticket`, `registration`, `checkIn`).

- `ticket`: `valid` (Anmeldung `ANGEMELDET`), `waitlist` (`WARTELISTE`), `unconfirmed` (`UNBESTAETIGT`), `cancelled` (`ABGESAGT`), `none` (keine Anmeldung; `registration` ist dann `null`).
- `checkIn.performed`: `true`, wenn diese Anfrage eingecheckt hat. `checkIn.alreadyAt`: Zeitpunkt, wenn die Person schon vorher eingecheckt war (dann `performed: false`).
- `member.validUntil`: letzter Tag der Mitgliedschaft, nur bei einem **aktiven** Mitglied mit vorgemerktem Austritt (Kündigung erfasst und Austrittsdatum gesetzt), sonst `null`. Bei ausgetretenen, ausgeschlossenen und verstorbenen Mitgliedern ist das Feld immer `null` (die Schnittstelle gibt kein Austritts- oder Todesdatum preis).
- `member.offices`: die **aktuellen** Ämter mit Anzeigename («Aktuelle Ämter» im Typ der App). Ein Amt zählt, wenn sein Beginn heute oder früher liegt und sein Ende leer ist oder heute oder später liegt (Kalendertag in Zürcher Zeit, dieselbe Regel `officeState` wie in der Verwaltung und bei den Aufgaben). Zukünftige Ämter fehlen, ein Amt mit künftigem Enddatum erscheint, beendete fehlen.
- `me.club.name` ist der Vereinsname aus den Stammdaten der Verwaltung; ist dort keiner erfasst, der Name des Rechtsträgers im Profil der Website, zurzeit «VylarisGroup» (`legalName` in `src/lib/sites.ts`, nicht «VylarisGroup Schweiz»).

Antwort bei ungültigem Ausweis: HTTP 200 mit `valid: false`, `member: null` (ausser bei `inactive`), `event: null` und einem `reason`:

| `reason` | Bedeutung |
| --- | --- |
| `malformed` | Token falsch aufgebaut oder Signatur stimmt nicht |
| `unknown` | Signatur stimmt, aber es gibt das Mitglied nicht mehr |
| `outdated` | Ausweis wurde neu ausgestellt (Version stimmt nicht mehr) |
| `inactive` | Mitgliedschaft nicht aktiv (Status ≠ `AKTIV`, anonymisiert, Austritt vorbei); `member` darf gesetzt sein, damit die Tür nachfragen kann |

### Fehlercodes

| HTTP | `error.code` | Wann |
| --- | --- | --- |
| 400 | `BAD_JSON` | Der Body ist kein gültiges JSON |
| 400 | `BAD_INPUT` | Unzulässige Zeichen in der Eingabe (NUL-Zeichen im Body, in `q` oder `eventId`) |
| 401 | `UNAUTHORIZED` | Token fehlt, ist falsch, das Gerät ist gesperrt oder gelöscht (die App koppelt dann ab) |
| 403 | `FORBIDDEN` | Das Gerät darf nicht einchecken |
| 404 | `NOT_FOUND` | Unbekannter oder nicht veröffentlichter Anlass, keine Anmeldung zum Anlass |
| 409 | `CONFLICT` | Nur Anmeldungen mit Status `ANGEMELDET` lassen sich einchecken oder zurücknehmen |
| 422 | `VALIDATION_ERROR` | Ungültige Eingabe |
| 429 | `RATE_LIMITED` | Zu viele Anfragen; Wartezeit im Header `Retry-After` |
| 405 | – | Nicht vorgesehene HTTP-Methode: Standardantwort von Next.js, nicht in der Form `{ error }` |
| 500 | `INTERNAL_ERROR` | Interner Fehler |

### Rate-Limits

| Grenze | Anfragen | Zeitfenster |
| --- | --- | --- |
| je IP (alle Routen) | 120 | 1 Minute |
| ungültige Tokens je IP | 20 | 10 Minuten |
| je Gerät (alle Routen) | 600 | 1 Minute |
| `/scan` und `/members` zusätzlich, je Gerät (gemeinsam gezählt) | 300 | 1 Minute |
| nur `GET /members`, zusätzlich, je Gerät | 60 | 1 Minute |

Bei Überschreitung antwortet die Schnittstelle mit 429 `RATE_LIMITED` und dem Header `Retry-After` (Sekunden).

### Hinweise für die App

- `/members` liefert auch Treffer zu **ausgetretenen**, ausgeschlossenen und verstorbenen Mitgliedern (nur anonymisierte, Anträge und abgelehnte nicht). Die App muss selbst auf `member.status` achten und ein nicht aktives Mitglied deutlich anzeigen. Auch `PATCH /events/{id}/attendance` prüft die Mitgliedschaft nicht (wie die Verwaltung); es verlangt nur eine gültige Anmeldung mit Status `ANGEMELDET`.
- Reine Mitgliedernummern unter 10 werden nur mit führender Null gefunden («07»), weil `q` mindestens 2 Zeichen lang sein muss. Die Nummer wird genau verglichen, nicht als Teilstring.
- Namen werden ohne Rücksicht auf Gross-/Kleinschreibung gefunden, auch mit Umlauten und Akzenten («özdemir» findet «Özdemir»). Bei Suchbegriffen mit Umlauten oder den Zeichen `%`, `_`, `\` prüft die Website eine Vorauswahl von höchstens 5000 Mitgliedern von Hand.
- Die Basis-URL der Schnittstelle stammt aus `SITE_URL` und muss **ohne `www`** gesetzt sein (`https://vylaris.ch`). Die Website leitet `www.<Domain>` mit 308 auf die Adresse ohne `www` um, und bei dieser Weiterleitung geht der `Authorization`-Header verloren: Die App würde mit 401 abgewiesen.

### Protokoll

Protokolliert werden nur Eingriffe, keine Abfragen. Das Änderungsprotokoll (`/admin/verein/protokoll`) zeigt:

| Aktion | Akteur | Inhalt |
| --- | --- | --- |
| `scanner.checkin`, `scanner.undo` | System, Name «Scanner: <Bezeichnung>» | Mitgliedernummer, Anlass, Zeitpunkt; keine Namen |
| `scanner.device.create`, `.revoke`, `.activate`, `.update`, `.delete` | angemeldete Person der Verwaltung | Gerätebezeichnung und Geräte-ID; nie das Token |

`.update` steht für die Änderung von «darf einchecken». Beim Sperren und Aktivieren ändert die Seite `active` und `revokedAt`.

## Datenschutz

- Antworten mit Personendaten (Name, Nummer, Eintritt, Ämter) gehen nur an ein gültiges, vom Vorstand gekoppeltes Gerät. Namen gehören nie ins Log.
- Das Token liegt in der Datenbank nur als SHA-256-Hash; angezeigt wird es einmal beim Anlegen. Es erscheint nicht im Protokoll, im Log und in keiner späteren API-Antwort der Verwaltung (nur `tokenHint`, die ersten 8 Zeichen).
- Die Kopplungs-Adresse stammt aus der Konfiguration (`SITE_URL`), nie aus dem Host-Header der Anfrage.
- Die Datenschutzerklärung (`/datenschutz`, öffentlich ohne Anmeldung erreichbar) beschreibt die Türkontrolle in einem **eigenen Abschnitt «Türkontrolle mit der App»** (Voraussetzung für die Veröffentlichung der App im Play Store). Er ist unabhängig vom Abschnitt «Digitaler Mitgliederausweis». Der Abschnitt nennt: Prüfung des Ausweises, manuelle Suche nach Name oder Mitgliedernummer (auch frühere Mitglieder, die nicht anonymisiert sind), die Anmeldung samt Freitext-Anmerkung zu einem gewählten Anlass (kann Gesundheitsangaben wie Allergien enthalten), die angezeigten Angaben (Name, Mitgliedernummer, Status, Eintrittsdatum, Mitgliedschaftsart, Ämter), das Änderungsprotokoll (Mitgliedernummer, Anlass, Zeitpunkt, Gerät, kein Name) sowie die Kopplung der Geräte durch den Vorstand und ihre jederzeitige Sperrung.
- Er lässt sich unter «Einstellungen → Rechtliches» abschalten (Schalter «Türkontrolle mit der App», angezeigt, solange nichts anderes gespeichert ist). Solange Geräte gekoppelt sind, sollte er an bleiben (Art. 19 revDSG): Die Seite **Scanner** zeigt eine Warnung, wenn er ausgeschaltet ist.
- Zur Speicherung in der App steht in der Erklärung: «Die Angaben werden in der App nur angezeigt; sie sind nicht dafür vorgesehen, dort gespeichert zu werden.» Das ist eine Zusicherung gegenüber der Entwicklung der App: Sie muss sicherstellen, dass die App Mitgliederdaten nicht dauerhaft speichert (kein Zwischenspeicher auf dem Gerät, keine Protokolle mit Namen, keine Datensicherung davon). Die Website kann das nicht prüfen.

## Update einer bestehenden Installation

- Datenbank: keine Änderung am Schema (`install.sh update` genügt).
- Datenschutzerklärung: Der Abschnitt «Türkontrolle mit der App» ist neu und für bestehende Installationen standardmässig **angezeigt** (gespeicherte Schalter bleiben gültig; ein neuer Schlüssel zählt als «angezeigt»). Der Absatz zur Türkontrolle steht nicht mehr unter «Digitaler Mitgliederausweis».
- Stand-Datum: Der Code trägt das Datum der Texte (`PRIVACY_UPDATED_AT` in `src/lib/legal.ts`, jetzt 7.11.2026). Eine Bestandsinstallation hat den Stand zusätzlich in der Datenbank (`legal.privacyUpdatedAt`, wird beim Speichern unter «Einstellungen → Rechtliches» nachgeführt, wenn sich die Erklärung dadurch ändert). Die öffentliche Seite zeigt das **spätere** der beiden Daten; nach dem Update steht dort also automatisch mindestens der 7.11.2026. Die Angabe im Formular unter «Einstellungen → Rechtliches» zeigt weiterhin nur das gespeicherte Datum; sie wird mit dem nächsten Speichern nachgeführt.
- Empfehlung: Nach dem Update einmal unter «Einstellungen → Rechtliches» die Erklärung ansehen und speichern.

## Betrieb

- **Basis-URL:** Die Website nimmt für den Kopplungs-QR `SITE_URL` aus der Umgebung (sonst `https://<Vereinsdomain>`, in der Entwicklung `http://localhost:3000`). Hinter einem Proxy `SITE_URL` setzen, sonst koppelt die App an die falsche Adresse. `SITE_URL` ohne `www` setzen (siehe «Hinweise für die App»).
- **Datenbank aktualisieren:** Die Tabelle `ScannerDevice` kommt mit `npm run db:push` (Prisma `db push`) in die Datenbank; bei einer Installation mit dem Installer genügt `install.sh update` (der Start des Containers führt `prisma db push` ohnehin aus). Eine Migration von Hand ist nicht nötig.
- **Rechte:** Seite und Verwaltungs-API gehören zum Modul `system` (`moduleForPath` in `src/lib/verein/permissions.ts`). Lesen ist mit «System lesen» möglich, Anlegen, Sperren, Aktivieren und Löschen brauchen «System ändern».
- **Code:** Geräteverwaltung `src/lib/verein/scanner-devices.ts`, `src/app/api/admin/scanner-devices/**`, `src/app/admin/(panel)/scanner/page.tsx`, `src/components/admin/scanner/**`; Token-Funktionen `src/lib/scanner-token.ts`. Tests: `scripts/test/scanner-admin.test.mts`.
