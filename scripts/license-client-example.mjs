#!/usr/bin/env node
// Beispiel-Client für die Prüf-API (POST /api/licenses/verify). Benötigt Node 18+ (nur node:crypto und fetch).
//
// Umgebungsvariablen:
//   API_BASE      Basis-URL der Seite, z. B. https://vylaris.eu          (HTTPS ist Pflicht)
//   API_TOKEN     API-Token (vgk_…) aus dem Admin unter "API-Zugänge"
//   SIGNING_KEY   Signierschlüssel (64 Hex-Zeichen) – wird beim Anlegen des Zugangs einmalig angezeigt
//   PRODUCT       Produkt-Slug, z. B. webspace oder autoinstaller
//   LICENSE_KEY   Lizenzschlüssel, z. B. VG-WEB-XXXXX-XXXXX-XXXXX-XXXXX
//   INSTANCE      Kennung der Installation (z. B. Domain); beim ersten Prüfen wird der Schlüssel daran gebunden
//   MAX_SKEW      optional: erlaubte Zeitabweichung in Sekunden (Standard 300)
//
// Aufruf:
//   API_BASE=https://vylaris.eu API_TOKEN=vgk_… SIGNING_KEY=… PRODUCT=webspace \
//   LICENSE_KEY=VG-WEB-… INSTANCE=meine-domain.example node scripts/license-client-example.mjs
//
// Exit-Code: 0 = Lizenz gültig, 1 = Lizenz ungültig, 2 = Fehler (Netzwerk, Token, Signatur, Konfiguration …)
//
// ---- Dasselbe mit curl (ohne Signaturprüfung) -----------------------------------------------------------------
//   curl -sS -X POST "$API_BASE/api/licenses/verify" \
//     -H "Authorization: Bearer $API_TOKEN" -H "Content-Type: application/json" \
//     -d "{\"key\":\"$LICENSE_KEY\",\"product\":\"$PRODUCT\",\"instance\":\"$INSTANCE\",\"nonce\":\"$(openssl rand -hex 16)\"}"
//
// ---- Dasselbe in PHP (inkl. Signaturprüfung) -------------------------------------------------------------------
//   $nonce = bin2hex(random_bytes(16));
//   $ch = curl_init("$base/api/licenses/verify");
//   curl_setopt_array($ch, [
//     CURLOPT_POST => true, CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 10,
//     CURLOPT_HTTPHEADER => ["Authorization: Bearer $token", "Content-Type: application/json"],
//     CURLOPT_POSTFIELDS => json_encode(["key" => $key, "product" => $product, "instance" => $instance, "nonce" => $nonce]),
//   ]);
//   $res = json_decode(curl_exec($ch), true)["data"] ?? null;
//   if (!$res) { exit(2); }
//   $payload = implode("|", [$res["valid"] ? "1" : "0", $res["reason"] ?? "", $res["product"], $res["status"] ?? "",
//                            $res["instance"] ?? "", $res["nonce"], (string)$res["ts"]]);
//   $ok = hash_equals(hash_hmac("sha256", $payload, $signingKey), $res["signature"])
//         && hash_equals($nonce, $res["nonce"]) && abs(time() - $res["ts"]) <= 300;
//   // Nur wenn $ok === true und $res["valid"] === true ist die Lizenz gültig.
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

const EXIT_VALID = 0;
const EXIT_INVALID = 1;
const EXIT_ERROR = 2;

function fail(message) {
  console.error(`Fehler: ${message}`);
  process.exit(EXIT_ERROR);
}

const env = (name) => (process.env[name] ?? "").trim();
for (const name of [
  "API_BASE",
  "API_TOKEN",
  "SIGNING_KEY",
  "PRODUCT",
  "LICENSE_KEY",
]) {
  if (!env(name)) fail(`Umgebungsvariable ${name} fehlt.`);
}
const base = env("API_BASE").replace(/\/+$/, "");
const token = env("API_TOKEN");
const signingKey = env("SIGNING_KEY");
const product = env("PRODUCT");
const licenseKey = env("LICENSE_KEY");
const instance = env("INSTANCE") || undefined;
const maxSkew = Number(env("MAX_SKEW") || 300);

