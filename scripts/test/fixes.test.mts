// Tests zu den Befunden der Gegenprüfung (ohne Datenbank): Protokoll von Vorstandsdokumenten, Aufbewahrungsfristen der Gast-Angaben,
// Betrieb des Dienstes «cron» (Image, Healthcheck, Läufer ohne Geheimnis), Sperre von /api/cron/* nach aussen, Meldung abgewiesener Aufrufe.
// Aufruf:  npx tsx scripts/test/fixes.test.mts
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

const require = createRequire(import.meta.url);
const serverOnlyPath = require.resolve("server-only");
require.cache[serverOnlyPath] = { id: serverOnlyPath, filename: serverOnlyPath, loaded: true, exports: {}, children: [], paths: [] } as unknown as NodeJS.Module;

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const read = (p: string) => readFileSync(join(ROOT, p), "utf8");

const docs = await import("../../src/lib/verein/documents-lib.ts");
const events = await import("../../src/lib/verein/events-lib.ts");
const runner = await import("../cron-runner.mjs");
const cronAuth = await import("../../src/lib/verein/cron-auth.ts");

// ---- Dokumente «Nur Vorstand» im Änderungsprotokoll --------------------------------------------------------------------------

test("Vorstandsdokument: Protokollwerte enthalten weder Titel, Beschreibung noch Dateiname", () => {
  assert.equal(docs.isBoardOnlyAudit("VORSTAND"), true);
  assert.equal(docs.isBoardOnlyAudit("MITGLIEDER", "VORSTAND"), true, "vorher oder nachher genügt");
  assert.equal(docs.isBoardOnlyAudit("OEFFENTLICH", "MITGLIEDER"), false);
  assert.equal(docs.isBoardOnlyAudit(undefined, null), false);
  const out = docs.redactBoardAuditValues({ title: "Geheimer Titel", description: "Geheim", visibility: "VORSTAND", archivedAt: null, datei: "geheim.pdf" });
  const json = JSON.stringify(out);
  assert.ok(!/Geheim|geheim/.test(json), json);
  assert.equal(out.visibility, "VORSTAND");
  assert.equal(out.weitereFelder, 3);
  assert.deepEqual(docs.redactBoardAuditValues({ visibility: "MITGLIEDER" }), { visibility: "MITGLIEDER" });
});

test("Vorstandsdokument: neutrale Bezeichnung nennt nur «Nur Vorstand» und passt nicht auf die alte Schreibweise", () => {
  assert.equal(docs.BOARD_DOCUMENT_AUDIT_LABEL, "Dokument (Nur Vorstand)");
  assert.ok(!docs.BOARD_DOCUMENT_AUDIT_LABEL.includes(docs.LEGACY_BOARD_SUMMARY_MARKER), "neue Einträge bleiben für alle Rollen mit Leserecht sichtbar");
  assert.ok("Dokument «Titel» (Protokoll, Nur Vorstand) hochgeladen".includes(docs.LEGACY_BOARD_SUMMARY_MARKER), "alte Einträge werden erkannt");
});

// ---- Aufbewahrung ---------------------------------------------------------------------------------------------------------------

test("Unbestätigte Anmeldung: der tägliche Lauf löscht sie spätestens CONFIRM_PURGE_MAX_DAYS Tage nach der Anmeldung", () => {
  assert.equal(events.CONFIRM_PURGE_MAX_DAYS, 3);
  const hour = 3_600_000;
  // Läufe täglich um 03:15 UTC (Annahme genügt: der Abstand ist 24 Stunden); Anmeldungen im 17-Minuten-Raster über zwei Tage.
  const runs: number[] = [];
  for (let d = 0; d < 10; d += 1) runs.push(Date.UTC(2026, 5, 1 + d, 3, 15));
  let worst = 0;
  for (let t = Date.UTC(2026, 5, 2, 0, 0); t < Date.UTC(2026, 5, 4, 0, 0); t += 17 * 60_000) {
    const created = new Date(t);
    const purgedAt = runs.find((r) => events.confirmPurgeCutoff(new Date(r)).getTime() >= created.getTime());
    assert.ok(purgedAt !== undefined);
    worst = Math.max(worst, purgedAt - t);
  }
  assert.ok(worst <= events.CONFIRM_PURGE_MAX_DAYS * 24 * hour, `längste Dauer ${worst / hour} Stunden`);
  assert.ok(worst > 48 * hour, "Der Tagesraster überschreitet 48 Stunden tatsächlich: die Texte dürfen nicht «nach 48 Stunden gelöscht» versprechen");
});

