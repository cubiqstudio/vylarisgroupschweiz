// Tests gegen eine eigene, leere SQLite-Datenbank (Datei im Temp-Ordner): täglicher Lauf (Austritte, Fehlerisolation, Ergebnis speichern)
// und Zugriffsschutz der Routen /api/cron/daily und /api/events/reminders. Die Entwicklungsdatenbank bleibt unberührt.
// Aufruf:  npx tsx scripts/test/cron-db.test.mts
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, test } from "node:test";

const dir = mkdtempSync(join(tmpdir(), "vgs-cron-db-"));
process.env.DATABASE_URL = `file:${join(dir, "test.db")}`;
process.env.AUTH_SECRET = "ein-geheimnis-fuer-den-test-mindestens-32-zeichen";
delete process.env.CRON_SECRET;
delete process.env.EVENTS_CRON_SECRET;
delete process.env.TRUST_PROXY;

// "server-only" wirft ausserhalb von Next.js; für den Test durch ein leeres Modul ersetzen.
const require = createRequire(import.meta.url);
const serverOnlyPath = require.resolve("server-only");
require.cache[serverOnlyPath] = { id: serverOnlyPath, filename: serverOnlyPath, loaded: true, exports: {}, children: [], paths: [] } as unknown as NodeJS.Module;

execFileSync("npx", ["prisma", "db", "push", "--skip-generate", "--accept-data-loss"], { env: process.env, stdio: "pipe" });

const { db } = await import("../../src/lib/db.ts");
const cron = await import("../../src/lib/verein/cron.ts");
const cronLib = await import("../../src/lib/verein/cron-lib.ts");
const dates = await import("../../src/lib/verein/dates.ts");
const overview = await import("../../src/lib/verein/overview-data.ts");
const daily = await import("../../src/app/api/cron/daily/route.ts");
const reminders = await import("../../src/app/api/events/reminders/route.ts");

after(async () => {
  await db.$disconnect();
  rmSync(dir, { recursive: true, force: true });
});

const SECRET = "tagesablauf-geheimnis-fuer-den-test-1234567890";
const EVENTS_SECRET = "anlass-geheimnis-fuer-den-test-1234567890";
const daysAgo = (n: number) => new Date(dates.todayZurich().getTime() - n * 86_400_000);
const daysAhead = (n: number) => new Date(dates.todayZurich().getTime() + n * 86_400_000);

let counter = 500;
async function makeMember(overrides: Record<string, unknown> = {}) {
  counter += 1;
  return db.member.create({ data: { memberNumber: counter, firstName: "Erika", lastName: `Beispiel${counter}`, email: `erika${counter}@example.test`, status: "AKTIV", ...overrides } });
}

test("fälliger Austritt wird vollzogen, nicht fälliger und Mitglieder ohne Austritt bleiben aktiv", async () => {
  const due = await makeMember({ exitNoticeAt: daysAgo(60), leftAt: daysAgo(3), exitReason: "privat" });
  const dueYesterday = await makeMember({ exitNoticeAt: daysAgo(60), leftAt: daysAgo(1) });
  const future = await makeMember({ exitNoticeAt: daysAgo(10), leftAt: daysAhead(30) });
  const lastDay = await makeMember({ exitNoticeAt: daysAgo(10), leftAt: dates.todayZurich() });
  const plain = await makeMember();
  const alreadyLeft = await makeMember({ status: "AUSGETRETEN", exitNoticeAt: daysAgo(90), leftAt: daysAgo(40) });

  const run = await cron.runDailyTasks();
  const exits = run.tasks.find((t) => t.name === "exits-complete");
  assert.deepEqual(exits, { name: "exits-complete", ok: true, count: 2 });

  const status = async (id: string) => (await db.member.findUniqueOrThrow({ where: { id } })).status;
  assert.equal(await status(due.id), "AUSGETRETEN");
  assert.equal(await status(dueYesterday.id), "AUSGETRETEN");
  assert.equal(await status(future.id), "AKTIV", "Austritt in der Zukunft");
  assert.equal(await status(lastDay.id), "AKTIV", "am letzten Tag der Mitgliedschaft noch Mitglied");
  assert.equal(await status(plain.id), "AKTIV");
  assert.equal(await status(alreadyLeft.id), "AUSGETRETEN");

  const entries = await db.auditLog.findMany({ where: { action: "member.exit.complete" } });
  assert.equal(entries.length, 2);
  for (const e of entries) {
    assert.equal(e.actorType, "SYSTEM");
    assert.equal(e.objectType, "Member");
  }

  const again = await cron.runDailyTasks();
  assert.equal(again.tasks.find((t) => t.name === "exits-complete")?.count, 0, "wiederholbar: nichts mehr zu tun");
  assert.equal(await db.auditLog.count({ where: { action: "member.exit.complete" } }), 2);
});

