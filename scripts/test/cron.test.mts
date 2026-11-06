// Tests für den Läufer des täglichen Laufs (scripts/cron-runner.mjs): Zeitplan (Zeitzonen, Sommerzeit), Wiederholung, Nachholen beim Start.
// Ohne Netz, ohne Datenbank, mit eingespeister Uhr.
// Aufruf:  npx tsx scripts/test/cron.test.mts
import assert from "node:assert/strict";
import { test } from "node:test";

const runner = await import("../cron-runner.mjs");
const lib = await import("../../src/lib/verein/cron-lib.ts");

const iso = (d: Date) => d.toISOString();
const at = (s: string) => new Date(s);

// ---- nextRunAt ---------------------------------------------------------------------------------------------------------------

test("nextRunAt: Winterzeit (UTC+1) und Sommerzeit (UTC+2) in Zürich", () => {
  assert.equal(iso(runner.nextRunAt(at("2026-01-15T12:00:00Z"))), "2026-01-16T02:15:00.000Z"); // 03:15 MEZ
  assert.equal(iso(runner.nextRunAt(at("2026-07-15T12:00:00Z"))), "2026-07-16T01:15:00.000Z"); // 03:15 MESZ
});

test("nextRunAt: vor dem Termin am selben Tag, genau auf dem Termin und danach", () => {
  assert.equal(iso(runner.nextRunAt(at("2026-01-16T02:14:59Z"))), "2026-01-16T02:15:00.000Z");
  assert.equal(iso(runner.nextRunAt(at("2026-01-16T02:15:00Z"))), "2026-01-17T02:15:00.000Z", "strikt nach dem Zeitpunkt");
  assert.equal(iso(runner.nextRunAt(at("2026-01-16T02:15:01Z"))), "2026-01-17T02:15:00.000Z");
});

test("nextRunAt: Umstellung auf Sommerzeit am 29. März 2026 (Tag mit 23 Stunden)", () => {
  assert.equal(iso(runner.nextRunAt(at("2026-03-28T12:00:00Z"))), "2026-03-29T01:15:00.000Z", "03:15 MESZ am Umstellungstag");
  assert.equal(iso(runner.nextRunAt(at("2026-03-28T02:30:00Z"))), "2026-03-29T01:15:00.000Z", "Lauf vom 28. März (02:15Z) ist vorbei");
  const before = runner.nextRunAt(at("2026-03-28T05:00:00Z")); // Lauf am 29. März
  const after = runner.nextRunAt(before);
  assert.equal(iso(after), "2026-03-30T01:15:00.000Z");
  assert.equal(after.getTime() - before.getTime(), 24 * 3_600_000, "von 03:15 MESZ zu 03:15 MESZ: 24 Stunden");
  const prev = runner.nextRunAt(at("2026-03-27T05:00:00Z")); // 2026-03-28 02:15Z (MEZ)
  assert.equal(iso(prev), "2026-03-28T02:15:00.000Z");
  assert.equal(before.getTime() - prev.getTime(), 23 * 3_600_000, "Abstand über die Umstellung: 23 Stunden");
});

test("nextRunAt: Umstellung auf Winterzeit am 25. Oktober 2026 (Tag mit 25 Stunden)", () => {
  assert.equal(iso(runner.nextRunAt(at("2026-10-24T12:00:00Z"))), "2026-10-25T02:15:00.000Z", "03:15 MEZ am Umstellungstag");
  const prev = runner.nextRunAt(at("2026-10-24T00:00:00Z")); // 2026-10-24 01:15Z (MESZ)
  assert.equal(iso(prev), "2026-10-24T01:15:00.000Z");
  const day = runner.nextRunAt(prev);
  assert.equal(iso(day), "2026-10-25T02:15:00.000Z");
  assert.equal(day.getTime() - prev.getTime(), 25 * 3_600_000, "Abstand über die Umstellung: 25 Stunden");
  assert.equal(iso(runner.nextRunAt(at("2026-10-25T02:30:00Z"))), "2026-10-26T02:15:00.000Z");
});

