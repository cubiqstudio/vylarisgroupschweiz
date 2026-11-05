# Anlässe und Termine

Das Modul Anlässe plant Veranstaltungen des Vereins, nimmt Anmeldungen von Mitgliedern und Gästen entgegen, führt eine Warteliste und stellt Kalenderdateien bereit. Wo Fristen oder Zugang betroffen sind, gelten die Statuten.

## Seiten und Routen

| Wer | Adresse | Zweck |
| --- | --- | --- |
| Vorstand | `/admin/events`, `/admin/events/new`, `/admin/events/[id]` | Anlässe anlegen, ändern, kopieren, absagen; Anmeldungen verwalten |
| Alle | `/anlaesse`, `/anlaesse/[id]` | öffentliche Liste und Detailseite mit Anmeldung (Gäste) bzw. Ein-Klick-Anmeldung (angemeldete Mitglieder) |
| Alle | `/anlaesse/kalender.ics`, `/anlaesse/[id]/termin.ics` | Kalender-Feed zum Abonnieren, Kalendereintrag eines Anlasses |
| Gast | `/anlaesse/bestaetigen/[token]` | E-Mail-Adresse bestätigen (Link aus der Mail; erst der Klick auf die Schaltfläche bestätigt) |
| Gast | `/anlaesse/[id]/abmelden?token=…` | Abmelden über den Link aus der Bestätigungsmail (erst der Klick meldet ab) |
| Mitglied | `/account/verein/anlaesse` | kommende Anlässe inkl. «nur für Mitglieder», an- und abmelden |
| System | `POST /api/events/reminders` | Erinnerungsmails (eigener Aufruf mit Geheimnis; der tägliche Lauf `POST /api/cron/daily` erledigt das ebenfalls) |
| Gast | `POST /api/events/[id]/guest`, `POST /api/events/confirm` | Anmeldung absenden, E-Mail-Adresse bestätigen |

Der Block `UpcomingEvents` (`src/components/events/upcoming.tsx`) zeigt die nächsten öffentlichen Anlässe auf der Startseite.

## Sichtbarkeit

| Einstellung | Wer sieht den Anlass | Wer kann sich anmelden |
| --- | --- | --- |
| Nur für Mitglieder | Mitgliederportal | aktuelle Mitglieder |
| Öffentlich, Anmeldung nur für Mitglieder | alle | aktuelle Mitglieder |
| Öffentlich, auch Gäste | alle | Mitglieder und Gäste (Name, E-Mail, Datenschutzhinweis) |

Entwürfe sieht nur der Vorstand. Gäste können sich nur bei öffentlichen Anlässen anmelden; das prüft der Server bei jeder Anmeldung.

## Plätze und Warteliste

- Die Kapazität zählt Personen inklusive Begleitung. Leer bedeutet unbegrenzt.
- Eine Anmeldung bekommt einen Platz, wenn genug frei sind, sonst kommt sie auf die Warteliste. Eine Anmeldung, die grösser ist als die ganze Kapazität, wird abgelehnt.
- Wird ein Platz frei (Abmeldung, Absage durch den Vorstand, Löschung, weniger Personen, höhere Kapazität), rücken Wartende in der Reihenfolge der Anmeldung nach. Passt eine grössere Gruppe nicht, bleibt sie vorn, und kleinere Gruppen dahinter dürfen die freien Plätze füllen. Nachgerückte erhalten eine Mail.
- Anmelden und Platzvergabe laufen in einer Transaktion, die den Anlass sperrt: Der letzte Platz wird nie doppelt vergeben.
- Der Vorstand kann die Kapazität bewusst überschreiten («Trotzdem anmelden»).

## Bestätigung der E-Mail-Adresse (Double-Opt-In für Gäste)

Gäste müssen ihre E-Mail-Adresse bestätigen. Mitglieder im Portal und Anmeldungen, die der Vorstand von Hand einträgt, brauchen das nicht.

