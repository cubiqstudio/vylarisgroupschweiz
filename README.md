# VylarisGroup Schweiz – Website, Status-Portal & Admin-Dashboard

Eigenständige Software der **VylarisGroup Schweiz** ([vylaris.ch](https://vylaris.ch)). Die VylarisGroup ist ein nicht gewinnorientierter Verein: Stand September 2026 besteht er aus fünf Mitgliedern, drei davon im Vorstand. Er setzt strikt auf Open Source oder eigene Lösungen und bietet seine Web-Tools und SaaS-Dienste für jedermann kostenlos an («Sicherheit muss nichts kosten»).

Dieses Projekt ist die Website des Vereins mit Dienste-Portal, Preisseite, Status-Seite, Blog, Kontaktformular mit Ticket-System, Newsletter, Konten für Website-Nutzer, Lizenzverwaltung und einem Admin-Dashboard. Es ist **vollständig unabhängig** von der Software der VylarisGroupEurope, siehe [Unabhängigkeit von VylarisGroupEurope](#unabhängigkeit-von-vylarisgroupeurope).

Alles läuft selbstgehostet: kein Cloud-Auth-Anbieter, keine externen Fonts/CDNs, kein Tracking. Der einzige Cookie ist das Sitzungs-Cookie `vgs_session`, und es wird erst nach einer Anmeldung gesetzt. Zwei Einstellungen liegen lokal im Browser (`localStorage`, kein Cookie): die Wahl des Farbschemas (`vgs-theme`) und die Auswahl im Cookie-Hinweis (`vgs-consent-v1`).

## Inhalt

- **Öffentliche Seiten:** `/` (Start), `/services` (Dienste-Portal mit Kategoriefilter), `/preise` (Angebote), `/status` (Live-Status), `/about` (Über uns mit Vorstand), `/allianz` (Allianz der VylarisGroup), `/blog`, `/blog/[slug]`, `/contact` (Ticket-System), `/impressum` und `/datenschutz`, `/newsletter/confirm` und `/newsletter/unsubscribe` (Links aus den Newsletter-Mails)
- **Nur Deutsch:** Schweizer Hochdeutsch (kein Eszett, Anführungszeichen «…», Datum 5.11.2026, Zahlen und Währung nach de-CH, CHF). Die Texte stehen in Wörterbuchdateien unter `src/i18n/`. Die Struktur ist ein Erweiterungspunkt für weitere Landessprachen (Französisch, Italienisch); aktiv ist nur `de`.
- **Dunkelmodus:** Hell/Dunkel/System, umschaltbar im Footer, im Profil-Menü und im Admin; die Wahl gilt pro Gerät.
- **Konten für Website-Nutzer:** `/register` (Registrierung mit E-Mail-Bestätigung), `/verify-email`, `/login`, `/forgot-password` und `/reset-password` (Passwort-Reset per Mail), `/account` (Übersicht), `/account/settings` (Profil, Passwort ändern, Konto löschen), `/account/licenses` (Lizenzen, Webspace-Konto, Firmenkunde), `/account/team` (nur für Teammitglieder, sonst 404). Die Registrierung ist nur möglich, wenn im Admin ein Mailserver konfiguriert **und** die Registrierung aktiviert ist.
- **Gemeinsames Login:** `/login` für Admins **und** Website-Nutzer – Admins landen nach der Anmeldung im Dashboard, Nutzer im Konto. Es gibt kein öffentliches Admin-Login.
- **Team:** Der Admin kann Website-Konten unter `/admin/users` das Flag «Team» geben (mit Titel). Teammitglieder laden unter `/account/team` ein Profilbild hoch (höchstens 300 KB, nur für angemeldete Personen sichtbar) und sehen die Teamliste. Tickets lassen sich einem Teammitglied zuweisen; Antworten tragen Name und Profilbild des Autors.
- **E-Mails:** Konto-Mails, Ticket-Mails, Lizenz-Mails und Newsletter, siehe [E-Mails](#e-mails).
- **Newsletter:** Anmeldung mit Bestätigungsmail (Double-Opt-in), Kampagnen im Admin (Markdown), Versand gedrosselt im Hintergrund, Abmeldung mit einem Klick.
- **Lizenzen:** Schlüssel, Webspace-Konten und Firmenkunden mit Freigabe durch das Team, Prüf-API `POST /api/licenses/verify`, siehe [Lizenzen & Prüf-API](#lizenzen--prüf-api).
- **Admin-Dashboard:** `/admin` – Übersicht, Service- & Status-Manager (Status per Klick umschalten), Statusmeldungen/Wartungen, Blog-Editor (Markdown mit Live-Vorschau), Ticket-Inbox (Zuständigkeit, Antworten per Mail, Mail-Einstellungen für Tickets), Newsletter (Kampagnen, Abonnenten inkl. CSV-Export, Ein/Aus-Schalter), Lizenzen (Schlüssel, Webspace-Anträge, Produkte, API-Zugänge), Nutzerverwaltung (sperren, E-Mail manuell bestätigen, Bestätigungsmail erneut senden, Firmenkunden-Status, Team-Flag, löschen), **Einstellungen** (Impressum-Daten, E-Mail/SMTP inkl. Testmail, Registrierung ein/aus), Passwortwechsel
- **REST-API:** `/api/...` (öffentlich lesend + Kontakt + Newsletter + Konto-Funktionen; `/api/admin/...` nur mit Admin-Sitzung)
- **Datenbank:** Prisma ORM – SQLite lokal, PostgreSQL in Produktion
- **Deployment:** `Dockerfile` + `docker-compose.yml` (App + PostgreSQL), wahlweise mit Caddy (HTTPS) oder Cloudflare Tunnel

## Unabhängigkeit von VylarisGroupEurope

Das Projekt ist als Kopie der Software der VylarisGroupEurope entstanden und wird seither eigenständig betrieben und weiterentwickelt. Design, Komponenten und Systemfunktionen sind gleich geblieben; Identität, Texte und Sprache sind die der Schweiz. Beide Systeme sind technisch vollständig getrennt:

- **Eigene Datenbank:** Es gibt keine gemeinsame Datenbank und keine gemeinsamen Konten. Datenbankname, Volume und Container tragen den Namen dieses Projekts (`vylaris_schweiz`, `vylaris_schweiz_pgdata`, `vylaris-schweiz-app`, `-db`, `-caddy`, `-cloudflared`; Compose-Projekt `vylaris-schweiz`).
- **Eigene Cookies und Speicherschlüssel:** Sitzungs-Cookie `vgs_session`, Browser-Speicher `vgs-theme` und `vgs-consent-v1`. Die Präfixe der Europa-Software werden nicht verwendet.
- **Eigene Kennungen:** Lizenzschlüssel beginnen mit `VGS-`, API-Token der Prüf-API mit `vgsk_`, Ticket-IDs mit `VGS-`.
- **Keine Kopplung:** keine gemeinsame API, kein SSO, keine geteilten Umgebungsvariablen oder Geheimnisse. Jede Installation hat ihr eigenes `AUTH_SECRET`, ihre eigene `.env` und ihre eigene Domain (`vylaris.ch`, `www.vylaris.ch` leitet auf `vylaris.ch` um).
- **Keine Host-Umschaltung:** Die App bedient genau eine Seite. Die Basis-URL für Links kommt aus `SITE_URL`, nie aus dem Host-Header einer Anfrage.
- **Inhaltlich:** VylarisGroupEurope kommt nur als Inhalt der Allianz-Seite und höchstens als normaler externer Link vor.

## Tech-Stack

Next.js 15 (App Router, TypeScript) · React 19 · Tailwind CSS 4 · Lucide Icons · Prisma 6 · Zod 4 · `jose` (JWT) + `bcryptjs` (Passwort-Hashing) · `nodemailer` (SMTP-Versand) · `@fontsource/poppins` (selbst gehostete Schrift) · `react-markdown` (ohne rohes HTML).

---

## Schnellstart (lokal, SQLite)

Voraussetzung: Node.js ≥ 20 (getestet mit 22).

```bash
npm install
cp .env.example .env        # enthält funktionierende Entwicklungs-Defaults
npm run db:push             # legt das SQLite-Schema an (prisma/dev.db)
npm run db:seed             # Admin-Konto + Basisinhalte
npm run dev                 # http://localhost:3000
```

Produktions-Build testen:

```bash
npm run build
npm start
```

### Admin-Zugangsdaten (Entwicklung)

Admins und Website-Nutzer melden sich am **selben Login** an. `/admin/login` gibt es nicht; `/admin` ist ohne Admin-Sitzung ein **404** (die Middleware tut so, als existiere der Bereich nicht).

| | |
|---|---|
| URL | <http://localhost:3000/login> (danach automatisch Weiterleitung nach `/admin`) |
| E-Mail | `admin@vylaris.example` |
| Passwort | `ChangeMe-Vylaris-2026!` |

Beim Seed wird das Admin-Konto angelegt. Das Start-Passwort ist nur ein Entwicklungs-Default. Nach dem ersten Login erscheint ein Banner – bitte sofort unter **Admin → Konto** ändern (mind. 12 Zeichen, Gross-/Kleinbuchstaben und Ziffern). E-Mail und Passwort lassen sich vor dem Seeden über `ADMIN_EMAIL` / `ADMIN_PASSWORD` setzen. Im Produktionsbetrieb (`NODE_ENV=production`) bricht der Seed ab, wenn das Default-Passwort verwendet würde.

### Was der Seed anlegt

Der Seed (`prisma/seed.ts`) ist idempotent und überschreibt nie Änderungen aus dem Admin. Jeder Teil läuft nur einmal (Marker `seed.*` in `SiteSetting`; `SEED_FORCE=true` wiederholt alles):

- das Admin-Konto (Rolle Owner, Passwortwechsel beim ersten Login),
- **keine** Dienste, Infrastruktur-Komponenten, Vorfälle, Lizenz-Produkte oder Beispiel-Tickets: Diese Angaben werden im Admin mit den echten Daten erfasst, bis dahin zeigen die Seiten ihre Leerzustände,
- den ersten Blogbeitrag «In kleinen Schritten zum Ziel – Vereinsgründung» (Text in `src/i18n/blog-seed.ts`),
- die **Anbieterangaben** für Impressum und Datenschutz als Anfangswerte in den Einstellungen: Schützengasse 13, 9410 Heiden (AR), Schweiz, Telefon +41 78 322 21 39, E-Mail support@vylaris.ch (Umgebungsvariablen `LEGAL_*`/`CONTACT_EMAIL` haben Vorrang; im Admin gespeicherte Werte werden nie überschrieben),
- einen **Newsletter-Entwurf** (wird nicht versendet).

### Nützliche Skripte

| Befehl | Zweck |
|---|---|
| `npm run dev` / `build` / `start` | Entwicklung / Build / Produktionsserver |
| `npm run typecheck` | TypeScript-Prüfung (`tsc --noEmit`) |
| `npm run lint` | ESLint über `src` und `scripts` (`--max-warnings=0`) |
| `npm run test` | Lizenz-Bibliothek (`scripts/test/license-lib.test.mts`) und Shell-Tests für Installer und Cloudflare-Setup (brauchen root, `python3`, `jq`, `curl`, `openssl`; schreiben nur in ein Temp-Verzeichnis) |
| `npm run check` | Alles zusammen: typecheck, lint, `scripts/check-api-messages.mts`, test |
| `npm run db:push` | Schema in die Datenbank übertragen |
| `npm run db:seed` | Idempotenter Seed (überschreibt keine Admin-Änderungen) |
| `npm run db:reset` | **Löscht alle Daten**, legt Schema neu an und seedet |
| `npm run db:use-postgres` | Stellt `prisma/schema.prisma` auf PostgreSQL um (siehe unten) |
| `npx tsx scripts/check-api-messages.mts` | (Teil von `npm run check`) Prüft, ob die Meldungen der REST-API in Schweizer Schreibweise stehen (kein Eszett, «…» statt tiefgestellter Anführungszeichen) |
| `npx tsx scripts/test/license-lib.test.mts` | Tests der Schlüssel- und Signaturfunktionen (ohne Server/DB) |

---

## Konfiguration (Umgebungsvariablen)

Vorlagen: `.env.example` (Entwicklung) und `.env.production.example` (Docker/Produktion).

| Variable | Pflicht | Beschreibung |
|---|---|---|
| `DATABASE_URL` | ja | `file:./dev.db` (SQLite) bzw. `postgresql://user:pass@host:5432/db?schema=public` |
| `AUTH_SECRET` | in Produktion | Signiert die Sitzungen (Admins und Website-Nutzer), mind. 32 Zeichen (`openssl rand -base64 48`). Ohne Secret verweigert die Produktion den Login. **Verschlüsselt zusätzlich das SMTP-Passwort in der Datenbank** (AES-256-GCM): Wird `AUTH_SECRET` geändert, sind alle Sitzungen ungültig und das SMTP-Passwort muss im Admin neu eingegeben werden. |
| `COOKIE_SECURE` | – | Default: `true` in Produktion. Nur für lokale HTTP-Tests `false` setzen. |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD` | Seed | Zugangsdaten des ersten Admins (Default der E-Mail: `admin@vylaris.example`) |
| `SEED_ON_START` | Docker | `true` = Seed beim Containerstart. Der Seed legt die Basisinhalte (Blogbeitrag, Anbieterangaben, Newsletter-Entwurf) **nur beim ersten Start** an; Änderungen aus dem Admin werden nie überschrieben. |
| `TRUST_PROXY` | Docker | Woher die App die Client-IP für Rate-Limits nimmt: `cloudflare` = Header `CF-Connecting-IP` (Tunnel-Betrieb), `caddy` oder leer = `X-Forwarded-For` (Caddy bzw. Direktbetrieb hinter einem Proxy, der den Header selbst setzt). `docker-compose.cloudflare.yml` setzt `cloudflare`, `docker-compose.https.yml` setzt `caddy`; manuell nur nötig, wenn du die Overlays nicht verwendest. |
| `SITE_URL` | – | Öffentliche Basis-URL (Metadaten, Links in Mails). Ohne Angabe: in Produktion `https://vylaris.ch`, sonst `http://localhost:3000`. Sie wird nie aus dem Host-Header einer Anfrage gebildet. |
| `CLOUDFLARE_TUNNEL_TOKEN` | Tunnel-Modus | Token des Cloudflare Tunnels (von `scripts/cloudflare-setup.sh` in die `.env` geschrieben, ein Geheimnis). Siehe [Cloudflare Tunnel](#betrieb-über-cloudflare-tunnel). Der Cloudflare-**API**-Token wird nie gespeichert. |
| `CONTACT_EMAIL` | – | **Anfangswert** der Kontakt-Mailadresse für Impressum/Datenschutz (Vorgabe des Vereins: `support@vylaris.ch`) |
| `LEGAL_STREET`, `LEGAL_ZIP_CITY`, `LEGAL_COUNTRY`, `LEGAL_PHONE`, `LEGAL_REGISTER`, `LEGAL_VAT_ID` | vor Go-Live | **Anfangswerte** der Pflichtangaben für das Impressum (der Installer fragt sie ab, mit den Angaben des Vereins als Vorgabe). Was im Admin unter **Einstellungen → Rechtliches** gespeichert wird, hat Vorrang; leere Admin-Felder fallen auf diese Werte zurück. Fehlende Pflichtangaben erscheinen im Impressum als «Angabe ergänzen»; im Admin (**Einstellungen → Rechtliches**) weist ein Hinweis darauf hin, solange Strasse, PLZ/Ort oder Kontakt-E-Mail fehlen. |

**Nicht** in Umgebungsvariablen: Die SMTP-Zugangsdaten, der Schalter «Registrierung aktiv», der Newsletter-Schalter und die Ticket-Mail-Einstellungen (Eingangsbestätigung, Adresse für Hinweise des Teams) werden im Admin gepflegt und in der Datenbank gespeichert (Tabelle `SiteSetting`, das SMTP-Passwort verschlüsselt).

---

## Installation auf einem Server (empfohlen: ein Befehl, inkl. HTTPS)

Auf einem frischen Debian-/Ubuntu-Server (oder Fedora/RHEL) als root:

```bash
git clone https://github.com/cubiqstudio/vylarisgroupschweiz /opt/vylaris-schweiz
cd /opt/vylaris-schweiz
sudo ./install.sh
```

Der Installer

1. installiert die Abhängigkeiten (curl, git, openssl, dig) und Docker,
2. fragt, **wie die Seite erreichbar sein soll**: (1) eigene Domain mit automatischem HTTPS (Caddy, wie hier beschrieben) oder (2) **Cloudflare Tunnel** (siehe [Betrieb über Cloudflare Tunnel](#betrieb-über-cloudflare-tunnel)). Bei Variante 1 folgen die **Domain** (Vorgabe `vylaris.ch`, ohne `www`), eine E-Mail für Let's Encrypt und die Admin-Login-E-Mail,
3. fragt die **Impressum-Daten** ab (Anschrift, Telefon, Register, MWST-/UID-Nummer, Kontakt-E-Mail; Vorgabe sind die Angaben des Vereins, Enter übernimmt sie; siehe unten),
4. nennt dir die IP dieses Servers und **wartet, bis die A-Records von `vylaris.ch` und `www.vylaris.ch` darauf zeigen** (er prüft zusätzlich einen störenden AAAA-Record),
5. generiert alle Geheimnisse (`.env`, Rechte 600), startet App, PostgreSQL und Caddy und holt automatisch ein **Let's-Encrypt-Zertifikat** (Erneuerung automatisch),
6. prüft `https://<domain>/api/health` und zeigt dir die Admin-Zugangsdaten sowie die nächsten Schritte. Die Anmeldung erfolgt unter `https://<domain>/login`.

Voraussetzungen: eine Domain mit (änderbarem) DNS, ein Server mit öffentlicher IP, Ports **80 und 443** aus dem Internet erreichbar (auch in der Firewall/Security-Group deines Hosters), mindestens ca. 2 GB RAM (bei weniger bietet der Installer eine Swap-Datei an).

Weitere Befehle:

```bash
sudo ./install.sh --help                 # alle Optionen (--domain, --email, --staging, --yes, …)
sudo ./install.sh --staging              # Test mit der Let's-Encrypt-Testumgebung (ohne Rate-Limits)
sudo ./install.sh update                 # neueste Version holen und neu starten
```

### Impressum-Daten im Installer

Der Installer fragt nach: Strasse und Hausnummer, PLZ und Ort, Land, Telefon, Registereintrag, MWST-/UID-Nummer und Kontakt-E-Mail. Als Vorgabe stehen die öffentlich bekannten Angaben des Vereins (Schützengasse 13, 9410 Heiden (AR), Schweiz, +41 78 322 21 39, support@vylaris.ch); Register und MWST-/UID-Nummer sind leer, weil sie nicht bekannt sind. Alle Felder sind optional; `-` leert ein Feld. Die Eingaben werden geprüft (keine Zeilenumbrüche/Steuerzeichen, Längenlimits wie im Admin, gültige E-Mail; Anführungszeichen, Backslash, `$`, Backtick und `#` sind in der `.env` nicht erlaubt) und als `LEGAL_*` bzw. `CONTACT_EMAIL` in die `.env` geschrieben. Bei einem erneuten Lauf werden vorhandene Werte als Vorgabe angezeigt.

Diese Werte sind **Anfangswerte**: Änderungen erfolgen später im Admin unter **Einstellungen → Rechtliches** und haben Vorrang vor der `.env`. Ohne Rückfrage (`--yes` oder ohne Terminal) liest der Installer die Werte aus den Umgebungsvariablen `LEGAL_STREET`, `LEGAL_ZIP_CITY`, `LEGAL_COUNTRY`, `LEGAL_PHONE`, `LEGAL_REGISTER`, `LEGAL_VAT_ID` und `CONTACT_EMAIL` (bzw. der bestehenden `.env`):

```bash
sudo CONTACT_EMAIL=kontakt@example.org \
  ./install.sh --yes --domain vylaris.ch --email admin@example.org
```

### Nach der Installation

1. Unter `https://<domain>/login` mit den vom Installer ausgegebenen Admin-Zugangsdaten anmelden.
2. **Admin → Einstellungen → E-Mail:** SMTP-Server, Port, Verschlüsselung (keine / STARTTLS / SSL), Benutzer, Passwort und Absender eintragen und eine **Testmail** senden.
3. **Admin → Einstellungen:** die **Registrierung** für Website-Nutzer aktivieren (nur möglich, solange der Mailversand konfiguriert ist).
4. **Admin → Einstellungen → Rechtliches:** Impressum-Daten prüfen und ergänzen.
5. **Admin → Tickets → Einstellungen:** festlegen, ob Absender eine Eingangsbestätigung bekommen, und eine Adresse für Hinweise des Teams eintragen (neue Tickets sowie neue Lizenz-, Webspace- und Firmenkunden-Anträge).
6. Optional: den **Newsletter** unter **Admin → Newsletter** einschalten (nur möglich, solange der Mailversand konfiguriert ist).

Hinweise: Hinter Cloudflare-Proxy (orange Wolke) zeigt der A-Record nicht auf deinen Server – für die erste Ausstellung auf «nur DNS» stellen oder `--skip-dns-check` nutzen. Der Installer ist wiederholbar: bestehende Geheimnisse und Datenbank bleiben erhalten.

## Betrieb über Cloudflare Tunnel

Statt Caddy/Let's Encrypt kann die Seite über einen **Cloudflare Tunnel** (`cloudflared`) veröffentlicht werden. Der Server baut dabei nur eine ausgehende Verbindung zu Cloudflare auf: es muss **kein Port (80/443) geöffnet** werden, und es gibt kein Zertifikat auf dem Server. `vylaris.ch` und `www.vylaris.ch` laufen über den Tunnel zur App (`app:3000`); die App leitet `www.vylaris.ch` mit einer Weiterleitung (308) auf `vylaris.ch` um.

### Voraussetzungen

- Die Domain `vylaris.ch` ist bei **Cloudflare** angelegt (Nameserver bei der Registrierung auf Cloudflare gestellt, Zone «Aktiv»).
- Die Namen `vylaris.ch` und `www.vylaris.ch` haben noch **keine** A-/AAAA-/CNAME-Einträge (sonst bricht das Setup ab und fragt, ob sie ersetzt werden dürfen, siehe `--replace`).
- Ein Server mit Docker (der Installer richtet es ein), `curl` und `jq` (der Installer ergänzt beides bei Bedarf).

### API-Token erstellen

Unter <https://dash.cloudflare.com/profile/api-tokens> einen Token mit **genau diesen Rechten** anlegen:

| Bereich | Recht |
|---|---|
| Account → **Cloudflare Tunnel** | Bearbeiten |
| Zone → **DNS** | Bearbeiten |
| Zone → **Zone** | Lesen |

Die Zonen-Rechte auf die **Zone `vylaris.ch` beschränken** (Zone Resources → Include → Specific zone), den Account-Zugriff auf den passenden Account. Der Token wird nur für das Setup gebraucht: Er wird **nicht gespeichert** (weder in der `.env` noch sonstwo) und taucht weder in der Ausgabe noch in Prozessargumenten auf. **Nach dem Setup den Token bei Cloudflare löschen.**

### Ablauf mit dem Installer

```bash
sudo ./install.sh                 # Auswahl "2) Cloudflare Tunnel"; Token wird verdeckt abgefragt
sudo ./install.sh cloudflare      # Setup später erneut ausführen (neuer Token, Reparatur)
```

Der Installer lässt `scripts/cloudflare-setup.sh` laufen, setzt `COMPOSE_FILE=docker-compose.yml:docker-compose.cloudflare.yml`, überspringt die DNS-, Port- und Zertifikatsprüfungen des Caddy-Modus, startet App, Datenbank und `cloudflared` und prüft danach (mit Wiederholungen) die Erreichbarkeit über `https://<domain>/api/health`. Bestehende Caddy-Installationen und `install.sh update` funktionieren unverändert; `install.sh cloudflare` stellt eine Caddy-Installation nach Rückfrage auf den Tunnel um (Caddy wird entfernt).

Ohne Rückfragen (z. B. Automatisierung):

```bash
sudo CLOUDFLARE_API_TOKEN=<token> ./install.sh --yes --mode cloudflare --admin-email admin@vylaris.ch
sudo CLOUDFLARE_API_TOKEN=<token> ./install.sh cloudflare
```

### Das Setup-Skript direkt

`scripts/cloudflare-setup.sh` ist **idempotent** (beliebig oft ausführbar) und erledigt per Cloudflare-API:

1. Token prüfen und die Zone ermitteln,
2. Tunnel `vylaris-schweiz` suchen oder anlegen (Konfiguration in Cloudflare verwaltet),
3. Ingress setzen: `vylaris.ch` und `www.vylaris.ch` → `http://app:3000`, alles andere → 404,
4. für `vylaris.ch` und `www` je einen **proxied CNAME** auf `<tunnel-id>.cfargotunnel.com` anlegen bzw. aktualisieren,
5. `CLOUDFLARE_TUNNEL_TOKEN` in die `.env` schreiben (Rechte 600).

```bash
CLOUDFLARE_API_TOKEN=<token> scripts/cloudflare-setup.sh --dry-run     # nur anzeigen, was geändert würde
scripts/cloudflare-setup.sh --domain vylaris.ch --tunnel-name vylaris-schweiz --env-file .env
```

Ohne `CLOUDFLARE_API_TOKEN` fragt das Skript den Token verdeckt ab. Die Domain stammt aus `--domain`, sonst aus `DOMAIN` in der `.env`, sonst `vylaris.ch`. Bei vorhandenen A-/AAAA-/CNAME-Einträgen gleichen Namens, die nicht zum Tunnel passen, bricht es **vor jeder Änderung** ab (Exit-Code 3) und nennt die Einträge; mit `--replace` werden sie ersetzt. Fehlende Token-Rechte werden auf Deutsch benannt.

### Hinweise zum Betrieb

- `SITE_URL` kommt im Tunnel-Modus aus der `.env` (Installer: `https://<Domain>`, ohne Eintrag `https://vylaris.ch`), `COOKIE_SECURE=true`. Die App ist nur auf `127.0.0.1` gebunden und nicht öffentlich erreichbar.
- Logs: `docker compose logs -f cloudflared`. Im Cloudflare-Dashboard (Zero Trust → Networks → Tunnels) ist der Tunnel `vylaris-schweiz` mit seinen Hostnamen sichtbar.

### Tests

Ohne Internet und ohne Docker (Cloudflare-API und `docker` werden durch Attrappen ersetzt):

```bash
scripts/test/test-cloudflare-setup.sh     # cloudflare-setup.sh gegen einen API-Mock: Erstlauf, Idempotenz, Konflikt, falscher Token, fehlende Rechte, --dry-run, Token nie in Ausgabe/.env/Prozessliste
scripts/test/test-install-cloudflare.sh   # install.sh: Cloudflare-Modus, update, `cloudflare`, Caddy-Modus unverändert (als root)
```

## Deployment mit Docker (manuell, PostgreSQL)

```bash
cp .env.production.example .env
# Pflichtwerte eintragen: AUTH_SECRET, POSTGRES_PASSWORD, ADMIN_PASSWORD
# (LEGAL_* und CONTACT_EMAIL = Anfangswerte für das Impressum, später im Admin änderbar)
#   openssl rand -base64 48   (AUTH_SECRET)
#   openssl rand -hex 24      (POSTGRES_PASSWORD)
docker compose up -d --build
docker compose logs -f app
```

Was beim Start passiert (`docker/entrypoint.sh`): auf die Datenbank warten → `prisma db push` → optional Seed (`SEED_ON_START=true`) → `node server.js`. Das Dockerfile stellt das Prisma-Schema beim Build automatisch auf PostgreSQL um.

- Die App lauscht standardmässig nur auf `127.0.0.1:3000` und gehört **hinter einen Reverse Proxy mit HTTPS**. Mit `docker-compose.https.yml` (Caddy + Let's Encrypt für `DOMAIN` und `www.DOMAIN`) bekommst du das fertig dazu: `docker compose -f docker-compose.yml -f docker-compose.https.yml up -d --build` (benötigt `DOMAIN` und `ACME_EMAIL` in `.env`). PostgreSQL wird nicht nach aussen veröffentlicht. Alternativ veröffentlicht `docker-compose.cloudflare.yml` die App über einen Cloudflare Tunnel (ohne offene Ports, siehe oben).
- Healthcheck: `GET /api/health`.
- Daten liegen im Volume `vylaris_schweiz_pgdata` (Datenbank `vylaris_schweiz`). Backup: `docker compose exec db pg_dump -U vylaris vylaris_schweiz > backup.sql`.
- Der Seed legt die Basisinhalte nur beim ersten Start an und überschreibt später nichts; `SEED_ON_START=false` schaltet ihn ganz ab.

### Wichtig hinter einem Reverse Proxy

- **HTTPS** terminieren und `Host`, `X-Forwarded-Host`, `X-Forwarded-Proto` sowie `X-Forwarded-For` **setzen bzw. überschreiben** (nicht einfach durchreichen). Die Rate-Limits (Login, Kontaktformular) und der Same-Origin-Check stützen sich auf diese Header; ein Proxy, der vom Client mitgeschickte `X-Forwarded-For`-Werte ungeprüft weitergibt, macht die IP-basierten Limits umgehbar. Mit `TRUST_PROXY` (siehe Umgebungsvariablen) legst du fest, welchem Header die App die Client-IP entnimmt: `cloudflare` (Cloudflare Tunnel, `CF-Connecting-IP`) oder `caddy`/leer (`X-Forwarded-For`).
- Das Rate-Limiting läuft im Arbeitsspeicher des Prozesses (eine Instanz). Bei mehreren App-Instanzen zusätzlich am Proxy limitieren.
- `SITE_URL` auf die öffentliche `https://`-Adresse (`https://vylaris.ch`) setzen.

### Manuell auf PostgreSQL umstellen (ohne Docker)

```bash
npm run db:use-postgres     # ändert die provider-Zeile und generiert den Client neu
# DATABASE_URL auf PostgreSQL setzen, dann:
npm run db:push && npm run db:seed
```

Das Schema ist bewusst provider-neutral (keine Enums, keine nativen Typen); zulässige Werte der String-Felder stehen in `src/lib/constants.ts` und werden per Zod geprüft.

---

## Architektur

```
prisma/            schema.prisma (u. a. AdminUser, User, AuthToken, SiteSetting, Product, LicenseKey, WebspaceRequest, ApiClient, Newsletter*, ContactTicket, TicketReply), seed.ts
src/app/(site)/    öffentliche Seiten inkl. preise, allianz, login, register, verify-email, forgot-password, reset-password, newsletter/*, account (Übersicht, settings, licenses, team)
src/app/admin/     geschütztes Panel (Route-Group "(panel)"): Übersicht, Services, Status, Blog, Tickets, Newsletter, Lizenzen, Benutzer, Einstellungen, Konto
src/app/api/       REST-Endpunkte (auth, account, admin, licenses, newsletter, öffentliche Daten)
src/components/    ui/ (Design-System), site/, home/, services/, status/, about/, allianz/, legal/, blog/, contact/, newsletter/, consent/, theme/, account/, licenses/, team/, admin/
src/i18n/          Wörterbücher je Bereich (aktiv: de, Struktur für weitere Sprachen), getMessages/useMessages
src/lib/           db, session (Edge/jose), auth, settings, legal, sites (Stammdaten des Vereins), site, mailer, mail-ctx/-layout/-templates, ticket-mail, license-mail, newsletter, licenses, tokens, crypto, api-Helfer, validation (Zod), constants, status, rate-limit
src/middleware.ts  leitet www.vylaris.ch auf vylaris.ch um (308), schützt /admin/*, /api/admin/* (nur Admin-Sitzung, sonst 404 bzw. 401) sowie /account/*, /api/account/* (jede Sitzung)
docs/              license-api.md (Lizenzen und Prüf-API)
scripts/           cloudflare-setup.sh, Beispiel-Client für die Prüf-API, Prüf- und Testskripte
```

- **Datenmodell:** `AdminUser` (Admin-Konten, getrennt von den Website-Nutzern), `User` (Website-Konten mit E-Mail-Bestätigung, Sperr-Flag, Sprache der Registrierung, Firmenkunden-Status, Team-Flag mit Profilbild), `AuthToken` (Einmal-Tokens für E-Mail-Bestätigung, 48 h gültig, und Passwort-Reset, 1 h gültig – in der DB steht nur der SHA-256-Hash) und `SiteSetting` (Key/Value-Einstellungen aus dem Admin: Impressum-Daten, SMTP, Registrierungs- und Newsletter-Schalter, Ticket-Mail-Einstellungen; Geheimnisse verschlüsselt). Dazu kommen die Tabellen für Tickets, Newsletter und Lizenzen.
- **Authentifizierung:** Ein gemeinsamer Login (`POST /api/auth/login`) für Admins und Nutzer. Passwort → bcrypt (Cost 12) → JWT (HS256) im `httpOnly`-Cookie `vgs_session` (`SameSite=Lax`, `Secure` in Produktion); Gültigkeit: Admin 8 Stunden, Website-Nutzer 14 Tage. Die Middleware prüft die Signatur und die Art der Sitzung: `/admin` und `/api/admin` verlangen eine Admin-Sitzung (ohne sie antwortet die Seite mit 404, die API mit 401), `/account` jede Sitzung. Jeder Handler prüft zusätzlich gegen die Datenbank, ob das Konto noch existiert (und nicht gesperrt ist). Schreibende Requests mit fremdem `Origin` werden abgelehnt.
- **Registrierung:** Ein Konto wird erst nach Klick auf den Bestätigungslink in der E-Mail nutzbar. Die Registrierung ist nur aktiv, wenn der Schalter im Admin gesetzt **und** SMTP konfiguriert ist; Registrierung, Bestätigungsmail erneut senden und Passwort-Reset sind rate-limitiert, antworten möglichst ohne zu verraten, ob eine Adresse bereits registriert ist, und enthalten ein Honeypot-Feld gegen Bots. Das SMTP-Passwort wird mit einem aus `AUTH_SECRET` abgeleiteten Schlüssel verschlüsselt gespeichert.
- **Status:** Der Gesamtstatus ist der «schlechteste» Status aller Komponenten (`OUTAGE` > `MAINTENANCE` > `OPERATIONAL`). Die Werte werden **manuell im Admin gepflegt** – es gibt keine automatischen Messungen. Die Status-Seite weist darauf mit «Zuletzt aktualisiert» hin.
- **Tickets:** Das Kontaktformular speichert direkt in der eigenen Datenbank (mit Sprache der Anfrage) und gibt eine Ticket-ID (`VGS-JJJJ-XXXXXX`) zurück. Anfragen erscheinen in `/admin/tickets`; dort lassen sich Status, Notiz und Zuständigkeit (Teammitglied) pflegen und Antworten schreiben. Mails dazu siehe [E-Mails](#e-mails). Security-Reports sind nur für Admins sichtbar, nicht für Teammitglieder. Für Teammitglieder gibt es Ticket-Endpunkte unter `/api/account/team/tickets`.
- **Rechtliches:** Impressum und Datenschutzerklärung folgen Schweizer Recht (revidiertes Datenschutzgesetz, Aufsicht durch den EDÖB). Anschrift, Telefon und Kontakt-E-Mail kommen aus den Admin-Einstellungen (Anfangswerte aus dem Seed bzw. der `.env`), nicht aus dem Code.

### E-Mails

Versand über `nodemailer` mit den SMTP-Daten aus dem Admin. Ohne Mailserver wird nichts versendet, das System läuft trotzdem weiter. Alle Mails nutzen ein gemeinsames Layout, escapen Nutzereingaben und haben einen einzeiligen Betreff. Links in den Mails führen auf die Adresse aus `SITE_URL`.

| Mail | Empfänger | Auslöser |
|---|---|---|
| Bestätigung der E-Mail-Adresse, Passwort-Reset, «Konto existiert bereits» | Nutzer | Registrierung bzw. Passwort-Reset |
| Eingangsbestätigung mit Ticket-ID | Absender des Tickets | neues Ticket über das Kontaktformular, abschaltbar unter **Admin → Tickets → Einstellungen** (Standard: an) |
| Hinweis auf neues Ticket | Adresse aus **Admin → Tickets → Einstellungen** (leer = keine Mail) | neues Ticket |
| Statusänderung | Absender des Tickets | Statuswechsel im Admin, nur wenn dort «benachrichtigen» gewählt ist |
| Antwort auf das Ticket | Absender des Tickets | Antwort im Admin bzw. durch ein Teammitglied |
| Schlüssel freigegeben / abgelehnt / gesperrt, Webspace-Konto freigegeben / abgelehnt, Firmenkunde freigegeben / abgelehnt | Nutzer | Entscheidung im Admin; ein Hinweis des Teams steht in der Mail, der Lizenzschlüssel nie |
| Hinweis auf neuen Schlüssel-Antrag (nur Freigabemodus `MANUAL`), Webspace-Konto-Antrag, Firmenkunden-Antrag | Adresse aus **Admin → Tickets → Einstellungen** (leer = keine Mail) | neuer Antrag |
| Newsletter-Bestätigung (Double-Opt-in) und Kampagnen | Abonnenten | Anmeldung bzw. Versand einer Kampagne im Admin |

Mails zu Tickets, Lizenzen und Konto-Vorgängen werden im Hintergrund versendet; ein Mailfehler verzögert die Antwort der Seite nicht und lässt keine Entscheidung scheitern. Nachrichteninhalte und Adressen werden nicht protokolliert.

### Newsletter

Anmeldung auf der Website nur, wenn der Newsletter im Admin eingeschaltet und ein Mailserver eingerichtet ist. Ablauf: Anmeldung → Bestätigungsmail (Link 48 Stunden gültig) → erst danach erhält die Adresse Kampagnen. Jede Mail enthält einen Abmeldelink (und den Header `List-Unsubscribe` für die Abmeldung mit einem Klick). Kampagnen werden im Admin als Markdown geschrieben (mit Vorschau und Testmail). Der Versand läuft gedrosselt im Hintergrund.

### API-Überblick

Antwortformat: Erfolg `{ "data": … }`, Fehler `{ "error": { "code", "message", "fields?" } }`.

| Öffentlich | |
|---|---|
| `GET /api/health` | Gesundheitscheck inkl. DB |
| `GET /api/services?category=&featured=1` | Dienste |
| `GET /api/status` | Gesamtstatus, Komponenten, Dienste, Meldungen |
| `GET /api/blog`, `GET /api/blog/[slug]` | veröffentlichte Beiträge |
| `POST /api/contact` | Ticket anlegen (Rate-Limit 5/Std./IP) |
| `POST /api/newsletter/subscribe`, `/confirm`, `/unsubscribe` | Newsletter anmelden, bestätigen, abmelden (rate-limitiert) |
| `POST /api/auth/login`, `POST /api/auth/logout`, `GET /api/auth/me` | gemeinsame Session für Admins und Nutzer (Login liefert `redirect`: `/admin` oder `/account`) |
| `POST /api/auth/register`, `/verify`, `/resend` | Registrierung, E-Mail bestätigen, Bestätigungsmail erneut senden (rate-limitiert) |
| `POST /api/auth/forgot`, `/reset` | Passwort-Reset anfordern bzw. mit Token setzen (rate-limitiert) |
| `POST /api/licenses/verify` | Lizenz prüfen (Bearer-Token eines API-Zugangs, signierte Antwort, siehe [Lizenzen & Prüf-API](#lizenzen--prüf-api)) |
| `GET /api/avatar/[id]` | Profilbild eines Teammitglieds (nur mit Sitzung) |

| Konto (beliebige Sitzung) | |
|---|---|
| `GET/PATCH/DELETE /api/account` | eigenes Profil lesen, Namen ändern, Konto löschen |
| `PATCH /api/account/password` | Passwort ändern |
| `GET/POST /api/account/licenses` | eigene Produkte, Schlüssel und Anträge lesen bzw. Schlüssel beantragen |
| `POST /api/account/webspace` · `POST /api/account/business` | Webspace-Konto bzw. Firmenkunden-Status beantragen |
| `POST/DELETE /api/account/avatar` | Profilbild hochladen bzw. entfernen (nur Teammitglieder) |
| `/api/account/team/tickets[/id]` · `/reply` | Ticket-Liste, -Bearbeitung und -Antwort für Teammitglieder |

| Admin (Cookie nötig) | |
|---|---|
| `/api/admin/services[/id]` · `/blog[/id]` · `/metrics[/id]` · `/incidents[/id]` | CRUD |
| `/api/admin/tickets[/id]` · `/tickets/[id]/reply` | Liste (Filter, Suche, Pagination), Status/Notiz/Zuständigkeit ändern, löschen, per Mail antworten |
| `/api/admin/newsletter/…` | Kampagnen (anlegen, bearbeiten, Testversand, Versand), Vorschau, Abonnenten (inkl. CSV-Export), Ein/Aus-Schalter |
| `/api/admin/licenses[/id]` · `/webspace-requests[/id]` · `/products[/id]` · `/api-clients[/id]` | Lizenzen: Schlüssel und Anträge entscheiden, Produkte und API-Zugänge verwalten |
| `/api/admin/stats` | Kennzahlen für die Übersicht |
| `PATCH /api/admin/account/password` | Admin-Passwort ändern |
| `/api/admin/settings` · `/settings/legal` · `/settings/mail` · `/settings/site` · `/settings/tickets` | Einstellungen lesen bzw. (PUT) speichern: Impressum-Daten, SMTP, Registrierung ein/aus, Ticket-Mails |
| `POST /api/admin/settings/mail/test` | Testmail mit den gespeicherten SMTP-Daten senden |
| `/api/admin/users[/id]` · `POST /api/admin/users/[id]/resend-verification` | Website-Nutzer: Liste, sperren/bestätigen, Firmenkunden-Status, Team-Flag, löschen, Bestätigungsmail erneut senden |

---

## Lizenzen & Prüf-API

Nutzer beantragen unter **Konto → Lizenzen** Lizenzschlüssel für Produkte (je Nutzer und Produkt einer). Webspace-Schlüssel gibt es nur für freigegebene Firmenkunden, alle anderen können ein Webspace-Konto beantragen; die Freigabe ist je Produkt `AUTO` oder `MANUAL` und wird im Admin unter **Lizenzen** verwaltet. Programme prüfen Schlüssel über `POST /api/licenses/verify` mit Bearer-Token; die Antwort ist HMAC-signiert, der Schlüssel wird an eine Installation gebunden und liegt nie im Klartext in der Datenbank.

Entscheidungen im Admin (Schlüssel freigegeben/abgelehnt/gesperrt, Webspace-Konto, Firmenkunde) schickt das System als Mail an den Nutzer, mit Link auf `/account/licenses`. Der Schlüssel selbst steht nie in einer Mail. Neue wartende Anträge melden sich per Mail beim Team (Adresse unter **Admin → Tickets → Einstellungen**).

- Dokumentation (Ablauf, Sicherheitskonzept, API, Signaturprüfung, Mails): [`docs/license-api.md`](docs/license-api.md)
- Beispiel-Client (Node, mit curl- und PHP-Beispiel): `node scripts/license-client-example.mjs`
- Tests der Schlüssel- und Signaturfunktionen (ohne Server/DB): `npx tsx scripts/test/license-lib.test.mts`
- **`AUTH_SECRET` darf nie geändert werden**: Schlüssel-Hashes, Schlüssel-Verschlüsselung und Signierschlüssel hängen daran, eine Änderung macht alle ausgegebenen Schlüssel ungültig.

## Vor dem Go-Live

1. `AUTH_SECRET`, `POSTGRES_PASSWORD`, `ADMIN_PASSWORD` setzen; Admin-Passwort nach dem ersten Login ändern. `AUTH_SECRET` danach nicht mehr ändern (sonst SMTP-Passwort im Admin neu eingeben).
2. Impressum-Daten (Installer-Abfrage bzw. `LEGAL_*`/`CONTACT_EMAIL` als Anfangswerte, später im Admin unter **Einstellungen → Rechtliches**) prüfen und vervollständigen. Register- und MWST-/UID-Nummer sind leer, solange sie nicht bekannt sind. Fehlende Pflichtangaben erscheinen im Impressum als «Angabe ergänzen».
3. **E-Mail einrichten:** Admin → Einstellungen → E-Mail (SMTP) ausfüllen, Testmail senden; dann die **Registrierung** aktivieren und unter **Tickets → Einstellungen** die Adresse für Hinweise des Teams eintragen. Absender-Domain mit SPF/DKIM beim Mail-Anbieter einrichten, damit Bestätigungsmails nicht im Spam landen. Datenschutzerklärung prüfen, da nun Konten mit Personendaten (Name, E-Mail) gespeichert werden (bei Newsletter zusätzlich die Einwilligung).
4. **Inhalte erfassen:** Dienste, Infrastruktur-Komponenten und Vorfälle sowie Lizenz-Produkte legt der Seed nicht an; sie werden im Admin mit den echten Angaben erfasst. Den Newsletter-Entwurf prüfen, bevor er versendet wird.
5. HTTPS-Reverse-Proxy einrichten (siehe oben) und `COOKIE_SECURE=true` belassen.
6. Login prüfen: `/admin` ohne Anmeldung muss 404 liefern, `/login` funktioniert für Admin und Nutzer.
7. `https://www.vylaris.ch` muss auf `https://vylaris.ch` umleiten.
8. Backups für das Postgres-Volume einrichten.

## Lizenz & Mitwirkung

Der Quellcode soll – dem Leitbild der VylarisGroup entsprechend – quelloffen veröffentlicht werden. Eine Lizenzdatei ist noch nicht enthalten und muss vom Vorstand festgelegt werden.