test("nextRunAt: Zeit während der Umstellungsnacht liefert den Lauf um 03:15 Uhr Ortszeit", () => {
  // 29. März: 01:30Z ist 03:30 MESZ -> der Lauf dieses Tages ist vorbei
  assert.equal(iso(runner.nextRunAt(at("2026-03-29T01:30:00Z"))), "2026-03-30T01:15:00.000Z");
  // 25. Oktober: 00:30Z ist 02:30 MESZ (erste Lesart), 01:30Z ist 02:30 MEZ (zweite Lesart): beide vor 03:15 MEZ
  assert.equal(iso(runner.nextRunAt(at("2026-10-25T00:30:00Z"))), "2026-10-25T02:15:00.000Z");
  assert.equal(iso(runner.nextRunAt(at("2026-10-25T01:30:00Z"))), "2026-10-25T02:15:00.000Z");
});

test("nextRunAt: Jahreswechsel, Monats- und Schaltjahrgrenzen", () => {
  assert.equal(iso(runner.nextRunAt(at("2026-12-31T12:00:00Z"))), "2027-01-01T02:15:00.000Z");
  assert.equal(iso(runner.nextRunAt(at("2028-02-28T12:00:00Z"))), "2028-02-29T02:15:00.000Z");
  assert.equal(iso(runner.nextRunAt(at("2028-02-29T12:00:00Z"))), "2028-03-01T02:15:00.000Z");
  assert.equal(iso(runner.nextRunAt(at("2026-04-30T12:00:00Z"))), "2026-05-01T01:15:00.000Z");
});

test("nextRunAt: andere Zeitzonen", () => {
  const opt = (timeZone: string) => ({ timeZone });
  assert.equal(iso(runner.nextRunAt(at("2026-01-15T12:00:00Z"), opt("UTC"))), "2026-01-16T03:15:00.000Z");
  assert.equal(iso(runner.nextRunAt(at("2026-01-15T12:00:00Z"), opt("America/New_York"))), "2026-01-16T08:15:00.000Z"); // UTC-5
  assert.equal(iso(runner.nextRunAt(at("2026-07-15T12:00:00Z"), opt("America/New_York"))), "2026-07-16T07:15:00.000Z"); // UTC-4
  assert.equal(iso(runner.nextRunAt(at("2026-01-15T12:00:00Z"), opt("Asia/Kolkata"))), "2026-01-15T21:45:00.000Z"); // UTC+5:30
  assert.equal(iso(runner.nextRunAt(at("2026-01-15T12:00:00Z"), opt("Pacific/Auckland"))), "2026-01-15T14:15:00.000Z"); // UTC+13 (Sommerzeit Neuseeland)
  // New York am 8. März 2026 (Umstellung 02:00 -> 03:00): 03:15 existiert, danach UTC-4
  assert.equal(iso(runner.nextRunAt(at("2026-03-08T00:00:00Z"), opt("America/New_York"))), "2026-03-08T07:15:00.000Z");
  assert.equal(iso(runner.nextRunAt(at("2026-03-07T12:00:00Z"), opt("America/New_York"))), "2026-03-08T07:15:00.000Z", "Vorabend: der Termin liegt nach der Umstellung");
});

test("nextRunAt: andere Uhrzeit", () => {
  assert.equal(iso(runner.nextRunAt(at("2026-01-15T12:00:00Z"), { hour: 23, minute: 59 })), "2026-01-15T22:59:00.000Z");
});

test("nextRunAt: der Termin liegt immer in der Zukunft und höchstens 25 Stunden entfernt (Stichprobe über zwei Jahre)", () => {
  for (let ms = Date.UTC(2026, 0, 1); ms < Date.UTC(2028, 0, 1); ms += 5 * 3_600_000 + 17 * 60_000) {
    const now = new Date(ms);
    const next = runner.nextRunAt(now);
    assert.ok(next.getTime() > ms, iso(now));
    assert.ok(next.getTime() - ms <= 25 * 3_600_000, iso(now));
    const p = runner.zonedParts(next.getTime(), "Europe/Zurich");
    assert.deepEqual([p.hour, p.minute, p.second], [3, 15, 0], iso(next));
  }
});