test("Gast-Angaben: Stichtag liegt GUEST_RETENTION_DAYS vor jetzt", () => {
  const now = new Date("2026-08-31T12:00:00Z");
  assert.equal(events.GUEST_RETENTION_DAYS, 30);
  assert.equal(events.guestRetentionCutoff(now).toISOString(), "2026-08-01T12:00:00.000Z");
});

test("Texte für Gäste nennen die tatsächlichen Fristen (Datenschutzerklärung, Mail, Formular, Doku)", () => {
  const privacy = read("src/components/legal/datenschutz.tsx");
  assert.ok(privacy.includes("{GUEST_RETENTION_DAYS}"), "Datenschutzerklärung nennt die Frist für bestätigte Gast-Angaben");
  assert.ok(privacy.includes("spätestens drei Tage"), "Datenschutzerklärung nennt die Frist für unbestätigte Anmeldungen");
  assert.ok(!/löschen wir die unbestätigte Anmeldung samt Name/.test(privacy), "kein Versprechen «nach 48 Stunden gelöscht» mehr");
  assert.ok(!privacy.includes("entfernen oder anonymisieren sie danach"), "keine unbestimmte Zusage mehr");
  const mail = read("src/lib/verein/events-mail.ts");
  assert.ok(mail.includes("CONFIRM_PURGE_MAX_DAYS"));
  assert.ok(read("src/i18n/verein-anlaesse.ts").includes("spätestens drei Tage nach der Anmeldung"));
  assert.ok(read("docs/verein-anlaesse.md").includes("guest-data-anonymize"), "Doku beschreibt die Tagesaufgabe");
});

// ---- Betrieb: Image, Healthcheck, Läufer ---------------------------------------------------------------------------------------

test("Dockerfile kopiert den Läufer ins Image und .dockerignore schliesst ihn nicht aus", () => {
  const dockerfile = read("Dockerfile");
  assert.match(dockerfile, /^COPY\s+(--chown=\S+\s+)?scripts\/cron-runner\.mjs\s+\.\/scripts\/cron-runner\.mjs\s*$/m);
  const ignore = read(".dockerignore")
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith("#"));
  for (const pattern of ignore) {
    const p = pattern.replace(/^\/+/, "").replace(/\/+$/, "");
    assert.ok(!["scripts", "scripts/cron-runner.mjs", "*.mjs", "scripts/*", "scripts/**"].includes(p), `.dockerignore schliesst den Läufer aus: ${pattern}`);
  }
});

test("Dienst cron: geerbter Healthcheck der Web-App ist abgeschaltet, Dateisystem schreibgeschützt", () => {
  const compose = read("docker-compose.yml");
  const block = compose.slice(compose.indexOf("\n  cron:"), compose.indexOf("\n  db:"));
  assert.ok(block.length > 50);
  assert.match(block, /healthcheck:\s*\n\s+disable:\s*true/);
  assert.match(block, /read_only:\s*true/);
  assert.match(block, /tmpfs:\s*\n\s+- \/tmp/);
  assert.match(block, /node.*scripts\/cron-runner\.mjs/);
  assert.match(compose, /openssl rand -hex 32/, "Schnellstart nennt, wie CRON_SECRET erzeugt wird");
});

