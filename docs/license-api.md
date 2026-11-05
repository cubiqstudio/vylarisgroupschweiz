# Lizenzen & Prüf-API

Diese Seite beschreibt, wie Lizenzschlüssel vergeben und verwaltet werden, wie sie gesichert sind und wie Programme (Autoinstaller, Webspace-Backend) einen Schlüssel per API prüfen. Massgeblich ist der Code in `src/lib/licenses.ts` und `src/app/api/licenses/verify/route.ts`.

> **Wichtig: `AUTH_SECRET` niemals ändern.**
> Aus `AUTH_SECRET` werden drei Dinge abgeleitet: der **Hash der Schlüssel** (zum Nachschlagen), die **Verschlüsselung der Schlüssel** in der Datenbank (zur Anzeige für den Besitzer) und die **Signierschlüssel aller API-Zugänge**. Ändert sich `AUTH_SECRET`, passen die gespeicherten Hashes nicht mehr zu den Schlüsseln: **jeder bereits ausgegebene Schlüssel wird ungültig**, die Schlüssel sind für Nutzer nicht mehr einsehbar, und **alle Signaturen** der Prüf-API stimmen nicht mehr mit den bei den Clients hinterlegten Signierschlüsseln überein. Das lässt sich nicht rückgängig machen, ausser das alte `AUTH_SECRET` wird wieder eingesetzt. Das Secret also sichern (Backup) und nie rotieren.

## 1. Überblick

### Nutzer-Ablauf

Angemeldete Nutzer mit bestätigter E-Mail-Adresse finden unter **Konto → Lizenzen** alle aktiven Produkte. Je Nutzer und Produkt gibt es genau **einen** Schlüssel.

| Fall                                                                                | Was der Nutzer tun kann                                                                                                                     |
| ----------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| Normales Produkt (z. B. Autoinstaller)                                              | Schlüssel beantragen.                                                                                                                       |
| Produkt nur für Firmenkunden (Webspace), Nutzer ist **freigegebener Firmenkunde**   | Schlüssel beantragen.                                                                                                                       |
| Produkt nur für Firmenkunden, Nutzer ist **kein** Firmenkunde, Konto-Antrag erlaubt | Stattdessen ein **Webspace-Konto** beantragen (läuft über VylarisGroup; Freigabe oder Ablehnung durch das Team, mit Hinweis an den Nutzer). |
| Produkt nur für Firmenkunden, kein Konto-Antrag erlaubt                             | Nichts; Hinweis, dass es Schlüssel nur für Firmenkunden gibt.                                                                               |
| Produkt deaktiviert                                                                 | Nichts.                                                                                                                                     |

**Firmenkunde werden:** Der Nutzer gibt unter Lizenzen einen Firmennamen an (`NONE` → `PENDING`). Das Team gibt frei (`APPROVED`) oder lehnt ab (`REJECTED`). Danach kann der Nutzer Webspace-Schlüssel beantragen.

**Freigabe je Produkt** (im Admin einstellbar):

- `AUTO`: Der Schlüssel ist sofort aktiv und für den Nutzer sichtbar.
- `MANUAL`: Der Antrag steht auf `PENDING`, bis das Team ihn freigibt (`ACTIVE`) oder ablehnt (`REJECTED`). Ein abgelehnter Antrag kann erneut gestellt werden.

Schlüsselstatus: `PENDING` (wartet), `ACTIVE` (gültig), `REVOKED` (gesperrt), `REJECTED` (abgelehnt). Die Produkte dürfen noch «bald verfügbar» (`comingSoon`) sein; Schlüssel sind trotzdem schon beantragbar.

### Admin-Ablauf

Im Admin unter **Lizenzen**:

- **Schlüssel:** Anträge freigeben/ablehnen, aktive Schlüssel sperren, gesperrte wieder aktivieren, die **Bindung** an eine Installation zurücksetzen (z. B. nach einem Serverumzug).
- **Webspace-Anträge:** freigeben oder ablehnen, optional mit Hinweis an den Nutzer.
- **Produkte:** anlegen und bearbeiten (Slug, Code, Name, Freigabemodus `AUTO`/`MANUAL`, nur Firmenkunden, Konto-Antrag erlaubt, aktiv, «bald verfügbar»).
- **API-Zugänge:** Zugänge für Programme anlegen (Name, erlaubte Produkte). Beim Anlegen werden **API-Token** und **Signierschlüssel einmalig** angezeigt und müssen sofort gesichert werden. Ein Zugang lässt sich deaktivieren oder löschen.
- **Firmenkunden** werden unter **Benutzer** freigegeben, abgelehnt oder zurückgesetzt.