// ---- Geheimnis, Wiederholung, Nachholen --------------------------------------------------------------------------------------

test("validateSecret: fehlend, zu kurz, gültig", () => {
  assert.equal(runner.validateSecret(undefined).ok, false);
  assert.equal(runner.validateSecret("   ").ok, false);
  const short = runner.validateSecret("kurz");
  assert.equal(short.ok, false);
  assert.ok(!short.message.includes("kurz\n") && /zu kurz/.test(short.message));
  const good = runner.validateSecret(` ${"a".repeat(24)} `);
  assert.deepEqual([good.ok, good.secret], [true, "a".repeat(24)]);
});

test("runWithRetry: drei Versuche im Abstand von 5 Minuten, Abbruch nach Erfolg", async () => {
  const waits: number[] = [];
  const logs: string[] = [];
  let calls = 0;
  const failing = await runner.runWithRetry({
    call: async () => (calls++, { ok: false, detail: "HTTP 500" }),
    sleep: async (ms: number) => void waits.push(ms),
    log: (m: string) => logs.push(m),
  });
  assert.equal(failing, false);
  assert.equal(calls, 3);
  assert.deepEqual(waits, [300_000, 300_000], "zwischen den Versuchen, nicht nach dem letzten");

  calls = 0;
  const recovering = await runner.runWithRetry({
    call: async () => (++calls < 2 ? { ok: false, detail: "x" } : { ok: true, detail: "fertig" }),
    sleep: async () => {},
    log: () => {},
  });
  assert.equal(recovering, true);
  assert.equal(calls, 2);
});

test("callDaily: sendet POST mit Bearer-Token, wertet Antwort aus, wirft nie und gibt das Geheimnis nicht aus", async () => {
  const secret = "geheim-geheim-geheim-geheim-1234";
  const seen: Array<{ url: string; method?: string; auth?: string }> = [];
  const mk = (status: number, body: unknown) => async (url: string, init: RequestInit) => {
    seen.push({ url, method: init.method, auth: (init.headers as Record<string, string>).Authorization });
    return new Response(JSON.stringify(body), { status });
  };
  const run = { ok: true, tasks: [{ name: "exits-complete", ok: true, count: 2 }] };
  const good = await runner.callDaily({ fetchImpl: mk(200, { data: run }), baseUrl: "http://app:3000/", secret });
  assert.equal(good.ok, true);
  assert.match(good.detail, /exits-complete: ok \(2\)/);
  assert.deepEqual(seen[0], { url: "http://app:3000/api/cron/daily", method: "POST", auth: `Bearer ${secret}` });

  const partial = await runner.callDaily({ fetchImpl: mk(200, { data: { ok: false, tasks: [{ name: "event-reminders", ok: false, count: 0 }] } }), baseUrl: "http://app:3000", secret });
  assert.equal(partial.ok, false);

  const denied = await runner.callDaily({ fetchImpl: mk(401, { error: { code: "UNAUTHORIZED", message: "Nicht angemeldet." } }), baseUrl: "http://app:3000", secret });
  assert.equal(denied.ok, false);
  assert.match(denied.detail, /401/);

  const down = await runner.callDaily({ fetchImpl: async () => { throw new TypeError(`fetch failed ${secret}`); }, baseUrl: "http://app:3000", secret });
  assert.equal(down.ok, false);
  for (const r of [good, partial, denied, down]) assert.ok(!r.detail.includes(secret), "Geheimnis nie in der Meldung");
});

test("isOverdue: nie, frisch, länger als 36 Stunden", () => {
  const now = at("2026-05-10T12:00:00Z");
  assert.equal(runner.isOverdue(null, now), true);
  assert.equal(runner.isOverdue({ finishedAt: "kaputt" }, now), true);
  assert.equal(runner.isOverdue({ finishedAt: "2026-05-10T01:15:00.000Z" }, now), false);
  assert.equal(runner.isOverdue({ finishedAt: "2026-05-09T00:00:00.000Z" }, now), false, "36 Stunden genau: noch nicht überfällig");
  assert.equal(runner.isOverdue({ finishedAt: "2026-05-08T23:59:00.000Z" }, now), true);
});

