// Täglicher Läufer: ruft einmal am Tag (03:15 Uhr, Zeit Europe/Zurich) POST /api/cron/daily der App auf.
// Reines Node (ab Version 20), keine Abhängigkeiten. Läuft als Dienst «cron» in docker-compose.yml (Befehl: node scripts/cron-runner.mjs).
//
// Umgebung:
//   CRON_SECRET  Pflicht, mindestens 24 Zeichen; dasselbe Geheimnis wie bei der App (install.sh erzeugt es)
//   CRON_URL     Basisadresse der App (Standard http://app:3000)
//
// Verhalten:
//   - Beim Start wird nicht sofort gelaufen, ausser der Server meldet (GET /api/cron/daily), dass noch nie oder seit mehr als
//     36 Stunden kein Lauf stattfand.
//   - Schlägt ein Aufruf fehl (Netz, HTTP-Fehler oder eine fehlgeschlagene Aufgabe), folgen bis zu zwei weitere Versuche im
//     Abstand von 5 Minuten.
//   - Fehlt CRON_SECRET oder ist es zu kurz, beendet sich der Läufer nicht (sonst startet Docker ihn endlos neu und füllt das Log),
//     sondern meldet das Problem beim Start und danach alle 6 Stunden und wartet. Nach dem Eintragen des Geheimnisses in der .env:
//     docker compose up -d cron
//   - Beim Start wartet der Läufer bis zu 20 Minuten auf die App (Datenbankschema, Seed, Migration), bevor er auf das Nachholen verzichtet.
//   - Die Logs enthalten weder das Geheimnis noch Antwortinhalte, nur Statuscodes sowie Name und Anzahl je Aufgabe.
import { pathToFileURL } from "node:url";

export const TIME_ZONE = "Europe/Zurich";
export const RUN_HOUR = 3;
export const RUN_MINUTE = 15;
export const MIN_SECRET_LENGTH = 24;
export const STALE_AFTER_MS = 36 * 3_600_000;
export const RETRY_ATTEMPTS = 3;
export const RETRY_DELAY_MS = 5 * 60_000;
export const START_WAIT_ATTEMPTS = 80; // mal 15 Sekunden = 20 Minuten
export const IDLE_REPORT_MS = 6 * 3_600_000;
const DEFAULT_URL = "http://app:3000";

// ---- Zeit (Intl, keine Zusatzpakete) ----------------------------------------------------------------------------------------------

const formatters = new Map();
function formatterFor(timeZone) {
  let f = formatters.get(timeZone);
  if (!f) {
    f = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hourCycle: "h23",
      year: "numeric",
      month: "numeric",
      day: "numeric",
      hour: "numeric",
      minute: "numeric",
      second: "numeric",
    });
    formatters.set(timeZone, f);
  }
  return f;
}

/** Datum und Uhrzeit eines Zeitpunkts in der Zeitzone (month 1–12). */
export function zonedParts(ms, timeZone) {
  const out = {};
  for (const p of formatterFor(timeZone).formatToParts(new Date(ms))) if (p.type !== "literal") out[p.type] = Number(p.value);
  return { year: out.year, month: out.month, day: out.day, hour: out.hour, minute: out.minute, second: out.second };
}

/** Abstand der Zeitzone zu UTC in Millisekunden zu einem Zeitpunkt (Sommerzeit eingerechnet). */
export function zoneOffsetMs(ms, timeZone) {
  const p = zonedParts(ms, timeZone);
  return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) - Math.floor(ms / 1000) * 1000;
}

/** Zeitpunkt (UTC-Millisekunden) für eine Wanduhrzeit in der Zeitzone. Bei Lücken/Doppelungen der Zeitumstellung gilt die spätere Lesart. */
export function zonedTimeToUtcMs(year, month, day, hour, minute, timeZone) {
  const guess = Date.UTC(year, month - 1, day, hour, minute, 0);
  const first = guess - zoneOffsetMs(guess, timeZone);
  const second = guess - zoneOffsetMs(first, timeZone);
  return second;
}

/**
 * Nächster Lauf strikt nach `now` (Date): täglich um hour:minute Uhr Wanduhrzeit in `timeZone`.
 * Rein und testbar; berücksichtigt die Sommerzeit (der Abstand zwischen zwei Läufen beträgt an Umstellungstagen 23 bzw. 25 Stunden).
 */
export function nextRunAt(now, { hour = RUN_HOUR, minute = RUN_MINUTE, timeZone = TIME_ZONE } = {}) {
  const nowMs = now.getTime();
  const p = zonedParts(nowMs, timeZone);
  for (let addDays = 0; addDays <= 2; addDays += 1) {
    const day = new Date(Date.UTC(p.year, p.month - 1, p.day + addDays));
    const ms = zonedTimeToUtcMs(day.getUTCFullYear(), day.getUTCMonth() + 1, day.getUTCDate(), hour, minute, timeZone);
    if (ms > nowMs) return new Date(ms);
  }
  throw new Error("Nächster Lauf nicht berechenbar.");
}