test("alle Standardaufgaben laufen, das Ergebnis enthält keine Personendaten", async () => {
  const run = await cron.runDailyTasks();
  assert.deepEqual(run.tasks.map((t) => t.name), ["exits-complete", "event-reminders", "registrations-purge", "guest-data-anonymize"]);
  assert.equal(run.ok, true);
  const text = JSON.stringify(run);
  assert.ok(!/Beispiel|example\.test|Erika/.test(text));
});

test("ein Fehler in einer Aufgabe stoppt die anderen nicht und verrät keine Personendaten", async () => {
  const seen: string[] = [];
  const run = await cron.runDailyTasks({
    tasks: [
      { name: "a", run: async () => (seen.push("a"), 1) },
      { name: "b", run: async () => { throw new Error("Fehler bei erika@example.test, Strasse 5"); } },
      { name: "c", run: async () => (seen.push("c"), { count: 4, failed: 2 }) },
      { name: "d", run: async () => (seen.push("d"), 0) },
    ],
  });
  assert.deepEqual(seen, ["a", "c", "d"]);
  assert.equal(run.ok, false);
  assert.deepEqual(run.tasks.map((t) => [t.name, t.ok, t.count]), [["a", true, 1], ["b", false, 0], ["c", false, 4], ["d", true, 0]]);
  const text = JSON.stringify(run);
  assert.ok(!text.includes("erika@example.test") && !text.includes("Strasse"), "Meldungstext des Fehlers wird nicht übernommen");
  assert.match(run.tasks[1]!.error ?? "", /Unerwarteter Fehler/);
});

test("das Ergebnis des letzten Laufs wird gespeichert (SiteSetting «cron.lastRun») und lässt sich lesen", async () => {
  const t0 = new Date("2026-08-01T01:15:00.000Z");
  let tick = 0;
  const run = await cron.runDailyTasks({ tasks: [{ name: "exits-complete", run: async () => 3 }], now: () => new Date(t0.getTime() + 2000 * tick++) });
  assert.equal(run.startedAt, "2026-08-01T01:15:00.000Z");
  assert.equal(run.finishedAt, "2026-08-01T01:15:02.000Z");
  const row = await db.siteSetting.findUniqueOrThrow({ where: { key: "cron.lastRun" } });
  assert.deepEqual(JSON.parse(row.value), run);
  assert.deepEqual(await cron.getLastRun(), run);
  assert.equal(cronLib.cronHealth(await cron.getLastRun(), new Date("2026-08-01T12:00:00Z")), "ok");

  const ohneSpeichern = await cron.runDailyTasks({ tasks: [], save: false, now: () => new Date("2030-01-01T00:00:00Z") });
  assert.equal(ohneSpeichern.ok, true);
  assert.equal((await cron.getLastRun())?.startedAt, "2026-08-01T01:15:00.000Z", "save: false lässt das gespeicherte Ergebnis unberührt");
});