### E-Mails

Die E-Mails werden im Hintergrund versendet (`src/lib/license-mail.ts`). Ein Mailfehler lässt eine Entscheidung nie scheitern und verzögert die Antwort nicht. Ist kein Mailserver eingerichtet, passiert nichts.

**An den Nutzer** (in der Sprache des Kontos; der Link führt auf `/account/licenses` der Seite):

- Schlüssel freigegeben, abgelehnt oder gesperrt,
- Webspace-Konto freigegeben oder abgelehnt,
- Firmenkunde freigegeben oder abgelehnt (nur bei tatsächlicher Statusänderung).

Wurde beim Entscheiden ein Hinweis des Teams (`adminNote`) eingetragen, steht er in der Mail. **Der Lizenzschlüssel selbst steht nie in einer Mail**, die Mail verweist nur darauf, ihn im Konto anzusehen. Die Wiederaktivierung eines gesperrten Schlüssels und das Zurücksetzen der Bindung lösen keine Mail aus; ein sofort ausgestellter Schlüssel (`AUTO`) ebenfalls nicht.

**An das Team** (Links auf die in `SITE_URL` eingestellte Adresse): bei einem neuen wartenden Schlüssel-Antrag (nur Produkte mit `MANUAL`), einem neuen Webspace-Konto-Antrag und einem neuen Firmenkunden-Antrag. Empfänger ist die Adresse, die im Admin unter **Tickets → Einstellungen** für Hinweise bei neuen Tickets hinterlegt ist; ohne diese Adresse wird nichts gesendet. Die Mail enthält nur Name, E-Mail, Produkt bzw. Firma und die gekürzte Nachricht sowie einen Link ins Admin (`/admin/licenses?tab=keys`, `/admin/licenses?tab=webspace` bzw. `/admin/users`).

## 2. Sicherheitskonzept

| Massnahme                         | Umsetzung                                                                                                                                                                                                                                                                                                                                   |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Nicht erratbare Schlüssel**    | Format `VGS-<CODE>-XXXXX-XXXXX-XXXXX-XXXXX`. Die 20 Zeichen stammen aus einem Alphabet mit 32 Zeichen (ohne `I` und `O`) und tragen je genau 5 Bit: **100 Bit** Zufall aus `crypto.randomBytes`. Das Raten ist praktisch ausgeschlossen. `CODE` ist das 3–4-stellige Produktkürzel (`WEB`, `AIN`).                                           |
| **Kein Klartext in der DB**      | Gespeichert werden nur ein **HMAC-SHA256-Hash** des Schlüssels (`keyHash`, zum Nachschlagen; Schlüssel des HMAC aus `AUTH_SECRET` abgeleitet) und der Schlüssel **AES-256-GCM-verschlüsselt** (`keyEnc`, damit der Besitzer ihn im Dashboard wiedersehen kann, nur solange er aktiv ist). Ein Datenbank-Dump allein verrät keine Schlüssel. |
| **API-Token nur als Hash**       | Das Token (`vgsk_…`, 256 Bit Zufall) wird nur als SHA-256-Hash gespeichert und nur einmal angezeigt. Zur Wiedererkennung gibt es die ersten 8 Zeichen. Zugänge sind auf einzelne Produkte beschränkbar und jederzeit sperrbar.                                                                                                               |
| **Schlüssel nur im POST-Body**   | Nie in URLs (Logs, Referrer, Browserverlauf). Die Antworten sind mit `Cache-Control: no-store` markiert. Es gibt kein CORS: die API ist für Server-Programme gedacht, nicht für Browser.                                                                                                                                                    |
| **Signierte Antworten**          | Jede Antwort trägt eine HMAC-SHA256-Signatur über alle Felder samt `nonce` und `ts`. Clients erkennen so manipulierte, fremde oder wieder eingespielte Antworten. Der Signierschlüssel gehört zum API-Zugang und wird nie übertragen.                                                                                                       |
| **Bindung an die Installation**  | Bei der ersten erfolgreichen Prüfung mit `instance` wird der Schlüssel an diese Installation gebunden. Danach gilt er nur dort; andere Installationen erhalten `instance_mismatch`. Der Vergleich ist zeitkonstant. Das Team kann die Bindung zurücksetzen.                                                                                 |
| **Rate-Limits**                  | Siehe Abschnitt 3 («Fehlercodes und Limits»). Fehlversuche (falsches Token, falsch formatierte oder unbekannte Schlüssel) werden strenger begrenzt als gültige Prüfungen.                                                                                                                                                                   |
| **Einheitliche Fehlerantworten** | Unbekannter Schlüssel, falsches Produkt, wartender oder abgelehnter Antrag, deaktiviertes Produkt, für den Zugang nicht erlaubtes Produkt, falsch formatierter Schlüssel: **alle** liefern dieselbe Antwort `valid:false, reason:"invalid"`. So lässt sich nicht herausfinden, welche Schlüssel existieren.                                 |
| **HTTPS nötig**                  | Das Token und die Schlüssel laufen im Klartext durch die Verbindung; ohne TLS kann jeder mitlesen. Die API daher nur über HTTPS aufrufen (der Beispiel-Client verweigert `http://` ausser für localhost) und keine Weiterleitungen folgen, damit das Token nicht an einen anderen Host geht.                                                 |

