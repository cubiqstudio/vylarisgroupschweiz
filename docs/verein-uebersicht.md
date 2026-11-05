# Modul Übersicht, Vereinseinstellungen, Zugänge, Protokoll und Mitgliederausweis

Dieses Modul bündelt, was den Verein als Ganzes betrifft: die Übersicht (Dashboard), die Einstellungen, die Zugänge und Rollen, das Änderungsprotokoll, die Portal-Übersicht mit dem Mitgliederausweis und die Newsletter-Segmente. Rechte, Konten und Konventionen stehen in `docs/verein-architektur.md`. Wo Statuten, Beträge oder Fristen betroffen sind, gilt: Der Verein trägt sie selbst ein, die Statuten gehen vor. Die Software macht keine Rechtsberatung.

## Seiten und Schnittstellen

| Bereich | Pfad | Recht |
| --- | --- | --- |
| Übersicht (Vereins- und Website-Kennzahlen) | `/admin` | `dashboard` lesen; jede Kennzahl nur mit Leserecht auf ihr Modul |
| Vereinseinstellungen (Stammdaten, Geschäftsjahr, Einladungsfrist, Austritt, Beitrittsformular, Mailtexte) | `/admin/verein`, `GET/PUT /api/admin/settings/verein` | `verein_settings` |
| Finanzeinstellungen (Konto, Zahlungsfrist, Mahnwesen) | `/admin/verein/finanzen`, `GET/PUT /api/admin/settings/verein/finanzen` | `finance_settings` |
| Zugänge und Rollen | `/admin/verein/zugaenge`, `/api/admin/access` (`GET`, `POST`), `/api/admin/access/[id]` (`PATCH`, `DELETE`), `/api/admin/access/[id]/password` (`POST`) | `system` |
| Änderungsprotokoll | `/admin/verein/protokoll`, `GET /api/admin/audit`, `GET /api/admin/audit/export` | `audit` (nur lesen) |
| Portal-Übersicht | `/account/verein` | jedes angemeldete Konto; ohne verknüpftes Mitglied steht dort, wie man Mitglied wird |
| Mitgliederausweis mit Druckansicht | `/account/verein/ausweis` | verknüpftes Mitglied (`requireMemberPage`), Ausweis nur bei Status AKTIV |
| Prüfseite hinter dem QR-Code | `/verein/pruefen/[token]` | öffentlich, begrenzt auf 30 Abfragen pro Minute und Adresse |
| Empfängerzahl eines Newsletter-Segments | `GET /api/admin/newsletter/recipients` | Pfadmodul `newsletter` |

Code: `src/lib/verein/overview-lib.ts` (Bereiche je Rolle, Rechnungen, Einrichtungshilfe), `overview-data.ts` (Kennzahlen), `settings-forms.ts` (Felder und Schemas der beiden Einstellungsseiten), `profile-schema.ts` / `profile.ts` (Stammdaten), `access-lib.ts` / `access-schemas.ts` / `access-data.ts` (Zugänge), `audit-view.ts` / `audit-data.ts` (Protokoll), `membership-card.ts` / `membership-card-data.ts` (Ausweis), `newsletter-segment.ts` / `newsletter-segment-data.ts` (Segmente). Texte des Portals: `src/i18n/verein-uebersicht.ts`. Tests: `scripts/test/overview.test.mts`.

## Übersicht

Die Kennzahlen werden nur für Bereiche berechnet, die die Rolle lesen darf (Revision sieht Rechnungen, Kassa und Versammlungen, aber keine Tickets oder Dienste; die Redaktion sieht nur die Website). Jede Gruppe wird für sich geladen: Fällt eine Abfrage aus oder ist ein Bereich noch leer, bleibt der Rest der Seite erhalten. Angezeigt werden aktive Mitglieder nach Art, offene Anträge, offene und überfällige Rechnungen (der Fälligkeitstag gilt noch als rechtzeitig), Kassastand des laufenden Geschäftsjahres, nächste Versammlung, nächste Anlässe, offene Aufgaben und die bisherigen Website-Kennzahlen. Fehlen Einstellungen (Konto, Zahlungsfrist, Mahnfristen, Einladungsfrist), erscheint oben eine Einrichtungshilfe mit Link auf die richtige Einstellungsseite.

## Einstellungen

Die Seiten folgen der Rechteaufteilung: Allgemeines ändert, wer `verein_settings` schreiben darf, Konto und Fristen, wer `finance_settings` schreiben darf. Die APIs lehnen Felder der jeweils anderen Seite ab. Alle Änderungen laufen über `saveVereinSettings` und stehen mit Vorher/Nachher im Änderungsprotokoll (`settings.update`).

Die Vereinsstammdaten (Name, Sitz, Gründungsdatum, Zweck, UID, Handelsregister) gehören nicht zum Fundament-Schema und liegen unter den eigenen Schlüsseln `verein.profile.*` in `SiteSetting`; sie werden ebenfalls protokolliert (Objekt «Vereinsstammdaten»). Nichts ist vorbelegt ausser dem Namen, der auf den Rechtsträger der Website zurückfällt. Die UID wird mit ihrer Prüfziffer geprüft.

Als «gemäss Statuten anpassen» gekennzeichnet sind nur die Voreinstellungen mit Grundlage im Gesetz oder neutralem Wert: Austrittsregel (ZGB Art. 70 Abs. 2), Geschäftsjahr (Kalenderjahr) und der Hinweis auf das Stimmrecht je Mitgliedschaftsart (ZGB Art. 67). Beträge, Fristen und Kontodaten sind leer, bis der Verein sie einträgt. Anschrift und Kontakt des Vereins stammen aus den rechtlichen Angaben (Impressum).