1. **Absenden.** Die Anmeldung wird mit Status `UNBESTAETIGT` («E-Mail noch nicht bestätigt») gespeichert. Sie belegt **keinen Platz**, steht **nicht auf der Warteliste** und zählt weder zur Kapazität noch zur Teilnehmerzahl. Die Antwort an das Formular ist immer dieselbe, egal ob die Adresse neu oder schon bekannt ist.
2. **Mail.** An die Adresse geht ein signierter Link (`/anlaesse/bestaetigen/<Token>`). Das Token besteht aus Anmelde-ID, Ablaufzeit und einer HMAC-SHA256-Signatur (Geheimnis abgeleitet aus `AUTH_SECRET`), enthält keine Personendaten, wird nicht gespeichert und gilt **48 Stunden** ab Eingang (`CONFIRM_TTL_HOURS` in `events-lib.ts`).
3. **Klick.** Die Seite zeigt nur Anlass und Schaltfläche an (`GET` ändert nichts, damit Mail-Scanner, die Links vorab abrufen, nichts bestätigen). Erst die Schaltfläche löst `POST /api/events/confirm` aus. Dann wird in einer Transaktion, die den Anlass sperrt, ein Platz vergeben oder die Person auf die Warteliste gesetzt (gleichzeitige Bestätigungen überbuchen nie). Die Reihenfolge der Warteliste richtet sich nach dem Zeitpunkt der Bestätigung. Danach geht die Bestätigungsmail mit dem Abmelde-Link hinaus. Ein zweiter Klick ändert nichts («bereits bestätigt»).
4. **Erneut absenden.** Dieselbe Adresse für denselben Anlass erzeugt keine Dublette. Die Bestätigungsmail geht höchstens alle 5 Minuten erneut hinaus (`CONFIRM_RESEND_MINUTES`; zusätzlich Rate-Limits je IP und Adresse). Fremde offene Angaben werden dabei nicht überschrieben. Ist die alte unbestätigte Anmeldung abgelaufen, ersetzt die neue sie. Weil eine fremde offene Anmeldung für eine Adresse stehen bleibt, nennen die Bestätigungsmail und die Bestätigungsseite Name, Personenzahl und Bemerkung **so, wie sie in der Anmeldung stehen**, und weisen darauf hin, bei unbekannten Angaben nicht zu bestätigen (die Anmeldung verfällt dann von selbst).
5. **Aufräumen.** Nach 48 Stunden gilt eine unbestätigte Anmeldung als abgelaufen (nicht mehr bestätigbar, in den Zählern der Verwaltung ausgeblendet). Gelöscht wird sie samt Name, Adresse und Bemerkung im täglichen Lauf (`purgeExpiredUnconfirmedRegistrations()` in `events-confirm.ts`, Eintrag `registration.purge`) und zusätzlich beim Öffnen eines Anlasses in der Verwaltung. Weil der Lauf einmal täglich geschieht, sind es **spätestens drei Tage** nach der Anmeldung (`CONFIRM_PURGE_MAX_DAYS`); so steht es auch in Mail, Formular und Datenschutzerklärung.

Verwaltung: In der Anmeldungsliste stehen unbestätigte Gäste in einem eigenen Abschnitt «E-Mail noch nicht bestätigt» mit Zahl und Filter. Der Vorstand kann eine Anmeldung von Hand bestätigen (z. B. nach einem Anruf; Aktion `confirm`, Eintrag `registration.confirm`): Die Person erhält einen Platz oder kommt auf die Warteliste und bekommt die Bestätigung mit Abmelde-Link. Im CSV-Export steht der Status in der Spalte «Status» («E-Mail noch nicht bestätigt»). Bestehende Anmeldungen aus der Zeit vor der Einführung gelten als bestätigt (Status ändert sich nicht).

## Abmelde-Link

Bei Gästen steht ein zufälliges Token (256 Bit) nur in der Bestätigungsmail, die nach der Bestätigung der E-Mail-Adresse verschickt wird (vorher gibt es keinen Abmelde-Link). In der Datenbank liegt der SHA-256-Hash (`cancelTokenHash`). Das Token erlaubt nichts ausser dem Abmelden genau dieser Anmeldung. Meldet sich dieselbe Adresse noch einmal an, wird nichts doppelt gebucht und es geht eine neue Bestätigung mit neuem Link hinaus (der alte Link verfällt). Folgemails (Erinnerung, Nachrücken) verweisen auf den Link in der Bestätigung.