## 3. Die Prüf-API

### Anfrage

```
POST /api/licenses/verify
Authorization: Bearer vgsk_…
Content-Type: application/json
```

```json
{
  "key": "VGS-WEB-ABCDE-FGHJK-LMNPQ-RSTUV",
  "product": "webspace",
  "instance": "meine-domain.example",
  "nonce": "3f9c1c6a0b7e4d52a1d8e6f40b92c7aa"
}
```

| Feld       | Pflicht   | Beschreibung                                                                                                                                                                                                                                |
| ---------- | --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `key`      | ja        | Lizenzschlüssel (höchstens 60 Zeichen). Leerzeichen und Kleinbuchstaben werden toleriert.                                                                                                                                                   |
| `product`  | ja        | Produkt-Slug, z. B. `webspace` oder `autoinstaller` (Kleinbuchstaben, Ziffern, Bindestrich).                                                                                                                                                |
| `instance` | empfohlen | Kennung der Installation (1–200 Zeichen), z. B. Domain oder Server-ID. Beim ersten Prüfen wird der Schlüssel daran gebunden. **Ohne `instance` bindet der Schlüssel nicht**; ist er schon gebunden, lautet die Antwort `instance_required`. |
| `nonce`    | ja        | Zufallswert der Anfrage, 8–64 Zeichen aus `A-Z a-z 0-9 _ -`. Pro Anfrage neu erzeugen (z. B. 16 Zufallsbytes als Hex).                                                                                                                      |

Unbekannte Felder werden abgelehnt (422). Der Body darf höchstens 2048 Zeichen gross sein.

### Erfolgreiche Antwort (HTTP 200)

```json
{
  "data": {
    "valid": true,
    "reason": null,
    "product": "webspace",
    "status": "ACTIVE",
    "instance": "meine-domain.example",
    "nonce": "3f9c1c6a0b7e4d52a1d8e6f40b92c7aa",
    "ts": 1767225600,
    "signature": "9d1b…(64 Hex-Zeichen)"
  }
}
```

| Feld                           | Bedeutung                                                                              |
| ------------------------------ | -------------------------------------------------------------------------------------- |
| `valid`                        | `true` nur, wenn der Schlüssel aktiv und (falls gebunden) für diese Installation gilt. |
| `reason`                       | `null` bei gültig, sonst einer der Werte unten.                                        |
| `product`, `instance`, `nonce` | Echo der Anfrage (`instance` ist `null`, wenn keine gesendet wurde).                   |
| `status`                       | `"ACTIVE"`, `"REVOKED"` oder `null` (bei `invalid`).                                   |
| `ts`                           | Zeitpunkt der Antwort als Unix-Zeit in Sekunden.                                       |
| `signature`                    | HMAC-SHA256 über die Felder, hex (64 Zeichen). Siehe unten.                            |