// ---- Server-Aufrufe -----------------------------------------------------------------------------------------------------------------

export function validateSecret(secret) {
  const s = typeof secret === "string" ? secret.trim() : "";
  if (!s) return { ok: false, message: "CRON_SECRET ist nicht gesetzt. Der tägliche Lauf braucht ein Geheimnis (mindestens 24 Zeichen), z. B. erzeugt mit: openssl rand -hex 32" };
  if (s.length < MIN_SECRET_LENGTH) return { ok: false, message: `CRON_SECRET ist zu kurz (${s.length} Zeichen, nötig sind mindestens ${MIN_SECRET_LENGTH}).` };
  return { ok: true, secret: s };
}

function endpoint(baseUrl) {
  return `${String(baseUrl || DEFAULT_URL).replace(/\/+$/, "")}/api/cron/daily`;
}

function hintFor(status) {
  if (status === 401) return " (Das Geheimnis wird abgelehnt: CRON_SECRET von App und Läufer müssen übereinstimmen.)";
  if (status === 404) return " (Die App hat den Lauf nicht eingerichtet: CRON_SECRET fehlt dort oder ist zu kurz.)";
  return "";
}

/** Kurzform des Ergebnisses für das Log: nur Name und Anzahl je Aufgabe. */
export function summarizeRun(run) {
  if (!run || !Array.isArray(run.tasks)) return "";
  return run.tasks
    .filter((t) => t && typeof t.name === "string")
    .map((t) => `${t.name.slice(0, 40)}: ${t.ok ? "ok" : "Fehler"} (${Number.isFinite(t.count) ? t.count : 0})`)
    .join(", ");
}

/** Ein Aufruf von POST /api/cron/daily. Ergebnis: { ok, status?, detail } – wirft nie. */
export async function callDaily({ fetchImpl = fetch, baseUrl, secret, timeoutMs = 10 * 60_000 }) {
  try {
    const res = await fetchImpl(endpoint(baseUrl), {
      method: "POST",
      headers: { Authorization: `Bearer ${secret}`, Accept: "application/json" },
      signal: AbortSignal.timeout(timeoutMs),
    });
    let run = null;
    try {
      run = (await res.json())?.data ?? null;
    } catch {
      run = null;
    }
    if (!res.ok) return { ok: false, status: res.status, detail: `HTTP ${res.status}${hintFor(res.status)}` };
    if (run && run.ok === false) return { ok: false, status: res.status, detail: `Aufgaben mit Fehlern: ${summarizeRun(run)}` };
    return { ok: true, status: res.status, detail: summarizeRun(run) || "keine Angaben" };
  } catch (e) {
    return { ok: false, detail: `Server nicht erreichbar (${e instanceof Error ? e.name : "Fehler"})` };
  }
}

/** Ruft den Lauf auf und wiederholt ihn bei einem Fehler. Gibt true zurück, wenn ein Versuch gelang. */
export async function runWithRetry({ call, sleep, log, attempts = RETRY_ATTEMPTS, delayMs = RETRY_DELAY_MS }) {
  for (let i = 1; i <= attempts; i += 1) {
    const r = await call();
    if (r.ok) {
      log(`Lauf abgeschlossen (Versuch ${i}): ${r.detail}`);
      return true;
    }
    if (i < attempts) {
      log(`Versuch ${i} von ${attempts} fehlgeschlagen: ${r.detail}. Neuer Versuch in ${Math.round(delayMs / 60_000)} Minuten.`);
      await sleep(delayMs);
    } else {
      log(`Versuch ${i} von ${attempts} fehlgeschlagen: ${r.detail}. Der Lauf wird erst am nächsten Termin wiederholt.`);
    }
  }
  return false;
}

/** Muss der Lauf beim Start nachgeholt werden? (nie gelaufen oder länger als 36 Stunden her) */
export function isOverdue(lastRun, now) {
  if (!lastRun || typeof lastRun.finishedAt !== "string") return true;
  const finished = Date.parse(lastRun.finishedAt);
  if (Number.isNaN(finished)) return true;
  return now.getTime() - finished > STALE_AFTER_MS;
}

/**
 * Fragt den Server nach dem letzten Lauf (GET /api/cron/daily). Die App startet evtl. noch (Datenbankschema), deshalb mehrere Versuche.
 * Ergebnis: { known: true, lastRun } oder { known: false, detail }.
 */
