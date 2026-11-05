# Anlässe und Termine

Das Modul Anlässe plant Veranstaltungen des Vereins, nimmt Anmeldungen von Mitgliedern und Gästen entgegen, führt eine Warteliste und stellt Kalenderdateien bereit. Wo Fristen oder Zugang betroffen sind, gelten die Statuten.

## Seiten und Routen

| Wer | Adresse | Zweck |
| --- | --- | --- |
| Vorstand | `/admin/events`, `/admin/events/new`, `/admin/events/[id]` | Anlässe anlegen, ändern, kopieren, absagen; Anmeldungen verwalten |
| Alle | `/anlaesse`, `/anlaesse/[id]` | öffentliche Liste und Detailseite mit Anmeldung (Gäste) bzw. Ein-Klick-Anmeldung (angemeldete Mitglieder) |
| Alle | `/anlaesse/kalender.ics`, `/anlaesse/[id]/termin.ics` | Kalender-Feed zum Abonnieren, Kalendereintrag eines Anlasses |
| Gast | `/anlaesse/[id]/abmelden?token=…` | Abmelden über den Link aus der Bestätigungsmail (erst der Klick meldet ab) |
| Mitglied | `/account/verein/anlaesse` | kommende Anlässe inkl. «nur für Mitglieder», an- und abmelden |
| System | `POST /api/events/reminders` | Erinnerungsmails (Cron, mit Geheimnis) |

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

## Abmelde-Link

Bei Gästen steht ein zufälliges Token (256 Bit) nur in der Bestätigungsmail. In der Datenbank liegt der SHA-256-Hash (`cancelTokenHash`). Das Token erlaubt nichts ausser dem Abmelden genau dieser Anmeldung. Meldet sich dieselbe Adresse noch einmal an, wird nichts doppelt gebucht und es geht eine neue Bestätigung mit neuem Link hinaus (der alte Link verfällt). Folgemails (Erinnerung, Nachrücken) verweisen auf den Link in der Bestätigung.

## Erinnerungen

- Von Hand: Auf der Seite eines veröffentlichten, noch nicht begonnenen Anlasses mit «Erinnerung senden». Jede Anmeldung wird höchstens einmal erinnert.
- Per Cron: `POST /api/events/reminders` mit `Authorization: Bearer <EVENTS_CRON_SECRET>`. Erinnert werden veröffentlichte Anlässe, die in den nächsten 36 Stunden beginnen. Ein täglicher Aufruf genügt:

```sh
curl -fsS -X POST -H "Authorization: Bearer $EVENTS_CRON_SECRET" https://vylaris.ch/api/events/reminders
```

Ohne `EVENTS_CRON_SECRET` (mindestens 24 Zeichen) antwortet die Schnittstelle mit 404.

## Datenschutz

- Gäste geben Name und E-Mail-Adresse an und bestätigen den Datenschutzhinweis (`consentAt`). Mehr wird nicht erhoben.
- Teilnehmerlisten (Ansicht und CSV-Export) sehen nur Rollen mit Leserecht auf Anlässe und Mitglieder. Jeder Export steht im Änderungsprotokoll (`export.registrations`). Zellen mit `=`, `+`, `-`, `@` am Anfang werden neutralisiert.
- Anmeldungen lassen sich einzeln samt Personendaten löschen. Wer den Anlass löscht, löscht auch dessen Anmeldungen.
- Im Änderungsprotokoll stehen Anlass-Änderungen (`event.*`) und Eingriffe des Vorstands in Anmeldungen (`registration.*`).