### `reason`-Werte

| `reason`            | `valid` | `status`  | Bedeutung                                                                                                                                                                                        |
| ------------------- | ------- | --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `null`              | `true`  | `ACTIVE`  | Schlüssel gültig (ggf. gerade an die Installation gebunden).                                                                                                                                     |
| `invalid`           | `false` | `null`    | Schlüssel unbekannt, falsches Format, falsches Produkt, noch nicht freigegeben, abgelehnt, Produkt deaktiviert oder Produkt für diesen Zugang nicht erlaubt. Bewusst nicht weiter unterschieden. |
| `revoked`           | `false` | `REVOKED` | Schlüssel wurde gesperrt.                                                                                                                                                                        |
| `instance_mismatch` | `false` | `ACTIVE`  | Schlüssel ist an eine andere Installation gebunden.                                                                                                                                              |
| `instance_required` | `false` | `ACTIVE`  | Schlüssel ist gebunden, die Anfrage enthielt aber keine `instance`.                                                                                                                              |

### Fehlercodes und Limits

Fehler haben die Form `{ "error": { "code": "…", "message": "…" } }` (deutsche Meldung, ohne Details). Fehlerantworten sind **nicht signiert**; ein Client darf daraus nie «gültig» ableiten.

| HTTP | `code`             | Ursache                                                                                 |
| ---- | ------------------ | --------------------------------------------------------------------------------------- |
| 400  | `BAD_JSON`         | Body ist kein gültiges JSON.                                                            |
| 401  | `UNAUTHORIZED`     | Token fehlt, ist falsch, deaktiviert oder gesperrt (Header `WWW-Authenticate: Bearer`). |
| 413  | `TOO_LARGE`        | Body grösser als 2048 Zeichen.                                                           |
| 422  | `VALIDATION_ERROR` | Felder fehlen oder haben ein falsches Format, oder es gibt unbekannte Felder.           |
| 429  | `RATE_LIMITED`     | Zu viele Anfragen; Header `Retry-After` nennt die Wartezeit in Sekunden.                |

Limits (fester Zeitraum je Zähler): 120 Anfragen pro Minute je IP; 20 Anfragen mit falschem Token pro 10 Minuten je IP; 600 Anfragen pro Minute je API-Zugang; 60 Prüfungen pro 10 Minuten je Zugang und IP, wobei jede gültige Prüfung diesen Zähler zurücksetzt (belastet also praktisch nur Fehlversuche). Clients sollten bei 429 warten und Ergebnisse zwischenspeichern, statt bei jedem Programmstart zu prüfen.

### So wird die Signatur geprüft

1. Signierschlüssel des API-Zugangs verwenden (64 Hex-Zeichen, wird beim Anlegen des Zugangs einmalig angezeigt). Er wird als **Text** (die 64 Zeichen) als HMAC-Schlüssel genutzt, nicht als Bytes dekodiert.
2. Den Payload aus den Antwortfeldern bauen, getrennt mit `|` (senkrechter Strich), in dieser Reihenfolge:

   ```
   valid ? "1" : "0" | reason | product | status | instance | nonce | ts
   ```

   `reason`, `status` und `instance` sind bei `null` ein **leerer String**; `ts` als Dezimalzahl. Beispiel: `1||webspace|ACTIVE|meine-domain.example|3f9c…|1767225600`.

3. `HMAC-SHA256(signierschlüssel, payload)` als **Hex** (Kleinbuchstaben) berechnen.
4. Mit `signature` **zeitkonstant** vergleichen (`crypto.timingSafeEqual`, PHP `hash_equals`). Bei Abweichung die Antwort verwerfen.
5. Zusätzlich prüfen:
   - `nonce` der Antwort ist **identisch** mit dem gesendeten Nonce (sonst Wiedereinspielung einer alten Antwort).
   - `ts` weicht höchstens **5 Minuten** (300 s) von der eigenen Uhrzeit ab (Uhr per NTP synchron halten).
   - `product` (und ggf. `instance`) entsprechen der Anfrage.
6. Erst dann `valid` auswerten.

Der Signierschlüssel ist ein Geheimnis: nur serverseitig ablegen (Umgebungsvariable, Secret-Store), nie in Client-Code, der an Endnutzer ausgeliefert wird.