test("zwei Läufe gleichzeitig: der zweite wird abgewiesen (409)", async () => {
  let release: () => void = () => {};
  const gate = new Promise<void>((resolve) => (release = resolve));
  const first = cron.runDailyTasks({ tasks: [{ name: "slow", run: async () => (await gate, 0) }], save: false });
  await assert.rejects(() => cron.runDailyTasks({ tasks: [], save: false }), (e: unknown) => (e as { status?: number }).status === 409);
  release();
  assert.equal((await first).ok, true);
  assert.equal((await cron.runDailyTasks({ tasks: [], save: false })).ok, true, "danach wieder möglich");
});

// ---- Routen --------------------------------------------------------------------------------------------------------------

const call = (handler: (req: Request) => Promise<Response>, method: "GET" | "POST", token?: string, ip = "198.51.100.1") =>
  handler(new Request("http://app:3000/api/cron/daily", { method, headers: { ...(token ? { authorization: `Bearer ${token}` } : {}), "x-forwarded-for": ip } }));

test("Route /api/cron/daily: ohne gesetztes Geheimnis 404 (auch mit Token), zu kurzes Geheimnis zählt als nicht gesetzt", async () => {
  delete process.env.CRON_SECRET;
  assert.equal((await call(daily.POST, "POST", SECRET, "198.51.100.10")).status, 404);
  assert.equal((await call(daily.GET, "GET", SECRET, "198.51.100.10")).status, 404);
  process.env.CRON_SECRET = "zu-kurz";
  assert.equal((await call(daily.POST, "POST", "zu-kurz", "198.51.100.10")).status, 404);
  process.env.CRON_SECRET = "   ";
  assert.equal((await call(daily.POST, "POST", undefined, "198.51.100.10")).status, 404);
});

test("Route /api/cron/daily: ohne oder mit falschem Token 401, kein Lauf", async () => {
  process.env.CRON_SECRET = SECRET;
  await db.siteSetting.deleteMany({ where: { key: "cron.lastRun" } });
  for (const token of [undefined, "falsch", SECRET.slice(0, -1), `${SECRET}x`, EVENTS_SECRET]) {
    const res = await call(daily.POST, "POST", token, "198.51.100.20");
    assert.equal(res.status, 401, String(token));
    const body = await res.json();
    assert.equal(body.error.code, "UNAUTHORIZED");
    assert.ok(!JSON.stringify(body).includes(SECRET));
  }
  assert.equal((await call(daily.GET, "GET", "falsch", "198.51.100.20")).status, 401);
  assert.equal(await db.siteSetting.count({ where: { key: "cron.lastRun" } }), 0, "es lief nichts");
  const basic = await daily.POST(new Request("http://app:3000/api/cron/daily", { method: "POST", headers: { authorization: `Basic ${SECRET}`, "x-forwarded-for": "198.51.100.20" } }));
  assert.equal(basic.status, 401, "nur das Schema Bearer gilt");
});

test("Route /api/cron/daily: mit richtigem Token läuft alles, Antwort ohne Personendaten und ohne Zwischenspeicher", async () => {
  process.env.CRON_SECRET = SECRET;
  const leaving = await makeMember({ exitNoticeAt: daysAgo(40), leftAt: daysAgo(2) });
  // Aufruf ohne Origin-Header, wie vom Dienst «cron» (intern http://app:3000)
  const res = await call(daily.POST, "POST", SECRET, "198.51.100.30");
  assert.equal(res.status, 200);
  assert.equal(res.headers.get("cache-control"), "no-store");
  const text = await res.text();
  const body = JSON.parse(text);
  assert.equal(body.data.ok, true);
  assert.deepEqual(body.data.tasks.map((t: { name: string }) => t.name), ["exits-complete", "event-reminders", "registrations-purge", "guest-data-anonymize"]);
  assert.equal(body.data.tasks[0].count, 1);
  assert.ok(!/Beispiel|example\.test|Erika/.test(text), "keine Personendaten in der Antwort");
  assert.equal((await db.member.findUniqueOrThrow({ where: { id: leaving.id } })).status, "AUSGETRETEN");

  const get = await call(daily.GET, "GET", SECRET, "198.51.100.30");
  assert.equal(get.status, 200);
  assert.equal(get.headers.get("cache-control"), "no-store");
  const last = (await get.json()).data.lastRun;
  assert.equal(last.startedAt, body.data.startedAt);
  assert.equal(cronLib.cronIsOverdue(last, new Date(Date.parse(body.data.finishedAt) + 3_600_000)), false);
});

