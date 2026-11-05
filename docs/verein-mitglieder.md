# Modul Mitglieder

Mitgliederverzeichnis, Beitrittsantrag, Ämter und Mitgliedschaft im Portal. Rechte, Konten und Konventionen stehen in `docs/verein-architektur.md`. Wo Statuten, Fristen oder Beiträge betroffen sind, gilt: Der Verein trägt sie selbst ein, die Statuten gehen vor.

## Seiten und Schnittstellen

| Bereich | Pfad | Recht |
| --- | --- | --- |
| Mitgliederliste (Suche, Filter, Sortierung, CSV) | `/admin/members` | `members` lesen |
| Mitglied erfassen | `/admin/members/new` | `members` ändern |
| Mitglied (Stammdaten, Aktionen, Ämter, Konto, Verlauf) | `/admin/members/[id]` | lesen / ändern |
| Mitgliedschaftsarten | `/admin/members/types` | lesen / ändern |
| Ämter und Vorstand | `/admin/members/offices` | lesen / ändern |
| API Verwaltung | `/api/admin/members/**` (`[id]`, `[id]/actions`, `types`, `offices`, `export`, `exits`, `search`) | Pfadmodul `members` |
| Beitrittsformular | `/mitglied-werden`, `POST /api/membership/apply` | öffentlich, nur wenn `verein.public.applyEnabled` |
| Mitgliedschaft im Portal | `/account/verein/mitgliedschaft`, `/api/account/verein/membership` (`GET`, `PATCH`, `exit`, `export`) | angemeldetes, verknüpftes Mitglied |

Code: `src/lib/verein/members-lib.ts` (rein: Austritt, Statusübergänge, Ämter, Verknüpfung, Anonymisierung, Export, Auskunft), `members-schemas.ts` (Zod), `members-data.ts` (Datenbank, Audit), `members-mail.ts` (Mails). Tests: `scripts/test/members.test.mts`.

## Ablauf

1. Antrag: Das Formular legt ein Mitglied mit Status `ANTRAG` an. Die Mitgliedernummer wird in derselben Transaktion vergeben (`nextMemberNumber`); sie wird nie neu vergeben, auch nicht nach einer Ablehnung. Pflicht sind Name, E-Mail und die Bestätigung von Statuten und Datenschutz (`consentAt`); Adresse und Telefon sind freiwillig, ein Geburtsdatum wird nicht abgefragt. Honeypot und Rate-Limit schützen das Formular; die Antwort ist immer gleich, auch wenn die Adresse schon bekannt ist.
2. Prüfung: Der Vorstand nimmt auf oder lehnt ab (Mail an die Person, abschaltbar). Über die Aufnahme entscheidet der Verein gemäss Statuten.
3. Austritt: Erfassung der Austrittserklärung (Verwaltung oder Portal) berechnet den frühesten Termin aus den Vereinseinstellungen (Voreinstellung ZGB Art. 70 Abs. 2: Ende Kalenderjahr, sechs Monate Frist; gemäss Statuten anpassen). Ein früherer Termin braucht eine ausdrückliche Bestätigung. Das Mitglied bleibt bis zum letzten Tag aktiv; danach wird der Austritt vollzogen (einzeln oder gesammelt über «Fällige Austritte vollziehen»).
4. Ausschluss, Tod: mit Begründung bzw. Datum, im Protokoll.
5. Personendaten entfernen: nur bei ehemaligen Mitgliedern und abgelehnten Anträgen, nur ohne offene Rechnung, mit Bestätigung durch die Mitgliedernummer. Mitgliedernummer, Status, Eintritts- und Austrittsdatum bleiben; Rechnungen und Buchungen bleiben unverändert (Aufbewahrung).

## Website-Konto

Verknüpft wird nur über eine bestätigte, identische E-Mail-Adresse bei einem aktiven Mitglied ohne Konto (`canAutoLink`), bei der Aufnahme, beim Erfassen, bei einer E-Mail-Änderung oder über `linkAccountByVerifiedEmail(userId)`. Mehrdeutige Adressen (mehrere Mitglieder) werden nie automatisch verknüpft. Der Vorstand kann ein bestätigtes Konto von Hand verknüpfen oder lösen. Ein Antrag wird nie automatisch verknüpft.

## Datenschutz

- Vorstandsnotizen (`boardNotes`) lesen und ändern nur Rollen mit `hasBoardRole`; sie stehen nie im Änderungsprotokoll.
- Im Änderungsprotokoll stehen Anschrift, Telefon, E-Mail, Geburtsdatum, Notizen und Austrittsgründe nur als Vermerk «geändert» (`AUDIT_MASKED_MEMBER_FIELDS`), weil auch Rollen ohne Zugriff auf Mitglieder (Revision) das Protokoll lesen.
- Der CSV-Export enthält weder Geburtsdatum noch Notizen, schützt vor Formel-Injektion und steht als `export.members` im Protokoll.
- Auskunft (revDSG): Mitglieder laden ihre Daten als JSON oder CSV herunter (`export.disclosure` im Protokoll). Interne Notizen sind nicht enthalten; der Hinweis verweist auf den Vorstand.
- Im Portal ändern Mitglieder nur Anschrift, Telefon, Anrede und Kontaktweg. Name und E-Mail ändert der Vorstand, weil das System keine E-Mail-Wechsel mit Bestätigung kennt.

## Einstellungen, die das Modul braucht

`verein.public.applyEnabled` (Formular an/aus), `verein.public.applyNotifyEmail` (Hinweis bei Anträgen und Austrittserklärungen), `verein.exit.*` und `verein.fiscal.*` (Austrittstermin), `verein.texts.welcomeMailText`, Absender und Signatur der Vereinsmails.