test("Läufer ohne Geheimnis beendet sich nicht (keine Neustart-Schleife), meldet den Fehler und nennt das Geheimnis nie", async () => {
  const child = spawn(process.execPath, [join(ROOT, "scripts/cron-runner.mjs")], { env: { PATH: process.env.PATH ?? "", CRON_SECRET: "zu-kurz" }, stdio: ["ignore", "pipe", "pipe"] });
  let out = "";
  child.stdout.on("data", (d) => (out += String(d)));
  child.stderr.on("data", (d) => (out += String(d)));
  let exited: number | null | undefined;
  child.on("exit", (code) => (exited = code));
  await new Promise((r) => setTimeout(r, 1500));
  try {
    assert.equal(exited, undefined, `Der Läufer darf sich nicht beenden (Exit ${exited}); Ausgabe: ${out}`);
    assert.match(out, /FEHLER: CRON_SECRET/);
    assert.ok(!out.includes("zu-kurz"));
  } finally {
    child.kill("SIGTERM");
  }
});

test("idleWithMessage: wiederholt die Meldung in grossen Abständen", async () => {
  const logs: string[] = [];
  const sleeps: number[] = [];
  await runner.idleWithMessage({ message: "CRON_SECRET fehlt.", log: (m: string) => logs.push(m), sleep: async (ms: number) => void sleeps.push(ms), rounds: 3 });
  assert.equal(logs.length, 3);
  assert.ok(sleeps.every((ms) => ms === runner.IDLE_REPORT_MS && ms >= 3_600_000), "höchstens stündlich: kein Log-Flut");
  assert.ok(logs[0].startsWith("FEHLER: CRON_SECRET fehlt."));
});

test("Läufer wartet beim Start bis zu 20 Minuten auf die App", () => {
  assert.equal(runner.START_WAIT_ATTEMPTS * 15, 1200);
});

// ---- Sperre von /api/cron/* nach aussen ----------------------------------------------------------------------------------------

test("Caddy und Cloudflare-Tunnel geben für /api/cron/* nach aussen 404 zurück", () => {
  const caddy = read("docker/Caddyfile");
  assert.match(caddy, /@cron path \/api\/cron \/api\/cron\/\*/);
  assert.match(caddy, /respond @cron .*404/);
  assert.ok(caddy.indexOf("respond @cron") < caddy.indexOf("reverse_proxy"), "Sperre steht vor dem Proxy");
  const cf = read("scripts/cloudflare-setup.sh");
  assert.ok(cf.includes("CRON_PATH_REGEX='^/api/cron(/|$)'"));
  assert.match(cf, /path: \$p, service: "http_status:404"/);
  assert.match(cf, /path: \(\.path \/\/ null\)/, "die Prüfung auf Änderungen berücksichtigt den Pfad");
  // Der Läufer spricht die App direkt an, nicht über Caddy oder den Tunnel.
  assert.match(read("docker-compose.yml"), /CRON_URL: \$\{CRON_URL:-http:\/\/app:3000\}/);
});

test("Abgewiesene Cron-Aufrufe werden gemeldet, höchstens einmal pro Minute, ohne Token und IP", () => {
  const warnings: string[] = [];
  const orig = console.warn;
  console.warn = (...a: unknown[]) => void warnings.push(a.join(" "));
  try {
    cronAuth.resetRejectedCronLog();
    assert.equal(cronAuth.noteRejectedCronCall("cron-daily", "token", 1_000), true);
    assert.equal(cronAuth.noteRejectedCronCall("cron-daily", "token", 30_000), false, "innerhalb einer Minute nur einmal");
    assert.equal(cronAuth.noteRejectedCronCall("cron-daily", "rate", 30_000), true, "andere Art, eigene Meldung");
    assert.equal(cronAuth.noteRejectedCronCall("cron-daily", "token", 61_001), true);
  } finally {
    console.warn = orig;
  }
  assert.equal(warnings.length, 3);
  assert.ok(warnings.every((w) => w.startsWith("[cron] Aufruf von cron-daily abgewiesen")));
});

test("install.sh: Kommentar und Warnung beschreiben das Ersetzen zu kurzer Geheimnisse ehrlich", () => {
  const sh = read("install.sh");
  assert.ok(!sh.includes("ein vorhandenes Geheimnis bleibt immer unverändert"));
  assert.ok(sh.includes("ein zu kurzes würde von der App ohnehin abgelehnt") || sh.includes("Ein zu kurzes würde von der App ohnehin abgelehnt"));
  assert.ok(sh.includes("müssen danach mit dem neuen Wert aus der .env eingerichtet werden"));
});