export async function fetchLastRun({ fetchImpl = fetch, baseUrl, secret, sleep, log, attempts = START_WAIT_ATTEMPTS, delayMs = 15_000 }) {
  let detail = "";
  for (let i = 1; i <= attempts; i += 1) {
    try {
      const res = await fetchImpl(endpoint(baseUrl), { headers: { Authorization: `Bearer ${secret}`, Accept: "application/json" }, signal: AbortSignal.timeout(30_000) });
      if (res.ok) {
        const body = await res.json().catch(() => null);
        return { known: true, lastRun: body?.data?.lastRun ?? null };
      }
      detail = `HTTP ${res.status}${hintFor(res.status)}`;
      if (res.status === 401 || res.status === 404) return { known: false, detail };
    } catch (e) {
      detail = `Server nicht erreichbar (${e instanceof Error ? e.name : "Fehler"})`;
    }
    if (i < attempts) {
      if (i === 1) log(`Warte auf die App … (${detail})`);
      await sleep(delayMs);
    }
  }
  return { known: false, detail };
}

// ---- Hauptschleife ----------------------------------------------------------------------------------------------------------------

/** Wartet bis `target` in kurzen Schritten (robust gegen Uhrsprünge und Ruhezustand). */
export async function sleepUntil(target, { now = () => new Date(), sleep }) {
  for (;;) {
    const remaining = target.getTime() - now().getTime();
    if (remaining <= 0) return;
    await sleep(Math.min(remaining, 60_000));
  }
}

export async function main({ env = process.env, now = () => new Date(), sleep = (ms) => new Promise((r) => setTimeout(r, ms)), fetchImpl = fetch, log = defaultLog, once = false } = {}) {
  const check = validateSecret(env.CRON_SECRET);
  if (!check.ok) {
    log(`FEHLER: ${check.message}`);
    return 1;
  }
  const secret = check.secret;
  const baseUrl = env.CRON_URL?.trim() || DEFAULT_URL;
  log(`Läufer gestartet. Ziel: ${endpoint(baseUrl)}; täglich um ${String(RUN_HOUR).padStart(2, "0")}:${String(RUN_MINUTE).padStart(2, "0")} Uhr (${TIME_ZONE}).`);

  const status = await fetchLastRun({ fetchImpl, baseUrl, secret, sleep, log });
  if (!status.known) {
    log(`Letzter Lauf unbekannt: ${status.detail}. Es wird nach Zeitplan gelaufen.`);
  } else if (isOverdue(status.lastRun, now())) {
    log(status.lastRun ? "Der letzte Lauf liegt mehr als 36 Stunden zurück. Hole ihn jetzt nach." : "Es gab noch keinen Lauf. Hole ihn jetzt nach.");
    await runWithRetry({ call: () => callDaily({ fetchImpl, baseUrl, secret }), sleep, log });
  } else {
    log("Letzter Lauf ist aktuell; nächster Lauf nach Zeitplan.");
  }

  for (;;) {
    const next = nextRunAt(now());
    log(`Nächster Lauf: ${next.toISOString()} (UTC).`);
    await sleepUntil(next, { now, sleep });
    await runWithRetry({ call: () => callDaily({ fetchImpl, baseUrl, secret }), sleep, log });
    if (once) return 0;
  }
}

/**
 * Warten statt Beenden, wenn die Einrichtung unvollständig ist (z. B. CRON_SECRET fehlt): Die Meldung wird wiederholt, damit sie im Log
 * auffindbar bleibt. `rounds` begrenzt die Wiederholungen (nur für Tests); ohne Angabe läuft das Warten bis zum Stopp des Containers.
 */
export async function idleWithMessage({ message, log, sleep, intervalMs = IDLE_REPORT_MS, rounds = Infinity }) {
  for (let i = 0; i < rounds; i += 1) {
    await sleep(intervalMs);
    log(`FEHLER: ${message} Der tägliche Lauf findet nicht statt.`);
  }
}

function defaultLog(message) {
  console.log(`[cron] ${new Date().toISOString()} ${message}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.on("SIGTERM", () => process.exit(0));
  process.on("SIGINT", () => process.exit(0));
  main().then(
    async (code) => {
      if (code !== 1) process.exit(code);
      // Einrichtungsfehler (Geheimnis fehlt oder zu kurz): nicht beenden, sondern warten (kein Neustart-Schleife des Containers).
      await idleWithMessage({ message: validateSecret(process.env.CRON_SECRET).message ?? "Der Läufer ist nicht eingerichtet.", log: defaultLog, sleep: (ms) => new Promise((r) => setTimeout(r, ms)) });
    },
    (e) => {
      defaultLog(`FEHLER: ${e instanceof Error ? e.name : "unbekannt"}`);
      process.exit(1);
    },
  );
}