// ---- main mit eingespeister Uhr ----------------------------------------------------------------------------------------------

function harness(lastRun: unknown, startIso: string, opts: { getStatus?: number } = {}) {
  let t = Date.parse(startIso);
  const logs: string[] = [];
  const calls: string[] = [];
  const fetchImpl = async (_url: string, init: RequestInit = {}) => {
    const method = init.method ?? "GET";
    calls.push(`${method}@${new Date(t).toISOString()}`);
    if (method === "GET") return opts.getStatus && opts.getStatus !== 200 ? new Response("{}", { status: opts.getStatus }) : new Response(JSON.stringify({ data: { lastRun } }), { status: 200 });
    return new Response(JSON.stringify({ data: { ok: true, tasks: [{ name: "exits-complete", ok: true, count: 0 }] } }), { status: 200 });
  };
  return {
    logs,
    calls,
    args: {
      env: { CRON_SECRET: "x".repeat(40) } as Record<string, string>,
      now: () => new Date(t),
      sleep: async (ms: number) => void (t += ms),
      fetchImpl,
      log: (m: string) => logs.push(m),
      once: true,
    },
  };
}

test("main: beim Start kein sofortiger Lauf, wenn der letzte Lauf aktuell ist; der Lauf erfolgt um 03:15 Uhr", async () => {
  const h = harness({ finishedAt: "2026-07-15T01:20:00.000Z" }, "2026-07-15T10:00:00Z");
  assert.equal(await runner.main(h.args), 0);
  assert.deepEqual(h.calls, ["GET@2026-07-15T10:00:00.000Z", "POST@2026-07-16T01:15:00.000Z"]);
});

test("main: Lauf sofort beim Start, wenn noch nie gelaufen", async () => {
  const h = harness(null, "2026-07-15T10:00:00Z");
  await runner.main(h.args);
  assert.deepEqual(h.calls.slice(0, 2), ["GET@2026-07-15T10:00:00.000Z", "POST@2026-07-15T10:00:00.000Z"]);
  assert.equal(h.calls.length, 3, "danach der geplante Lauf");
});

test("main: Lauf sofort beim Start, wenn der letzte Lauf länger als 36 Stunden her ist", async () => {
  const h = harness({ finishedAt: "2026-07-10T01:20:00.000Z" }, "2026-07-15T10:00:00Z");
  await runner.main(h.args);
  assert.equal(h.calls[1], "POST@2026-07-15T10:00:00.000Z");
});

test("main: Server meldet 404 (kein Geheimnis in der App): kein sofortiger Lauf, klare Meldung ohne Geheimnis", async () => {
  const h = harness(null, "2026-07-15T10:00:00Z", { getStatus: 404 });
  await runner.main(h.args);
  assert.equal(h.calls.filter((c) => c.startsWith("POST")).length, 1, "nur der geplante Lauf");
  assert.ok(h.logs.some((l) => /CRON_SECRET fehlt/.test(l)));
  assert.ok(h.logs.every((l) => !l.includes("x".repeat(40))));
});

test("main: fehlendes oder zu kurzes CRON_SECRET beendet mit Fehlercode und klarer Meldung", async () => {
  for (const secret of [undefined, "zu-kurz"]) {
    const h = harness(null, "2026-07-15T10:00:00Z");
    h.args.env = secret ? { CRON_SECRET: secret } : {};
    assert.equal(await runner.main(h.args), 1);
    assert.ok(h.logs.some((l) => l.startsWith("FEHLER: CRON_SECRET")));
    assert.equal(h.calls.length, 0, "kein Netzaufruf");
    assert.ok(h.logs.every((l) => !l.includes("zu-kurz")));
  }
});

// ---- Pure Hilfen der App-Seite -----------------------------------------------------------------------------------------------