## Zugänge und Rollen

Admin-Konten anlegen, Name, Hauptrolle, Zusatzrollen und verknüpftes Mitglied ändern, Passwort zurücksetzen, löschen. Das Startpasswort wird zufällig erzeugt, genau einmal angezeigt und muss bei der ersten Anmeldung geändert werden. Es erscheint weder im Protokoll noch in einer Liste.

Schutzregeln (serverseitig, Tests in `overview.test.mts`):

- Es bleibt immer mindestens ein Zugang mit der Rolle Inhaber oder Administrator bestehen.
- Eigene Rollen lassen sich nicht ändern, der eigene Zugang lässt sich nicht löschen, das eigene Passwort ändert man unter «Mein Konto».
- Die Rolle «Inhaber» vergibt und entzieht nur ein Inhaber; Zugänge von Inhabern ändert, löscht und setzt nur ein Inhaber zurück.
- Ein Mitglied lässt sich nur mit einem Zugang verknüpfen, und nur ein aktives Mitglied.
- Wechselt die Rolle einer anderen Person oder wird ihr Passwort zurückgesetzt, endet ihre Sitzung (`sessionVersion` steigt).
- Protokolliert werden `access.create`, `role.change`, `access.update`, `access.password-reset` und `access.delete`.

Das Amt (z. B. Kassier) gibt keinen Zugriff. Die Tabelle weist nur darauf hin, wenn das verknüpfte Mitglied ein laufendes Amt hat, zu dem die Rolle fehlt; der Vorstand entscheidet.

## Änderungsprotokoll

Liest `AuditLog`: paginiert, mit Suche und Filtern (Objekt, Aktion, Akteur, Zeitraum in Zürcher Zeit), Anzeige von Vorher/Nachher mit lesbaren Feldnamen, Beträgen in CHF und Datum als 5.11.2026. Das Protokoll wird nie bearbeitet oder gelöscht. Der CSV-Export enthält nur den Klartext (keine Vorher/Nachher-Werte), nutzt `csv.ts` (Schutz vor Formel-Injektion) und steht selbst im Protokoll (`export.audit`).

## Mitgliederausweis

Die Portal-Übersicht zeigt Status, Mitgliedsart, offene Rechnungen, den nächsten Anlass und die nächste Versammlung des angemeldeten Mitglieds; alle Abfragen laufen über die Mitglieds-ID aus der Sitzung. Der Ausweis (`/account/verein/ausweis`) ist eine Karte im Seitenverhältnis 85.6 × 54 mm mit Logo, Name, Mitgliedernummer, Mitgliedsart, Eintrittsdatum, Gültigkeit und QR-Code; gedruckt wird in Kartengrösse (im Druckdialog «Als PDF speichern» möglich).

Der QR-Code enthält nur `…/verein/pruefen/<Token>` auf der festen Basis-URL der Website. Das Token ist `<Mitglieds-ID>.<Signatur>` (HMAC-SHA256 mit einem aus `AUTH_SECRET` abgeleiteten Schlüssel), enthält keine Personendaten und wird nicht gespeichert. Die Prüfseite schlägt das Mitglied beim Aufruf nach und zeigt nur «Gültiges Mitglied: Vorname N., Nr. 12». Ein Mitglied, das nicht mehr aktiv ist, nicht mehr existiert oder anonymisiert wurde, erscheint als «Nicht gültig» ohne jede Angabe zur Person. Die Gültigkeit nennt keine erfundenen Fristen: «solange die Mitgliedschaft besteht» oder, bei vorgemerktem Austritt, «bis <Austrittstag>».

## Newsletter-Segmente

Kampagnen gehen an «alle Abonnenten», «aktive Mitglieder» oder «Mitglieder einer Mitgliedschaftsart». Empfänger sind bestätigte, aktive Abonnenten, deren Adresse (ohne Beachtung der Gross-/Kleinschreibung) mit der E-Mail eines aktiven, nicht anonymisierten Mitglieds übereinstimmt. Das Double-Opt-In bleibt Pflicht: Ein Mitglied ohne Newsletter-Anmeldung erhält nichts, und wer sich abmeldet, ist sofort aus jedem Segment draussen (der Versand prüft vor jeder Mail den Status des Abonnenten; die Zustellungen entstehen beim Start des Versands). Ein Segment «Mitgliedschaftsart» ohne Art (etwa nach dem Löschen der Art) ergibt keine Empfänger, nie stillschweigend alle Mitglieder. Der Editor zeigt die Empfängerzahl vorab (nur die Zahl, keine Adressen); der Versand steht im Änderungsprotokoll (`newsletter.send`).

## Sicherheit

- Jede Admin-Seite und jede Admin-Route dieses Moduls ruft als Erstes `requireModulePage` bzw. `requireAdmin` auf; `scripts/check-admin-guards.mts` prüft das.
- Alle Eingaben laufen durch Zod, die Einstellungs-Schemas sind `strict` (unbekannte Felder werden abgelehnt).
- Keine rohen HTML-Ausgaben; der QR-Code wird als SVG-Pfad gerendert.
- Die Prüfseite des Ausweises ist rate-limitiert und verrät bei ungültigem Code nichts über Personen.
- Links stammen aus `links.ts` (feste Basis-URL), nie aus dem Host-Header.