## Erinnerungen

- Von Hand: Auf der Seite eines veröffentlichten, noch nicht begonnenen Anlasses mit «Erinnerung senden». Jede Anmeldung wird höchstens einmal erinnert.
- Automatisch: Der tägliche Lauf (Dienst `cron`, 03:15 Uhr Zeit Europe/Zurich, siehe README «Täglicher Lauf» und `docs/verein-architektur.md`, Abschnitt «Hintergrundläufe») verschickt Erinnerungen für veröffentlichte Anlässe, die in den nächsten 36 Stunden beginnen. `install.sh` richtet ihn mit `CRON_SECRET` ein; es ist nichts weiter nötig.
- Eigener Aufruf (optional): `POST /api/events/reminders` mit `Authorization: Bearer <Geheimnis>`. Gültig ist `CRON_SECRET`; `EVENTS_CRON_SECRET` wird weiterhin akzeptiert, ist aber nur noch für bestehende Einrichtungen nötig:

```sh
curl -fsS -X POST -H "Authorization: Bearer $CRON_SECRET" https://vylaris.ch/api/events/reminders
```

Ohne eines der beiden Geheimnisse (mindestens 24 Zeichen) antwortet die Schnittstelle mit 404.

## Datenschutz

- Gäste geben Name und E-Mail-Adresse an und bestätigen den Datenschutzhinweis (`consentAt`). Mehr wird nicht erhoben. Die Anmeldung gilt erst nach der Bestätigung der E-Mail-Adresse; unbestätigte Anmeldungen verfallen nach 48 Stunden und werden im täglichen Lauf gelöscht, spätestens nach drei Tagen (`confirmSentAt` hält nur den letzten Versand der Bestätigungsmail fest).
- **Bestätigte Gast-Angaben** bleiben bis `GUEST_RETENTION_DAYS` (30 Tage) nach dem Ende des Anlasses. Dann leert die Tagesaufgabe `guest-data-anonymize` (`anonymizePastGuestRegistrations()` in `events-guests.ts`) Name, E-Mail-Adresse und Bemerkung; die Anmeldung bleibt als Zahl der Plätze und Status bestehen. Frühere Protokolleinträge zu diesen Anmeldungen werden unkenntlich gemacht, der Lauf steht mit Akteur «System» und ohne Namen im Protokoll (`registration.anonymize`).
- **Auskunft und Löschung für Gäste** (revDSG Art. 25): Gäste haben keine `memberId` und fehlen deshalb in der Auskunft über Mitglieder. Unter «Anlässe → Gäste: Auskunft und Löschung» (`/admin/events/gaeste`) findet der Vorstand alle Anmeldungen zu einer E-Mail-Adresse über alle Anlässe, kann die Auskunft als CSV beziehen (`GET /api/admin/events/guests?email=…&format=csv`, Recht «Mitglieder lesen», Eintrag `export.guest-disclosure`) und alle Anmeldungen zur Adresse löschen (`DELETE /api/admin/events/guests`, Recht «Anlässe ändern»; Eintrag `registration.guest-delete` ohne Name und Adresse). Freiwerdende Plätze gehen an die Warteliste.
- Teilnehmerlisten (Ansicht und CSV-Export) sehen nur Rollen mit Leserecht auf Anlässe und Mitglieder. Jeder Export steht im Änderungsprotokoll (`export.registrations`). Zellen mit `=`, `+`, `-`, `@` am Anfang werden neutralisiert.
- Anmeldungen lassen sich einzeln samt Personendaten löschen. Wer den Anlass löscht, löscht auch dessen Anmeldungen.
- Im Änderungsprotokoll stehen Anlass-Änderungen (`event.*`) und Eingriffe des Vorstands in Anmeldungen (`registration.*`, darunter `registration.confirm` und das automatische Aufräumen `registration.purge`).