test("cron-lib: parseCronRun liest tolerant, cronHealth unterscheidet nie, zu alt, Fehler und in Ordnung", () => {
  const now = at("2026-07-15T12:00:00Z");
  const fresh = JSON.stringify({ startedAt: "2026-07-15T01:15:00.000Z", finishedAt: "2026-07-15T01:15:02.000Z", ok: true, tasks: [{ name: "exits-complete", ok: true, count: 1 }] });
  assert.equal(lib.cronHealth(lib.parseCronRun(fresh), now), "ok");
  assert.equal(lib.cronHealth(null, now), "never");
  assert.equal(lib.cronHealth(lib.parseCronRun("kein json"), now), "never");
  assert.equal(lib.cronHealth(lib.parseCronRun("{}"), now), "never");
  const failed = JSON.stringify({ startedAt: "2026-07-15T01:15:00.000Z", finishedAt: "2026-07-15T01:15:02.000Z", ok: true, tasks: [{ name: "a", ok: false, count: 0, error: "x" }] });
  assert.equal(lib.cronHealth(lib.parseCronRun(failed), now), "failed", "ok wird aus den Aufgaben abgeleitet, nicht aus dem gespeicherten Wert");
  assert.equal(lib.cronHealth(lib.parseCronRun(fresh), at("2026-07-17T00:00:00Z")), "stale");
  assert.equal(lib.cronIsOverdue(lib.parseCronRun(fresh), at("2026-07-17T00:00:00Z")), true);
  assert.equal(lib.cronIsOverdue(lib.parseCronRun(fresh), now), false);
});

// ---- Übersprungene Aufgabe (kein Mailserver) ist kein Fehler -----------------------------------------------------------------

test("callDaily: übersprungene Aufgabe (Hinweis, ok) gilt als Erfolg und wird im Log als «übersprungen» gezeigt", async () => {
  const secret = "geheim-geheim-geheim-geheim-1234";
  const run = { ok: true, tasks: [{ name: "event-reminders", ok: true, count: 0, note: lib.MAIL_SKIPPED_NOTE }] };
  const r = await runner.callDaily({ fetchImpl: async () => new Response(JSON.stringify({ data: run }), { status: 200 }), baseUrl: "http://app:3000", secret });
  assert.equal(r.ok, true);
  assert.match(r.detail, /event-reminders: übersprungen \(0\)/);
});

test("runWithRetry: bei übersprungener Aufgabe kein zweiter Versuch, kein Fehlerergebnis", async () => {
  const secret = "geheim-geheim-geheim-geheim-1234";
  const run = { ok: true, tasks: [{ name: "event-reminders", ok: true, count: 0, note: lib.MAIL_SKIPPED_NOTE }] };
  let calls = 0;
  const logs: string[] = [];
  const done = await runner.runWithRetry({
    call: () => (calls++, runner.callDaily({ fetchImpl: async () => new Response(JSON.stringify({ data: run }), { status: 200 }), baseUrl: "http://app:3000", secret })),
    sleep: async () => assert.fail("keine Wartezeit"),
    log: (m: string) => logs.push(m),
  });
  assert.equal(done, true);
  assert.equal(calls, 1);
  assert.ok(logs.every((m) => !/fehlgeschlagen/.test(m)));
});

test("parseCronRun und cronRunHasNotes: Hinweis bleibt erhalten, Lauf bleibt ok, Gesundheit «ok»", () => {
  const raw = JSON.stringify({
    startedAt: "2026-08-01T01:15:00.000Z",
    finishedAt: "2026-08-01T01:15:02.000Z",
    ok: true,
    tasks: [{ name: "event-reminders", ok: true, count: 0, note: lib.MAIL_SKIPPED_NOTE }, { name: "exits-complete", ok: true, count: 1 }],
  });
  const run = lib.parseCronRun(raw)!;
  assert.equal(run.ok, true);
  assert.equal(run.tasks[0]!.note, "Kein Mailserver eingerichtet, Erinnerungen wurden nicht verschickt.");
  assert.equal(lib.cronRunHasNotes(run), true);
  assert.equal(lib.cronRunHasNotes({ ...run, tasks: [run.tasks[1]!] }), false);
  assert.equal(lib.cronRunHasNotes(null), false);
  assert.equal(lib.cronHealth(run, new Date("2026-08-01T12:00:00Z")), "ok");
});