### Beispiele

**Node.js** (lauffähig, inkl. Signatur-, Nonce- und Zeitprüfung): [`scripts/license-client-example.mjs`](../scripts/license-client-example.mjs)

```bash
API_BASE=https://vylaris.ch API_TOKEN=vgsk_… SIGNING_KEY=… PRODUCT=webspace \
LICENSE_KEY=VGS-WEB-… INSTANCE=meine-domain.example \
node scripts/license-client-example.mjs
# Exit-Code: 0 = gültig, 1 = ungültig, 2 = Fehler
```

**curl** (ohne Signaturprüfung, nur zum Ausprobieren):

```bash
curl -sS -X POST "$API_BASE/api/licenses/verify" \
  -H "Authorization: Bearer $API_TOKEN" -H "Content-Type: application/json" \
  -d "{\"key\":\"$LICENSE_KEY\",\"product\":\"$PRODUCT\",\"instance\":\"$INSTANCE\",\"nonce\":\"$(openssl rand -hex 16)\"}"
```

**PHP** (inkl. Signaturprüfung):

```php
$nonce = bin2hex(random_bytes(16));
$ch = curl_init("$base/api/licenses/verify");
curl_setopt_array($ch, [
    CURLOPT_POST => true,
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_TIMEOUT => 10,
    CURLOPT_FOLLOWLOCATION => false,
    CURLOPT_HTTPHEADER => ["Authorization: Bearer $token", "Content-Type: application/json"],
    CURLOPT_POSTFIELDS => json_encode(["key" => $key, "product" => $product, "instance" => $instance, "nonce" => $nonce]),
]);
$res = json_decode((string) curl_exec($ch), true)["data"] ?? null;
if (!$res) { exit(2); } // Netzwerk- oder API-Fehler: nie als "gültig" werten

$payload = implode("|", [
    $res["valid"] ? "1" : "0", $res["reason"] ?? "", $res["product"], $res["status"] ?? "",
    $res["instance"] ?? "", $res["nonce"], (string) $res["ts"],
]);
$ok = hash_equals(hash_hmac("sha256", $payload, $signingKey), $res["signature"])
   && hash_equals($nonce, $res["nonce"])
   && abs(time() - $res["ts"]) <= 300;
// Nur wenn $ok === true UND $res["valid"] === true ist die Lizenz gültig.
```

## 4. Betriebshinweise

- **`AUTH_SECRET` nie ändern** (siehe Hinweis ganz oben). Vor Umzügen oder Neuinstallationen den Wert mitnehmen. Auch ein Datenbank-Backup ist ohne das passende Secret für die Schlüssel wertlos.
- **Signierschlüssel** lässt sich aus `AUTH_SECRET` und der ID des Zugangs jederzeit wieder ableiten; angezeigt wird er trotzdem nur beim Anlegen. Geht er bei einem Client verloren, einen neuen API-Zugang anlegen und den alten löschen.
- **Token verloren oder offengelegt:** Zugang im Admin deaktivieren oder löschen und einen neuen anlegen. Schlüssel der Kunden bleiben davon unberührt.
- **Schlüssel offengelegt:** den Schlüssel im Admin sperren. Der Nutzer kann danach nicht selbst einen neuen beantragen (Status `REVOKED`); das Team entscheidet über das weitere Vorgehen.
- **Serverumzug eines Kunden:** im Admin die Bindung des Schlüssels zurücksetzen; die nächste Prüfung bindet an die neue Installation.
- **Prüfergebnisse nicht ewig zwischenspeichern:** Eine Sperrung wirkt erst bei der nächsten Prüfung. Sinnvoll sind Intervalle von Minuten bis wenigen Stunden, mit Rückfallzeit bei Netzwerkfehlern.
- **Zeit:** Läuft die Uhr eines Clients mehr als 5 Minuten falsch, schlägt die Zeitprüfung fehl. Mit NTP synchron halten.
- **Reverse-Proxy:** Für die Rate-Limits wird die Client-IP aus `X-Forwarded-For` bzw. `X-Real-IP` gelesen. Der Proxy muss diese Header selbst setzen (und nicht ungeprüft vom Client durchreichen).