test("Route /api/events/reminders: EVENTS_CRON_SECRET bleibt gültig, CRON_SECRET gilt zusätzlich", async () => {
  const post = (token?: string, ip = "198.51.100.40") =>
    reminders.POST(new Request("http://app:3000/api/events/reminders", { method: "POST", headers: { ...(token ? { authorization: `Bearer ${token}` } : {}), "x-forwarded-for": ip } }));
  delete process.env.CRON_SECRET;
  delete process.env.EVENTS_CRON_SECRET;
  assert.equal((await post(SECRET)).status, 404, "kein Geheimnis gesetzt");

  process.env.EVENTS_CRON_SECRET = EVENTS_SECRET;
  assert.equal((await post(EVENTS_SECRET)).status, 200, "bisheriges Geheimnis funktioniert weiter");
  assert.equal((await post(SECRET)).status, 401);
  assert.equal((await post()).status, 401);

  process.env.CRON_SECRET = SECRET;
  assert.equal((await post(SECRET)).status, 200, "CRON_SECRET gilt zusätzlich");
  assert.equal((await post(EVENTS_SECRET)).status, 200);
  assert.equal((await post("falsch")).status, 401);
  const ok = await post(SECRET);
  assert.equal(ok.headers.get("cache-control"), "no-store");
  assert.deepEqual(Object.keys((await ok.json()).data).sort(), ["events", "failed", "mailed", "noEmail"]);
});

test("Rate-Limit: zu viele Anfragen von derselben Adresse ergeben 429 mit Retry-After", async () => {
  process.env.CRON_SECRET = SECRET;
  let limited: Response | null = null;
  for (let i = 0; i < 40 && !limited; i += 1) {
    const res = await call(daily.GET, "GET", "falsch", "198.51.100.99");
    if (res.status === 429) limited = res;
    else assert.equal(res.status, 401);
  }
  assert.ok(limited, "429 erreicht");
  assert.ok(Number(limited!.headers.get("retry-after")) > 0);
  assert.equal(limited!.headers.get("cache-control"), "no-store");
  assert.equal((await call(daily.GET, "GET", SECRET, "198.51.100.98")).status, 200, "andere Adresse nicht betroffen");
});

// ---- Betriebsanzeige in der Übersicht ----------------------------------------------------------------------------------------

test("Übersicht: Karte «Täglicher Lauf» nur für Rollen mit Recht «system» oder «verein_settings»", async () => {
  await cron.runDailyTasks({ tasks: [{ name: "exits-complete", run: async () => 0 }] });
  const admin = { id: "adm1", roles: ["ADMIN"], memberId: null };
  const asAdmin = await overview.loadVereinDashboard(admin);
  assert.equal(asAdmin.sections.cron, true);
  assert.equal(asAdmin.cron?.run?.tasks[0]?.name, "exits-complete");

  for (const role of ["PRAESIDENT", "VIZEPRAESIDENT", "KASSIER", "AKTUAR"]) assert.equal((await overview.loadVereinDashboard({ ...admin, roles: [role] })).sections.cron, true, role);
  for (const role of ["REVISOR", "EDITOR"]) {
    const d = await overview.loadVereinDashboard({ ...admin, roles: [role] });
    assert.equal(d.sections.cron, false, role);
    assert.equal(d.cron, null, `${role}: Daten werden gar nicht erst geladen`);
  }

  await db.siteSetting.deleteMany({ where: { key: "cron.lastRun" } });
  const never = await overview.loadVereinDashboard(admin);
  assert.deepEqual(never.cron, { run: null }, "nie gelaufen");
});