if (
  !/^https:\/\//i.test(base) &&
  !/^http:\/\/(localhost|127\.0\.0\.1)(:|\/|$)/i.test(base)
) {
  fail("API_BASE muss mit https:// beginnen (http:// nur für localhost).");
}
if (!Number.isFinite(maxSkew) || maxSkew < 0)
  fail("MAX_SKEW ist keine gültige Zahl.");

/** Signatur über die Antwortfelder berechnen (siehe docs/license-api.md). */
function expectedSignature(r) {
  const payload = [
    r.valid ? "1" : "0",
    r.reason ?? "",
    r.product,
    r.status ?? "",
    r.instance ?? "",
    r.nonce,
    String(r.ts),
  ].join("|");
  return createHmac("sha256", signingKey).update(payload).digest("hex");
}

/** Zeitkonstanter Vergleich zweier Strings (verschiedene Länge = ungleich). */
function safeEqual(a, b) {
  const x = Buffer.from(String(a));
  const y = Buffer.from(String(b));
  return x.length === y.length && timingSafeEqual(x, y);
}

// Zufälliger Nonce (32 Hex-Zeichen): bindet die Antwort an genau diese Anfrage und verhindert Wiedereinspielen.
const nonce = randomBytes(16).toString("hex");

let res;
try {
  res = await fetch(`${base}/api/licenses/verify`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      key: licenseKey,
      product,
      ...(instance && { instance }),
      nonce,
    }),
    signal: AbortSignal.timeout(10_000),
    redirect: "error", // Token nie an eine umgeleitete Adresse senden
  });
} catch (e) {
  fail(`Anfrage fehlgeschlagen: ${e instanceof Error ? e.message : String(e)}`);
}

let json;
try {
  json = await res.json();
} catch {
  fail(`Antwort ist kein JSON (HTTP ${res.status}).`);
}

if (!res.ok) {
  const e = json?.error;
  const hint =
    res.status === 429
      ? ` Erneut versuchen nach ${res.headers.get("retry-after") ?? "?"} s.`
      : "";
  fail(`HTTP ${res.status}${e ? ` ${e.code}: ${e.message}` : ""}${hint}`);
}

const r = json?.data;
if (
  !r ||
  typeof r.valid !== "boolean" ||
  typeof r.signature !== "string" ||
  typeof r.nonce !== "string" ||
  !Number.isInteger(r.ts)
) {
  fail("Unerwartete Antwortstruktur.");
}

// 1. Signatur prüfen – sie schützt vor Manipulation der Antwort auf dem Weg.
if (!safeEqual(expectedSignature(r), r.signature))
  fail("Signatur der Antwort stimmt nicht – Antwort wird verworfen.");
// 2. Nonce prüfen – die Antwort muss zu genau dieser Anfrage gehören.
if (!safeEqual(r.nonce, nonce))
  fail(
    "Nonce der Antwort passt nicht zur Anfrage (mögliche Wiedereinspielung).",
  );
// 3. Zeitstempel prüfen – die Antwort darf nicht alt oder aus der Zukunft sein.
const skew = Math.abs(Math.floor(Date.now() / 1000) - r.ts);
if (skew > maxSkew)
  fail(
    `Zeitstempel weicht um ${skew} s ab (erlaubt: ${maxSkew} s). Ist die Systemuhr richtig?`,
  );
// 4. Antwort muss zum angefragten Produkt gehören.
if (r.product !== product) fail("Produkt der Antwort passt nicht zur Anfrage.");

if (r.valid) {
  console.log(
    `Lizenz gültig (Produkt ${r.product}, Installation ${r.instance ?? "-"}).`,
  );
  process.exit(EXIT_VALID);
}
console.log(`Lizenz ungültig (Grund: ${r.reason ?? "unbekannt"}).`);
process.exit(EXIT_INVALID);
