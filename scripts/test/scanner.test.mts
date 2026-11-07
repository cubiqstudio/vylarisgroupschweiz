// Tests der Scanner-Schnittstelle v1 (Türkontrolle mit der Android-App «Vylaris Scanner») gegen eine eigene, leere SQLite-Datenbank
// (Datei im Temp-Ordner, wie review-db.test.mts): Token, Anmeldung der Geräte, Ausweisgründe, Ticket-Zustände, Check-in (auch gleichzeitig),
// Suche, Fenster der Anlässe, Rate-Limits, Antwortformen. Die Entwicklungsdatenbank bleibt unberührt.
// Aufruf:  npx tsx scripts/test/scanner.test.mts
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, test } from "node:test";

const dir = mkdtempSync(join(tmpdir(), "vgs-scanner-db-"));
process.env.DATABASE_URL = `file:${join(dir, "test.db")}`;
process.env.AUTH_SECRET = "ein-geheimnis-fuer-den-test-mindestens-32-zeichen";

// "server-only" wirft ausserhalb von Next.js; für den Test durch ein leeres Modul ersetzen.
const require = createRequire(import.meta.url);
const serverOnlyPath = require.resolve("server-only");
require.cache[serverOnlyPath] = { id: serverOnlyPath, filename: serverOnlyPath, loaded: true, exports: {}, children: [], paths: [] } as unknown as NodeJS.Module;

execFileSync("npx", ["prisma", "db", "push", "--skip-generate", "--accept-data-loss"], { env: process.env, stdio: "pipe" });

const { db } = await import("../../src/lib/db.ts");
const tokenLib = await import("../../src/lib/scanner-token.ts");
const scanner = await import("../../src/lib/scanner.ts");
const lib = await import("../../src/lib/scanner-lib.ts");
const cardData = await import("../../src/lib/verein/membership-card-data.ts");
const eventsOps = await import("../../src/lib/verein/events-ops.ts");
const dates = await import("../../src/lib/verein/dates.ts");
const meRoute = await import("../../src/app/api/scanner/v1/me/route.ts");
const eventsRoute = await import("../../src/app/api/scanner/v1/events/route.ts");
const scanRoute = await import("../../src/app/api/scanner/v1/scan/route.ts");
const membersRoute = await import("../../src/app/api/scanner/v1/members/route.ts");
const attendanceRoute = await import("../../src/app/api/scanner/v1/events/[id]/attendance/route.ts");

after(async () => {
  await db.$disconnect();
  rmSync(dir, { recursive: true, force: true });
});

// ---- Hilfen ---------------------------------------------------------------------------------------------------------------

type Handler = (req: Request, ctx?: unknown) => Promise<Response>;
const ME = meRoute.GET as unknown as Handler;
const EVENTS = eventsRoute.GET as unknown as Handler;
const SCAN = scanRoute.POST as unknown as Handler;
const MEMBERS = membersRoute.GET as unknown as Handler;
const ATTEND = attendanceRoute.PATCH as unknown as Handler;

type Reg = { id: string; status: string; seats: number; note: string; attendedAt: string | null };
type EventCheck = { id: string; title: string; ticket: string; registration: Reg | null; checkIn: { performed: boolean; alreadyAt: string | null } };
type MemberJson = { id: string; memberNumber: number; firstName: string; lastName: string; status: string; membershipType: string | null; joinedAt: string | null; validUntil: string | null; offices: string[] };
type Entry = { member: MemberJson; event: EventCheck | null };
type EventItem = { id: string; title: string; startsAt: string; endsAt: string | null; location: string; stats: { registered: number; waitlist: number; attended: number } };
/** Antwortkörper, wie ihn die App liest (alle Felder je nach Route; die Tests prüfen, was jeweils da sein muss). */
type Data = {
  valid: boolean;
  reason: string | null;
  member: MemberJson;
  event: EventCheck | null;
  entries: Entry[];
  events: EventItem[];
  registration: Reg;
  club: { name: string };
  device: { id: string; label: string; canCheckIn: boolean };
  serverTime: string;
};
type Json = { data: Data; error?: { code: string; message: string } };
let ipCounter = 0;
const nextIp = () => `10.1.${Math.floor(++ipCounter / 250)}.${ipCounter % 250}`;

/** Ruft einen Handler wie die App auf (eigene IP je Aufruf, damit die Grenze je IP die Tests nicht stört). */
async function call(handler: Handler, method: string, path: string, opts: { token?: string | null; body?: unknown; ip?: string; params?: { id: string } } = {}) {
  const headers = new Headers({ "x-forwarded-for": opts.ip ?? nextIp() });
  if (opts.token) headers.set("authorization", `Bearer ${opts.token}`);
  const body = opts.body === undefined ? undefined : typeof opts.body === "string" ? opts.body : JSON.stringify(opts.body);
  const res = await handler(new Request(`https://example.test${path}`, { method, headers, body }), opts.params ? { params: Promise.resolve(opts.params) } : undefined);
  return { status: res.status, headers: res.headers, json: (await res.json()) as Json };
}

async function makeDevice(over: { label?: string; canCheckIn?: boolean; active?: boolean; revokedAt?: Date | null; lastUsedAt?: Date | null } = {}) {
  const t = tokenLib.generateScannerToken();
  const row = await db.scannerDevice.create({
    data: { label: over.label ?? "Eingang", tokenHash: t.tokenHash, tokenHint: t.tokenHint, canCheckIn: over.canCheckIn ?? true, active: over.active ?? true, revokedAt: over.revokedAt ?? null, lastUsedAt: over.lastUsedAt ?? null },
  });
  return { token: t.token, row };
}

let counter = 1000;
async function makeMember(over: Record<string, unknown> = {}) {
  counter += 1;
  return db.member.create({ data: { memberNumber: counter, firstName: "Max", lastName: `Muster${counter}`, email: `s${counter}@example.test`, status: "AKTIV", joinedAt: dates.dateOnly(2024, 3, 15), ...over } });
}

const hours = (h: number) => new Date(Date.now() + h * 3_600_000);
let regCounter = 0;
async function makeEvent(over: Record<string, unknown> = {}) {
  return db.event.create({ data: { title: "Hauptversammlung", location: "Vereinslokal", startsAt: hours(2), status: "VEROEFFENTLICHT", ...over } });
}
async function register(eventId: string, memberId: string, over: Record<string, unknown> = {}) {
  regCounter += 1;
  return db.eventRegistration.create({ data: { eventId, memberId, cancelTokenHash: `scanner-test-${regCounter}`, ...over } });
}
const scanBody = (memberId: string, version = 0) => cardData.cardToken(memberId, version);

const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
const DAY = /^\d{4}-\d{2}-\d{2}$/;

// ---- Token ------------------------------------------------------------------------------------------------------------------

test("Token: Format vgst_ + 43 Zeichen base64url, nur der SHA-256-Hash wird gespeichert, Bearer wird streng gelesen", () => {
  const a = tokenLib.generateScannerToken();
  const b = tokenLib.generateScannerToken();
  assert.match(a.token, /^vgst_[A-Za-z0-9_-]{43}$/);
  assert.notEqual(a.token, b.token);
  assert.equal(a.tokenHash, createHash("sha256").update(a.token).digest("hex"));
  assert.equal(tokenLib.hashScannerToken(a.token), a.tokenHash);
  assert.equal(a.tokenHint, a.token.slice(0, 8));
  assert.ok(!a.tokenHash.includes(a.token));
  assert.equal(tokenLib.parseScannerBearer(`Bearer ${a.token}`), a.token);
  for (const bad of [null, undefined, "", a.token, `bearer ${a.token}`, `Bearer ${a.token} `, `Bearer ${a.token}x`, "Bearer vgst_kurz", `Bearer vgsk_${"a".repeat(43)}`, `Basic ${a.token}`]) {
    assert.equal(tokenLib.parseScannerBearer(bad), null, String(bad));
  }
});

// ---- Anmeldung der Geräte -----------------------------------------------------------------------------------------------

test("Anmeldung: gültiges Gerät kommt durch, fehlendes, falsches, gesperrtes, inaktives und gelöschtes Token ergeben 401", async () => {
  const ok = await makeDevice({ label: "Eingang links" });
  const me = await call(ME, "GET", "/api/scanner/v1/me", { token: ok.token });
  assert.equal(me.status, 200);
  assert.equal(me.headers.get("cache-control"), "no-store");
  assert.deepEqual(Object.keys(me.json.data).sort(), ["club", "device", "serverTime"]);
  assert.equal(typeof me.json.data.club.name, "string");
  assert.deepEqual(me.json.data.device, { id: ok.row.id, label: "Eingang links", canCheckIn: true });
  assert.match(me.json.data.serverTime, ISO);

  const revoked = await makeDevice({ revokedAt: new Date(), active: true });
  const inactive = await makeDevice({ active: false });
  const gone = await makeDevice();
  await db.scannerDevice.delete({ where: { id: gone.row.id } });
  const unknownToken = tokenLib.generateScannerToken().token;
  const cases: Array<[string, string | null]> = [
    ["ohne Token", null],
    ["unbekannt", unknownToken],
    ["falsches Format", "vgst_kurz"],
    ["Zeitpunkt der Sperre gesetzt", revoked.token],
    ["inaktiv", inactive.token],
    ["gelöscht", gone.token],
  ];
  for (const [name, token] of cases) {
    const r = await call(ME, "GET", "/api/scanner/v1/me", { token });
    assert.equal(r.status, 401, name);
    assert.equal(r.json.error?.code, "UNAUTHORIZED", name);
    assert.equal(r.json.data, undefined, name);
    assert.equal(r.headers.get("cache-control"), "no-store", name);
    assert.equal(r.headers.get("www-authenticate"), "Bearer", name);
  }
  // Alle Routen sind geschützt
  for (const [h, m, p] of [[EVENTS, "GET", "/api/scanner/v1/events"], [SCAN, "POST", "/api/scanner/v1/scan"], [MEMBERS, "GET", "/api/scanner/v1/members?q=ab"], [ATTEND, "PATCH", "/api/scanner/v1/events/x/attendance"]] as const) {
    const r = await call(h, m, p, { token: gone.token, body: m === "GET" ? undefined : {}, params: { id: "x" } });
    assert.equal(r.status, 401, p);
  }
  // Wird ein Gerät nach dem ersten Aufruf gesperrt, ist das Token sofort ungültig
  await db.scannerDevice.update({ where: { id: ok.row.id }, data: { active: false } });
  assert.equal((await call(ME, "GET", "/api/scanner/v1/me", { token: ok.token })).status, 401);
  await db.scannerDevice.update({ where: { id: ok.row.id }, data: { active: true } });
  assert.equal((await call(ME, "GET", "/api/scanner/v1/me", { token: ok.token })).status, 200);
});

test("lastUsedAt wird höchstens alle 60 Sekunden nachgeführt", async () => {
  const d = await makeDevice();
  assert.equal(d.row.lastUsedAt, null);
  await scanner.authenticateScannerDevice(`Bearer ${d.token}`);
  const first = (await db.scannerDevice.findUniqueOrThrow({ where: { id: d.row.id } })).lastUsedAt;
  assert.ok(first, "beim ersten Aufruf gesetzt");
  // Kürzlich benutzt: kein Schreibzugriff
  const recent = new Date(Date.now() - 20_000);
  await db.scannerDevice.update({ where: { id: d.row.id }, data: { lastUsedAt: recent } });
  await scanner.authenticateScannerDevice(`Bearer ${d.token}`);
  assert.equal((await db.scannerDevice.findUniqueOrThrow({ where: { id: d.row.id } })).lastUsedAt?.getTime(), recent.getTime());
  // Länger her: nachgeführt
  const old = new Date(Date.now() - 120_000);
  await db.scannerDevice.update({ where: { id: d.row.id }, data: { lastUsedAt: old } });
  await scanner.authenticateScannerDevice(`Bearer ${d.token}`);
  assert.ok((await db.scannerDevice.findUniqueOrThrow({ where: { id: d.row.id } })).lastUsedAt!.getTime() > Date.now() - 10_000);
});

// ---- Ausweis prüfen: Gründe ------------------------------------------------------------------------------------------------

test("inspectCardToken: malformed, unknown, outdated, inactive und gültig; checkCardToken bleibt unverändert", async () => {
  const m = await makeMember({ firstName: "Anna", lastName: "Gültig" });
  const good = await cardData.inspectCardToken(cardData.cardToken(m.id));
  assert.equal(good.valid, true);
  assert.equal(good.reason, null);
  assert.equal(good.member?.memberNumber, m.memberNumber);

  // malformed: Müll, falsche Signatur, andere ID mit fremder Signatur, zu lang
  const token = cardData.cardToken(m.id);
  const sigPart = token.split(".")[1]!;
  for (const bad of ["", "abc", "a.b", "..", `${m.id}.${"A".repeat(43)}`, `${m.id}.${sigPart}.${sigPart}`, `${m.id}x.${sigPart}`, `x`.repeat(200)]) {
    const r = await cardData.inspectCardToken(bad);
    assert.deepEqual([r.valid, r.reason, r.member], [false, "malformed", null], bad.slice(0, 20));
  }

  // unknown: Signatur stimmt, Mitglied gibt es nicht
  const unknown = await cardData.inspectCardToken(cardData.cardToken("gibtesnicht"));
  assert.deepEqual([unknown.valid, unknown.reason, unknown.member], [false, "unknown", null]);

  // outdated: Ausweis neu ausgestellt
  const reissued = await makeMember();
  const oldToken = cardData.cardToken(reissued.id, 0);
  await db.member.update({ where: { id: reissued.id }, data: { cardVersion: 1 } });
  const outdated = await cardData.inspectCardToken(oldToken);
  assert.deepEqual([outdated.valid, outdated.reason, outdated.member], [false, "outdated", null]);
  assert.equal((await cardData.inspectCardToken(cardData.cardToken(reissued.id, 1))).valid, true);
  assert.equal((await cardData.inspectCardToken(cardData.cardToken(reissued.id, 2))).reason, "outdated");

  // inactive: Status ≠ AKTIV (Member gesetzt), anonymisiert (Member null), Austritt vorbei
  for (const status of ["AUSGETRETEN", "AUSGESCHLOSSEN", "VERSTORBEN", "ANTRAG", "ABGELEHNT"]) {
    const x = await makeMember({ status });
    const r = await cardData.inspectCardToken(cardData.cardToken(x.id));
    assert.deepEqual([r.valid, r.reason], [false, "inactive"], status);
    assert.equal(r.member?.memberNumber, x.memberNumber, status);
    assert.equal(r.member?.status, status);
  }
  const anon = await makeMember({ status: "AUSGETRETEN", anonymizedAt: new Date() });
  const anonResult = await cardData.inspectCardToken(cardData.cardToken(anon.id));
  assert.deepEqual([anonResult.valid, anonResult.reason, anonResult.member], [false, "inactive", null]);
  const anonActive = await makeMember({ anonymizedAt: new Date() });
  assert.equal((await cardData.inspectCardToken(cardData.cardToken(anonActive.id))).reason, "inactive");
  const past = await makeMember({ exitNoticeAt: dates.dateOnly(2025, 1, 5), leftAt: dates.dateOnly(2025, 12, 31) });
  assert.equal((await cardData.inspectCardToken(cardData.cardToken(past.id))).reason, "inactive");
  const future = await makeMember({ exitNoticeAt: new Date(), leftAt: dates.dateOnly(2099, 12, 31) });
  const f = await cardData.inspectCardToken(cardData.cardToken(future.id));
  assert.equal(f.valid, true);
  assert.equal(f.member?.leftAt?.getUTCFullYear(), 2099);

  // Die öffentliche Prüfung bleibt wie sie war: gültig nur für aktive Mitglieder, sonst «nicht gültig» ohne Grund und Namen
  const pub = await cardData.checkCardToken(cardData.cardToken(m.id));
  assert.equal(pub.valid, true);
  assert.deepEqual(Object.keys(pub).sort(), ["clubName", "memberNumber", "shortName", "valid"]);
  assert.deepEqual(await cardData.checkCardToken(oldToken), { valid: false });
  assert.deepEqual(await cardData.checkCardToken(cardData.cardToken(anon.id)), { valid: false });
  assert.deepEqual(await cardData.checkCardToken("abc"), { valid: false });
});

// ---- /scan: Mitgliedsdaten und Antwortform -----------------------------------------------------------------------------------

test("/scan: Mitgliedsdaten Feld für Feld (Art, Eintritt, Austritt, offene Ämter), Gründe als Antwort mit HTTP 200", async () => {
  const dev = await makeDevice();
  const type = await db.membershipType.create({ data: { name: "Aktivmitglied" } });
  const m = await makeMember({ firstName: "Anna", lastName: "Muster", membershipTypeId: type.id, joinedAt: dates.dateOnly(2024, 3, 15), exitNoticeAt: new Date(), leftAt: dates.dateOnly(2099, 6, 30) });
  await db.office.create({ data: { kind: "PRAESIDENT", memberId: m.id, validFrom: dates.dateOnly(2024, 4, 1) } });
  await db.office.create({ data: { kind: "SONSTIGES", title: "Materialwart", memberId: m.id, validFrom: dates.dateOnly(2024, 5, 1) } });
  await db.office.create({ data: { kind: "KASSIER", memberId: m.id, validFrom: dates.dateOnly(2020, 1, 1), validUntil: dates.dateOnly(2022, 1, 1) } });

  const r = await call(SCAN, "POST", "/api/scanner/v1/scan", { token: dev.token, body: { token: scanBody(m.id) } });
  assert.equal(r.status, 200);
  assert.equal(r.headers.get("cache-control"), "no-store");
  assert.deepEqual(Object.keys(r.json.data).sort(), ["event", "member", "reason", "valid"]);
  assert.equal(r.json.data.valid, true);
  assert.equal(r.json.data.reason, null);
  assert.equal(r.json.data.event, null);
  assert.deepEqual(r.json.data.member, {
    id: m.id,
    memberNumber: m.memberNumber,
    firstName: "Anna",
    lastName: "Muster",
    status: "AKTIV",
    membershipType: "Aktivmitglied",
    joinedAt: "2024-03-15",
    validUntil: "2099-06-30",
    offices: ["Präsident/in", "Materialwart"],
  });

  const plain = await makeMember({ joinedAt: null });
  const p = await call(SCAN, "POST", "/api/scanner/v1/scan", { token: dev.token, body: { token: scanBody(plain.id) } });
  assert.deepEqual([p.json.data.member.membershipType, p.json.data.member.joinedAt, p.json.data.member.validUntil, p.json.data.member.offices], [null, null, null, []]);

  const bad = await call(SCAN, "POST", "/api/scanner/v1/scan", { token: dev.token, body: { token: "garnicht.gueltig" } });
  assert.equal(bad.status, 200);
  assert.deepEqual(bad.json.data, { valid: false, reason: "malformed", member: null, event: null });
  const gone = await call(SCAN, "POST", "/api/scanner/v1/scan", { token: dev.token, body: { token: scanBody("weg") } });
  assert.deepEqual(gone.json.data, { valid: false, reason: "unknown", member: null, event: null });
  const left = await makeMember({ status: "AUSGETRETEN", firstName: "Eva", lastName: "Brunner" });
  const inactive = await call(SCAN, "POST", "/api/scanner/v1/scan", { token: dev.token, body: { token: scanBody(left.id) } });
  assert.equal(inactive.json.data.valid, false);
  assert.equal(inactive.json.data.reason, "inactive");
  assert.equal(inactive.json.data.event, null);
  assert.equal(inactive.json.data.member.status, "AUSGETRETEN");
  assert.equal(inactive.json.data.member.firstName, "Eva");
});

test("/scan: Eingabeprüfung (Token 1 bis 200 Zeichen, JSON, Grösse, NUL)", async () => {
  const dev = await makeDevice();
  const post = (body: unknown) => call(SCAN, "POST", "/api/scanner/v1/scan", { token: dev.token, body });
  for (const body of [{}, { token: "" }, { token: "x".repeat(201) }, { token: 5 }, { token: "a", eventId: 5 }, { token: "a", checkIn: "ja" }, "[]", "null"]) {
    const r = await post(body);
    assert.equal(r.status, 422, JSON.stringify(body).slice(0, 40));
    assert.equal(r.json.error?.code, "VALIDATION_ERROR");
  }
  assert.equal((await post("{kaputt")).status, 400);
  assert.equal((await post("{kaputt")).json.error?.code, "BAD_JSON");
  assert.equal((await post({ token: "a\u0000b" })).status, 400);
  assert.equal((await post({ token: "x".repeat(6000) })).status, 422);
  assert.equal((await post({ token: "x".repeat(200) })).status, 200);
  // eventId und checkIn dürfen fehlen oder null sein
  assert.equal((await post({ token: "x", eventId: null, checkIn: null })).status, 200);
});

// ---- Ticket-Zustände ---------------------------------------------------------------------------------------------------------

test("/scan mit Anlass: Ticket valid, waitlist, unconfirmed, cancelled und none; nur veröffentlichte Anlässe", async () => {
  const dev = await makeDevice();
  const ev = await makeEvent({ title: "Vereinsabend" });
  const mk = async (status: string | null, seats = 1, note = "") => {
    const m = await makeMember();
    if (status) await register(ev.id, m.id, { status, seats, note });
    return m;
  };
  const cases: Array<[string | null, string]> = [
    ["ANGEMELDET", "valid"],
    ["WARTELISTE", "waitlist"],
    ["UNBESTAETIGT", "unconfirmed"],
    ["ABGESAGT", "cancelled"],
    [null, "none"],
  ];
  for (const [status, ticket] of cases) {
    const m = await mk(status, 2, "mit Begleitung");
    const r = await call(SCAN, "POST", "/api/scanner/v1/scan", { token: dev.token, body: { token: scanBody(m.id), eventId: ev.id } });
    assert.equal(r.status, 200, String(status));
    const e = r.json.data.event;
    assert.deepEqual(Object.keys(e).sort(), ["checkIn", "id", "registration", "ticket", "title"]);
    assert.equal(e.id, ev.id);
    assert.equal(e.title, "Vereinsabend");
    assert.equal(e.ticket, ticket);
    assert.deepEqual(e.checkIn, { performed: false, alreadyAt: null });
    if (status) {
      assert.deepEqual(Object.keys(e.registration).sort(), ["attendedAt", "id", "note", "seats", "status"]);
      assert.equal(e.registration.status, status);
      assert.equal(e.registration.seats, 2);
      assert.equal(e.registration.note, "mit Begleitung");
      assert.equal(e.registration.attendedAt, null);
    } else assert.equal(e.registration, null);
  }
  assert.equal(lib.ticketOf("etwas-anderes"), "none");

  const m = await makeMember();
  for (const status of ["ENTWURF", "ABGESAGT"]) {
    const other = await makeEvent({ status });
    const r = await call(SCAN, "POST", "/api/scanner/v1/scan", { token: dev.token, body: { token: scanBody(m.id), eventId: other.id } });
    assert.equal(r.status, 404, status);
    assert.equal(r.json.error?.code, "NOT_FOUND");
  }
  assert.equal((await call(SCAN, "POST", "/api/scanner/v1/scan", { token: dev.token, body: { token: scanBody(m.id), eventId: "gibtesnicht" } })).status, 404);
});

// ---- Check-in ------------------------------------------------------------------------------------------------------------------

test("Check-in: einmal, dann alreadyAt; Protokoll mit Nummer und Anlass, ohne Namen; nur bei gültigem Ticket", async () => {
  const dev = await makeDevice({ label: "Eingang rechts" });
  const ev = await makeEvent({ title: "Hauptversammlung 2026" });
  const m = await makeMember({ firstName: "Berta", lastName: "Geheimname" });
  const reg = await register(ev.id, m.id, { seats: 2 });
  const body = { token: scanBody(m.id), eventId: ev.id, checkIn: true };

  const r1 = await call(SCAN, "POST", "/api/scanner/v1/scan", { token: dev.token, body });
  assert.equal(r1.status, 200);
  assert.equal(r1.json.data.event.checkIn.performed, true);
  assert.equal(r1.json.data.event.checkIn.alreadyAt, null);
  assert.match(r1.json.data.event.registration.attendedAt, ISO);
  const at = (await db.eventRegistration.findUniqueOrThrow({ where: { id: reg.id } })).attendedAt;
  assert.ok(at);
  assert.equal(r1.json.data.event.registration.attendedAt, at.toISOString());

  const r2 = await call(SCAN, "POST", "/api/scanner/v1/scan", { token: dev.token, body });
  assert.equal(r2.json.data.event.checkIn.performed, false);
  assert.equal(r2.json.data.event.checkIn.alreadyAt, at.toISOString());
  assert.equal((await db.eventRegistration.findUniqueOrThrow({ where: { id: reg.id } })).attendedAt?.getTime(), at.getTime(), "Zeitpunkt bleibt der erste");

  // Ohne checkIn: nichts ändert sich, auch kein alreadyAt
  const peek = await call(SCAN, "POST", "/api/scanner/v1/scan", { token: dev.token, body: { token: scanBody(m.id), eventId: ev.id } });
  assert.deepEqual(peek.json.data.event.checkIn, { performed: false, alreadyAt: null });
  assert.equal(peek.json.data.event.registration.attendedAt, at.toISOString());

  const logs = await db.auditLog.findMany({ where: { objectId: reg.id, action: { startsWith: "scanner." } } });
  assert.equal(logs.length, 1, "genau ein Eintrag, nur für den Eingriff");
  const log = logs[0]!;
  assert.equal(log.action, "scanner.checkin");
  assert.equal(log.actorType, "SYSTEM");
  assert.equal(log.actorName, "Scanner: Eingang rechts");
  assert.equal(log.actorId, dev.row.id);
  assert.ok(log.summary.includes(String(m.memberNumber)) && log.summary.includes("Hauptversammlung 2026"));
  const text = JSON.stringify(log);
  assert.ok(!text.includes("Berta") && !text.includes("Geheimname"), "keine Namen im Protokoll");

  // Warteliste, unbestätigt, abgesagt, keine Anmeldung: kein Check-in
  for (const status of ["WARTELISTE", "UNBESTAETIGT", "ABGESAGT"]) {
    const x = await makeMember();
    const xr = await register(ev.id, x.id, { status });
    const r = await call(SCAN, "POST", "/api/scanner/v1/scan", { token: dev.token, body: { token: scanBody(x.id), eventId: ev.id, checkIn: true } });
    assert.equal(r.status, 200, status);
    assert.deepEqual(r.json.data.event.checkIn, { performed: false, alreadyAt: null }, status);
    assert.equal((await db.eventRegistration.findUniqueOrThrow({ where: { id: xr.id } })).attendedAt, null, status);
  }
  const none = await makeMember();
  const nr = await call(SCAN, "POST", "/api/scanner/v1/scan", { token: dev.token, body: { token: scanBody(none.id), eventId: ev.id, checkIn: true } });
  assert.equal(nr.json.data.event.ticket, "none");
  assert.equal(nr.json.data.event.checkIn.performed, false);

  // Inaktives Mitglied mit Anmeldung: kein Check-in, kein Anlass
  const inactive = await makeMember({ status: "AUSGETRETEN" });
  const ir = await register(ev.id, inactive.id);
  const ri = await call(SCAN, "POST", "/api/scanner/v1/scan", { token: dev.token, body: { token: scanBody(inactive.id), eventId: ev.id, checkIn: true } });
  assert.equal(ri.json.data.valid, false);
  assert.equal(ri.json.data.event, null);
  assert.equal((await db.eventRegistration.findUniqueOrThrow({ where: { id: ir.id } })).attendedAt, null);
  assert.equal(await db.auditLog.count({ where: { objectId: { in: [ir.id] } } }), 0);
});

test("Check-in gleichzeitig: mehrere Scans desselben Ausweises ergeben genau einen Check-in", async () => {
  const dev = await makeDevice();
  const ev = await makeEvent();
  // Mehr gleichzeitige Transaktionen verträgt die Test-SQLite nicht zuverlässig (PostgreSQL und die bedingte Aktualisierung halten sie auseinander).
  for (let round = 0; round < 3; round++) {
    const m = await makeMember();
    const reg = await register(ev.id, m.id);
    const body = { token: scanBody(m.id), eventId: ev.id, checkIn: true };
    const results = await Promise.all([call(SCAN, "POST", "/api/scanner/v1/scan", { token: dev.token, body }), call(SCAN, "POST", "/api/scanner/v1/scan", { token: dev.token, body })]);
    for (const r of results) assert.equal(r.status, 200);
    const performed = results.filter((r) => r.json.data.event.checkIn.performed === true);
    const already = results.filter((r) => r.json.data.event.checkIn.alreadyAt !== null);
    assert.equal(performed.length, 1, "genau einer hat eingecheckt");
    assert.equal(performed.length + already.length, 2, "der andere sieht den früheren Check-in");
    assert.equal(await db.auditLog.count({ where: { objectId: reg.id, action: "scanner.checkin" } }), 1);
    const at = (await db.eventRegistration.findUniqueOrThrow({ where: { id: reg.id } })).attendedAt!;
    for (const r of results) assert.equal(r.json.data.event.registration.attendedAt, at.toISOString(), "beide sehen denselben Zeitpunkt");
  }
});

test("markAttendance: bedingt und atomar, nur für ANGEMELDET", async () => {
  const ev = await makeEvent();
  const m = await makeMember();
  const reg = await register(ev.id, m.id);
  const wait = await register(ev.id, (await makeMember()).id, { status: "WARTELISTE" });
  const now = new Date();
  assert.equal(await db.$transaction((tx) => eventsOps.markAttendance(tx, reg.id, true, now)), true);
  assert.equal(await db.$transaction((tx) => eventsOps.markAttendance(tx, reg.id, true, new Date(now.getTime() + 5000))), false);
  assert.equal((await db.eventRegistration.findUniqueOrThrow({ where: { id: reg.id } })).attendedAt?.getTime(), now.getTime());
  assert.equal(await db.$transaction((tx) => eventsOps.markAttendance(tx, reg.id, false, now)), true);
  assert.equal(await db.$transaction((tx) => eventsOps.markAttendance(tx, reg.id, false, now)), false);
  assert.equal(await db.$transaction((tx) => eventsOps.markAttendance(tx, wait.id, true, now)), false);
});

test("canCheckIn=false: Check-in und Anwesenheit ergeben 403, Prüfen und Suchen bleiben erlaubt", async () => {
  const dev = await makeDevice({ canCheckIn: false });
  const ev = await makeEvent();
  const m = await makeMember();
  const reg = await register(ev.id, m.id);

  const r = await call(SCAN, "POST", "/api/scanner/v1/scan", { token: dev.token, body: { token: scanBody(m.id), eventId: ev.id, checkIn: true } });
  assert.equal(r.status, 403);
  assert.equal(r.json.error?.code, "FORBIDDEN");
  assert.equal(r.headers.get("cache-control"), "no-store");
  const noEvent = await call(SCAN, "POST", "/api/scanner/v1/scan", { token: dev.token, body: { token: scanBody(m.id), checkIn: true } });
  assert.equal(noEvent.status, 403);
  const p = await call(ATTEND, "PATCH", `/api/scanner/v1/events/${ev.id}/attendance`, { token: dev.token, body: { memberId: m.id, attended: true }, params: { id: ev.id } });
  assert.equal(p.status, 403);
  const u = await call(ATTEND, "PATCH", `/api/scanner/v1/events/${ev.id}/attendance`, { token: dev.token, body: { memberId: m.id, attended: false }, params: { id: ev.id } });
  assert.equal(u.status, 403);
  assert.equal((await db.eventRegistration.findUniqueOrThrow({ where: { id: reg.id } })).attendedAt, null);
  assert.equal(await db.auditLog.count({ where: { objectId: reg.id } }), 0);

  const look = await call(SCAN, "POST", "/api/scanner/v1/scan", { token: dev.token, body: { token: scanBody(m.id), eventId: ev.id } });
  assert.equal(look.status, 200);
  assert.equal(look.json.data.event.ticket, "valid");
  assert.equal((await call(MEMBERS, "GET", `/api/scanner/v1/members?q=${m.memberNumber}`, { token: dev.token })).status, 200);
  assert.equal((await call(EVENTS, "GET", "/api/scanner/v1/events", { token: dev.token })).status, 200);
});

// ---- PATCH /events/{id}/attendance ------------------------------------------------------------------------------------------

test("PATCH attendance: setzen, zurücknehmen, Regeln wie in der Verwaltung (409 ausser ANGEMELDET, 404 ohne Anmeldung)", async () => {
  const dev = await makeDevice({ label: "Kasse" });
  const ev = await makeEvent({ title: "Sommerfest" });
  const m = await makeMember({ firstName: "Carl", lastName: "Verborgen" });
  const reg = await register(ev.id, m.id, { seats: 3, note: "Vegi" });
  const path = `/api/scanner/v1/events/${ev.id}/attendance`;
  const patch = (body: unknown, id = ev.id) => call(ATTEND, "PATCH", path, { token: dev.token, body, params: { id } });

  const on = await patch({ memberId: m.id, attended: true });
  assert.equal(on.status, 200);
  assert.deepEqual(Object.keys(on.json.data), ["registration"]);
  assert.deepEqual(Object.keys(on.json.data.registration).sort(), ["attendedAt", "id", "note", "seats", "status"]);
  assert.equal(on.json.data.registration.id, reg.id);
  assert.equal(on.json.data.registration.seats, 3);
  assert.match(on.json.data.registration.attendedAt, ISO);
  const at = on.json.data.registration.attendedAt;
  // Nochmals setzen: unverändert, kein zweiter Eintrag
  const again = await patch({ memberId: m.id, attended: true });
  assert.equal(again.status, 200);
  assert.equal(again.json.data.registration.attendedAt, at);

  const off = await patch({ memberId: m.id, attended: false });
  assert.equal(off.status, 200);
  assert.equal(off.json.data.registration.attendedAt, null);
  assert.equal((await patch({ memberId: m.id, attended: false })).json.data.registration.attendedAt, null);

  const logs = await db.auditLog.findMany({ where: { objectId: reg.id }, orderBy: { createdAt: "asc" } });
  assert.deepEqual(logs.map((l) => l.action).sort(), ["scanner.checkin", "scanner.undo"]);
  for (const l of logs) {
    assert.equal(l.actorType, "SYSTEM");
    assert.equal(l.actorName, "Scanner: Kasse");
    assert.ok(l.summary.includes(String(m.memberNumber)) && l.summary.includes("Sommerfest"));
    assert.ok(!JSON.stringify(l).includes("Carl") && !JSON.stringify(l).includes("Verborgen"));
  }

  // 409: nicht angemeldet
  for (const status of ["WARTELISTE", "UNBESTAETIGT", "ABGESAGT"]) {
    const x = await makeMember();
    await register(ev.id, x.id, { status });
    for (const attended of [true, false]) {
      const r = await patch({ memberId: x.id, attended });
      assert.equal(r.status, 409, `${status} ${attended}`);
      assert.equal(r.json.error?.code, "CONFLICT");
    }
  }
  // 404: keine Anmeldung, unbekanntes Mitglied, Entwurf, unbekannter Anlass
  assert.equal((await patch({ memberId: (await makeMember()).id, attended: true })).status, 404);
  assert.equal((await patch({ memberId: "gibtesnicht", attended: true })).status, 404);
  const draft = await makeEvent({ status: "ENTWURF" });
  assert.equal((await patch({ memberId: m.id, attended: true }, draft.id)).status, 404);
  assert.equal((await patch({ memberId: m.id, attended: true }, "gibtesnicht")).status, 404);
  // 422: Body
  for (const body of [{}, { memberId: m.id }, { memberId: m.id, attended: "ja" }, { attended: true }, { memberId: "", attended: true }]) {
    assert.equal((await patch(body)).status, 422, JSON.stringify(body));
  }

  // Dieselbe Regel in der Verwaltung (Fall attendance) und ihr Verhalten bleibt: überschreibt den Zeitpunkt von Hand
  const admin = { id: "adm1", email: "a@example.test", name: "Test Admin", role: "ADMIN", roles: ["ADMIN"] as never, memberId: null, mustChangePassword: false };
  const wait = await register(ev.id, (await makeMember()).id, { status: "WARTELISTE" });
  await assert.rejects(eventsOps.adminRegistrationAction(admin as never, ev.id, wait.id, { action: "attendance", attended: true } as never), (e: unknown) => (e as { status?: number; code?: string }).status === 409 && (e as { code?: string }).code === "CONFLICT");
  await eventsOps.adminRegistrationAction(admin as never, ev.id, reg.id, { action: "attendance", attended: true } as never);
  const first = (await db.eventRegistration.findUniqueOrThrow({ where: { id: reg.id } })).attendedAt;
  assert.ok(first);
  await eventsOps.adminRegistrationAction(admin as never, ev.id, reg.id, { action: "attendance", attended: true } as never, new Date(Date.now() + 60_000));
  assert.ok((await db.eventRegistration.findUniqueOrThrow({ where: { id: reg.id } })).attendedAt!.getTime() > first.getTime());
  await eventsOps.adminRegistrationAction(admin as never, ev.id, reg.id, { action: "attendance", attended: false } as never);
  assert.equal((await db.eventRegistration.findUniqueOrThrow({ where: { id: reg.id } })).attendedAt, null);
});

// ---- Suche ---------------------------------------------------------------------------------------------------------------------

test("/members: Nummer (genau) und Name (Teilstring ohne Gross-/Kleinschreibung), nie anonymisiert, nie ANTRAG/ABGELEHNT", async () => {
  const dev = await makeDevice();
  await db.member.deleteMany();
  const logsBefore = await db.auditLog.count({ where: { action: { startsWith: "scanner." } } });
  const search = (q: string, eventId?: string) => call(MEMBERS, "GET", `/api/scanner/v1/members?q=${encodeURIComponent(q)}${eventId ? `&eventId=${eventId}` : ""}`, { token: dev.token });
  const a = await db.member.create({ data: { memberNumber: 42, firstName: "Anna", lastName: "Zürcher", status: "AKTIV", joinedAt: dates.dateOnly(2023, 1, 10) } });
  await db.member.create({ data: { memberNumber: 142, firstName: "Bernhard", lastName: "Anderegg", status: "AKTIV" } });
  const c = await db.member.create({ data: { memberNumber: 7, firstName: "Cäcilia", lastName: "Keller", status: "AUSGETRETEN" } });
  await db.member.create({ data: { memberNumber: 8, firstName: "Antrag", lastName: "Neu", status: "ANTRAG" } });
  await db.member.create({ data: { memberNumber: 9, firstName: "Abgelehnt", lastName: "Neu", status: "ABGELEHNT" } });
  await db.member.create({ data: { memberNumber: 10, firstName: "Anonym", lastName: "Neu", status: "AUSGETRETEN", anonymizedAt: new Date() } });
  await db.member.create({ data: { memberNumber: 11, firstName: "Anonym", lastName: "Aktiv", status: "AKTIV", anonymizedAt: new Date() } });

  // Nummer: genau, nicht als Teilstring
  const n = await search("42");
  assert.equal(n.status, 200);
  assert.deepEqual(n.json.data.entries.map((e: Entry) => e.member.memberNumber), [42]);
  assert.deepEqual(Object.keys(n.json.data), ["entries"]);
  assert.deepEqual(Object.keys(n.json.data.entries[0]).sort(), ["event", "member"]);
  assert.equal(n.json.data.entries[0].event, null);
  assert.equal(n.json.data.entries[0].member.joinedAt, "2023-01-10");
  assert.deepEqual((await search("07")).json.data.entries.map((e: Entry) => e.member.memberNumber), [7], "führende Null");
  assert.deepEqual((await search("99999999999999999999")).json.data.entries, []);
  assert.deepEqual((await search("4294967296")).json.data.entries, [], "ausserhalb des Zahlenbereichs: kein Fehler");

  // Name: Teilstring in Vor- oder Nachname, ohne Gross-/Kleinschreibung, sortiert nach Nachname
  assert.deepEqual((await search("AN")).json.data.entries.map((e: Entry) => e.member.memberNumber), [142, 42], "Anderegg (Nachname) vor Zürcher; Anna (Vorname) trifft ebenfalls");
  assert.deepEqual((await search("ANN")).json.data.entries.map((e: Entry) => e.member.memberNumber), [42]);
  assert.deepEqual((await search("nderegg")).json.data.entries.map((e: Entry) => e.member.memberNumber), [142]);
  assert.deepEqual((await search("anna zür")).json.data.entries.map((e: Entry) => e.member.memberNumber), [42], "mehrere Wörter: jedes muss vorkommen");
  assert.deepEqual((await search("keller")).json.data.entries.map((e: Entry) => e.member.memberNumber), [7], "Ausgetretene bleiben auffindbar (die Tür fragt nach)");
  assert.equal((await search("keller")).json.data.entries[0].member.status, "AUSGETRETEN");
  // Nie anonymisiert, nie ANTRAG/ABGELEHNT, auch nicht über die Nummer
  for (const q of ["Antrag", "Abgelehnt", "Anonym", "Neu", "08", "09", "10", "11"]) {
    assert.deepEqual((await search(q)).json.data.entries, [], q);
  }
  assert.deepEqual((await search("xyz")).json.data.entries, []);

  // zu kurz oder fehlend: 422
  for (const q of ["", "a", " a ", "  "]) {
    const r = await search(q);
    assert.equal(r.status, 422, JSON.stringify(q));
    assert.equal(r.json.error?.code, "VALIDATION_ERROR");
  }
  assert.equal((await call(MEMBERS, "GET", "/api/scanner/v1/members", { token: dev.token })).status, 422);
  assert.equal((await search("x".repeat(101))).status, 422);
  assert.equal((await call(MEMBERS, "GET", "/api/scanner/v1/members?q=ab%00", { token: dev.token })).status, 400);

  // Mit Anlass: je Treffer die Anmeldung
  const ev = await makeEvent({ title: "Mitgliederabend" });
  await db.eventRegistration.create({ data: { eventId: ev.id, memberId: a.id, seats: 2, cancelTokenHash: "scanner-lookup-1", attendedAt: new Date() } });
  await db.eventRegistration.create({ data: { eventId: ev.id, memberId: c.id, status: "WARTELISTE", cancelTokenHash: "scanner-lookup-2" } });
  const withEv = await search("an", ev.id);
  assert.equal(withEv.status, 200);
  const byNr = new Map<number, Entry>(withEv.json.data.entries.map((e) => [e.member.memberNumber, e]));
  assert.equal(byNr.get(42).event.ticket, "valid");
  assert.equal(byNr.get(42).event.title, "Mitgliederabend");
  assert.equal(byNr.get(42).event.registration.seats, 2);
  assert.match(byNr.get(42).event.registration.attendedAt, ISO);
  assert.deepEqual(byNr.get(42).event.checkIn, { performed: false, alreadyAt: null }, "Suche checkt nie ein");
  assert.equal(byNr.get(142).event.ticket, "none");
  assert.equal(byNr.get(142).event.registration, null);
  assert.equal((await search("keller", ev.id)).json.data.entries[0].event.ticket, "waitlist");
  assert.equal((await search("an", "gibtesnicht")).status, 404);
  const draft = await makeEvent({ status: "ENTWURF" });
  assert.equal((await search("an", draft.id)).status, 404);
  // Suchen allein ändert nichts und protokolliert nichts
  assert.equal(await db.auditLog.count({ where: { action: { startsWith: "scanner." } } }), logsBefore);
  assert.equal((await db.eventRegistration.findFirstOrThrow({ where: { cancelTokenHash: "scanner-lookup-2" } })).attendedAt, null);
});

test("/members: Sonderzeichen (%, _, Backslash) in der Suche sind gewöhnliche Zeichen, höchstens 20 Treffer", async () => {
  const dev = await makeDevice();
  await db.member.deleteMany();
  await db.member.create({ data: { memberNumber: 501, firstName: "Anna", lastName: "Meier", status: "AKTIV" } });
  await db.member.create({ data: { memberNumber: 502, firstName: "Axel", lastName: "Müller", status: "AKTIV" } });
  await db.member.create({ data: { memberNumber: 503, firstName: "50%", lastName: "Rabatt", status: "AKTIV" } });
  await db.member.create({ data: { memberNumber: 504, firstName: "Ur_sula", lastName: "Back\\slash", status: "AKTIV" } });
  const nrs = async (q: string) => (await call(MEMBERS, "GET", `/api/scanner/v1/members?q=${encodeURIComponent(q)}`, { token: dev.token })).json.data.entries.map((e: Entry) => e.member.memberNumber);
  assert.deepEqual(await nrs("%%"), [], "«%%» ist kein Muster, das alle trifft");
  assert.deepEqual(await nrs("a%"), [], "«a%» trifft nichts, was nicht wirklich «a%» enthält");
  assert.deepEqual(await nrs("%a"), []);
  assert.deepEqual(await nrs("A_"), [], "«A_» ist kein Platzhalter für Anna/Axel");
  assert.deepEqual(await nrs("_x"), []);
  assert.deepEqual(await nrs("An_a"), []);
  assert.deepEqual(await nrs("50%"), [503], "ein echtes Prozentzeichen wird gefunden");
  assert.deepEqual(await nrs("r_s"), [504], "ein echter Unterstrich wird gefunden");
  assert.deepEqual(await nrs("k\\s"), [504], "ein echter Backslash wird gefunden");
  assert.deepEqual(await nrs("\\\\"), []);
  assert.deepEqual(await nrs("'; DROP TABLE Member; --"), []);
  assert.equal(await db.member.count(), 4);

  await db.member.deleteMany();
  for (let i = 0; i < 25; i++) await db.member.create({ data: { memberNumber: 600 + i, firstName: "Treffer", lastName: `Nr${String(i).padStart(2, "0")}`, status: "AKTIV" } });
  const many = await nrs("Treffer");
  assert.equal(many.length, 20);
  assert.deepEqual(many, Array.from({ length: 20 }, (_, i) => 600 + i), "sortiert nach Nachname");
});

// ---- Anlässe und Zahlen ---------------------------------------------------------------------------------------------------------

test("/events: Zeitfenster, Sortierung, höchstens 20; Zahlen zählen nur ANGEMELDET und WARTELISTE (UNBESTAETIGT nirgends)", async () => {
  const dev = await makeDevice();
  await db.event.deleteMany();
  const day = 24;
  await Promise.all([
    makeEvent({ title: "C später", startsAt: hours(13 * day) }),
    makeEvent({ title: "A laufend", startsAt: hours(-1), endsAt: hours(3) }),
    makeEvent({ title: "B beendet vor 5 h", startsAt: hours(-9), endsAt: hours(-5) }),
    makeEvent({ title: "Ohne Ende, Beginn vor 5 h", startsAt: hours(-5), endsAt: null }),
    makeEvent({ title: "Ohne Ende, Beginn vor 11 h", startsAt: hours(-11), endsAt: null }),
  ]);
  await makeEvent({ title: "Zu spät: in 15 Tagen", startsAt: hours(15 * day) });
  await makeEvent({ title: "Beendet vor 7 h", startsAt: hours(-10), endsAt: hours(-7) });
  await makeEvent({ title: "Ohne Ende, Beginn vor 13 h", startsAt: hours(-13), endsAt: null });
  await makeEvent({ title: "Entwurf", status: "ENTWURF" });
  await makeEvent({ title: "Abgesagt", status: "ABGESAGT" });
  const r = await call(EVENTS, "GET", "/api/scanner/v1/events", { token: dev.token });
  assert.equal(r.status, 200);
  assert.equal(r.headers.get("cache-control"), "no-store");
  assert.deepEqual(Object.keys(r.json.data), ["events"]);
  assert.deepEqual(
    r.json.data.events.map((e: Entry) => e.title),
    ["Ohne Ende, Beginn vor 11 h", "B beendet vor 5 h", "Ohne Ende, Beginn vor 5 h", "A laufend", "C später"],
    "aufsteigend nach Beginn, Entwürfe, Abgesagte und ausserhalb des Fensters fehlen",
  );
  const first = r.json.data.events[3];
  assert.deepEqual(Object.keys(first).sort(), ["endsAt", "id", "location", "startsAt", "stats", "title"]);
  assert.match(first.startsAt, ISO);
  assert.match(first.endsAt, ISO);
  assert.equal(r.json.data.events[0].endsAt, null);
  assert.equal(first.location, "Vereinslokal");

  // Zahlen
  await db.event.deleteMany();
  const ev = await makeEvent({ title: "Mit Zahlen" });
  await makeEvent({ title: "Ohne Anmeldungen", startsAt: hours(5) });
  await register(ev.id, (await makeMember()).id, { seats: 2 });
  await register(ev.id, (await makeMember()).id, { seats: 3, attendedAt: new Date() });
  await register(ev.id, (await makeMember()).id, { seats: 4, status: "UNBESTAETIGT", attendedAt: new Date() });
  await register(ev.id, (await makeMember()).id, { seats: 5, status: "ABGESAGT", attendedAt: new Date() });
  await register(ev.id, (await makeMember()).id, { seats: 6, status: "WARTELISTE" });
  await register(ev.id, (await makeMember()).id, { seats: 2, status: "WARTELISTE" });
  const s = await call(EVENTS, "GET", "/api/scanner/v1/events", { token: dev.token });
  const byTitle = new Map<string, EventItem>(s.json.data.events.map((e) => [e.title, e]));
  assert.deepEqual(byTitle.get("Mit Zahlen").stats, { registered: 5, waitlist: 2, attended: 3 });
  assert.deepEqual(byTitle.get("Ohne Anmeldungen").stats, { registered: 0, waitlist: 0, attended: 0 });

  // Höchstens 20
  await db.event.deleteMany();
  for (let i = 0; i < 25; i++) await makeEvent({ title: `Anlass ${String(i).padStart(2, "0")}`, startsAt: hours(1 + i) });
  const many = await call(EVENTS, "GET", "/api/scanner/v1/events", { token: dev.token });
  assert.equal(many.json.data.events.length, 20);
  assert.equal(many.json.data.events[0].title, "Anlass 00");
  assert.equal(many.json.data.events[19].title, "Anlass 19");
});

test("Zeitfenster (rein): Grenzen der Anlässe", () => {
  const now = new Date("2026-11-07T18:00:00.000Z");
  const w = lib.eventWindowWhere(now) as { startsAt: { lte: Date }; OR: Array<{ endsAt: unknown; startsAt?: { gte: Date } }> };
  assert.equal(w.startsAt.lte.toISOString(), "2026-11-21T18:00:00.000Z");
  assert.equal((w.OR[0]!.endsAt as { gte: Date }).gte.toISOString(), "2026-11-07T12:00:00.000Z");
  assert.equal(w.OR[1]!.startsAt!.gte.toISOString(), "2026-11-07T06:00:00.000Z");
});

// ---- Suchbegriff (rein) -------------------------------------------------------------------------------------------------------

test("parseMemberQuery: nur Ziffern = Nummer, sonst Wörter", () => {
  assert.deepEqual(lib.parseMemberQuery("12"), { kind: "number", number: 12 });
  assert.deepEqual(lib.parseMemberQuery(" 007 "), { kind: "number", number: 7 });
  assert.deepEqual(lib.parseMemberQuery("99999999999"), { kind: "number", number: null });
  assert.deepEqual(lib.parseMemberQuery("12a"), { kind: "name", words: ["12a"] });
  assert.deepEqual(lib.parseMemberQuery("Anna  Muster"), { kind: "name", words: ["Anna", "Muster"] });
  assert.equal((lib.parseMemberQuery("a b c d e f g") as { words: string[] }).words.length, 5);
});

// ---- Rate-Limits -----------------------------------------------------------------------------------------------------------------

test("Rate-Limit: je IP 120 pro Minute, dann 429 mit Retry-After", async () => {
  const dev = await makeDevice();
  const ip = "192.0.2.10";
  for (let i = 0; i < 120; i++) assert.equal((await call(ME, "GET", "/api/scanner/v1/me", { token: dev.token, ip })).status, 200, `Anfrage ${i + 1}`);
  const r = await call(ME, "GET", "/api/scanner/v1/me", { token: dev.token, ip });
  assert.equal(r.status, 429);
  assert.equal(r.json.error?.code, "RATE_LIMITED");
  assert.ok(Number(r.headers.get("retry-after")) >= 1);
  assert.equal(r.headers.get("cache-control"), "no-store");
  // Eine andere IP ist nicht betroffen
  assert.equal((await call(ME, "GET", "/api/scanner/v1/me", { token: dev.token, ip: "192.0.2.11" })).status, 200);
});

test("Rate-Limit: ungültige Tokens 20 pro 10 Minuten und IP, gültige Tokens bleiben davon unberührt", async () => {
  const dev = await makeDevice();
  const ip = "192.0.2.20";
  const wrong = tokenLib.generateScannerToken().token;
  for (let i = 0; i < 20; i++) assert.equal((await call(ME, "GET", "/api/scanner/v1/me", { token: wrong, ip })).status, 401, `Fehlversuch ${i + 1}`);
  const blocked = await call(ME, "GET", "/api/scanner/v1/me", { token: wrong, ip });
  assert.equal(blocked.status, 429);
  assert.ok(Number(blocked.headers.get("retry-after")) >= 1);
  // Das gültige Gerät kommt von derselben IP weiter durch
  assert.equal((await call(ME, "GET", "/api/scanner/v1/me", { token: dev.token, ip })).status, 200);
});

test("Rate-Limit: je Gerät 600 pro Minute; /scan und /members zusätzlich 300 pro Minute", async () => {
  const dev = await makeDevice();
  for (let i = 0; i < 600; i++) {
    const r = await call(ME, "GET", "/api/scanner/v1/me", { token: dev.token });
    assert.equal(r.status, 200, `Anfrage ${i + 1}`);
  }
  const over = await call(ME, "GET", "/api/scanner/v1/me", { token: dev.token });
  assert.equal(over.status, 429);
  assert.equal(over.json.error?.code, "RATE_LIMITED");
  assert.ok(Number(over.headers.get("retry-after")) >= 1);
  // Ein anderes Gerät ist nicht betroffen
  const other = await makeDevice();
  assert.equal((await call(ME, "GET", "/api/scanner/v1/me", { token: other.token })).status, 200);

  const heavy = await makeDevice();
  for (let i = 0; i < 300; i++) {
    const r = await call(SCAN, "POST", "/api/scanner/v1/scan", { token: heavy.token, body: { token: "x" } });
    assert.equal(r.status, 200, `Scan ${i + 1}`);
  }
  const scanOver = await call(SCAN, "POST", "/api/scanner/v1/scan", { token: heavy.token, body: { token: "x" } });
  assert.equal(scanOver.status, 429);
  assert.equal((await call(MEMBERS, "GET", "/api/scanner/v1/members?q=ab", { token: heavy.token })).status, 429, "gemeinsame Grenze von /scan und /members");
  assert.equal((await call(ME, "GET", "/api/scanner/v1/me", { token: heavy.token })).status, 200, "die übrigen Routen bleiben bis 600 offen");
});

// ---- Antwortformen -------------------------------------------------------------------------------------------------------------------

test("Antwortformen: {data} bzw. {error:{code,message}}, Zeitpunkte ISO UTC, Daten JJJJ-MM-TT, deutsche Meldungen", async () => {
  const dev = await makeDevice();
  const ev = await makeEvent();
  const m = await makeMember({ joinedAt: dates.dateOnly(2024, 3, 5) });
  await register(ev.id, m.id);
  const scan = await call(SCAN, "POST", "/api/scanner/v1/scan", { token: dev.token, body: { token: scanBody(m.id), eventId: ev.id, checkIn: true } });
  const d = scan.json.data;
  assert.equal(typeof d.valid, "boolean");
  assert.equal(typeof d.member.id, "string");
  assert.equal(typeof d.member.memberNumber, "number");
  assert.match(d.member.joinedAt, DAY);
  assert.equal(d.member.joinedAt, "2024-03-05");
  assert.ok(Array.isArray(d.member.offices));
  assert.equal(typeof d.event.registration.seats, "number");
  assert.equal(typeof d.event.registration.note, "string");
  assert.match(d.event.registration.attendedAt, ISO);
  assert.equal(typeof d.event.checkIn.performed, "boolean");
  assert.equal(scan.json.error, undefined);

  // Fehler: nur code und message (Zeichenfolgen, ohne ß)
  const errs = [
    await call(ME, "GET", "/api/scanner/v1/me", { token: null }),
    await call(SCAN, "POST", "/api/scanner/v1/scan", { token: dev.token, body: { token: "" } }),
    await call(SCAN, "POST", "/api/scanner/v1/scan", { token: dev.token, body: { token: "a", eventId: "gibtesnicht" } }),
    await call(ATTEND, "PATCH", "/x", { token: dev.token, body: { memberId: m.id, attended: true }, params: { id: "gibtesnicht" } }),
  ];
  for (const e of errs) {
    assert.equal(e.json.data, undefined);
    assert.equal(typeof e.json.error?.code, "string");
    assert.equal(typeof e.json.error?.message, "string");
    assert.ok(e.json.error!.message.length > 0 && !/[ß„“”]/.test(e.json.error!.message));
    assert.equal(e.headers.get("cache-control"), "no-store");
    assert.match(e.headers.get("content-type") ?? "", /application\/json/);
  }
  assert.deepEqual(errs.map((e) => [e.status, e.json.error?.code]), [[401, "UNAUTHORIZED"], [422, "VALIDATION_ERROR"], [404, "NOT_FOUND"], [404, "NOT_FOUND"]]);
});

test("isoDay und Mitglied: reine Daten als Kalendertag, Ämter mit Standardbezeichnung", () => {
  assert.equal(lib.isoDay(dates.dateOnly(2024, 3, 5)), "2024-03-05");
  assert.equal(lib.isoDay(dates.dateOnly(2026, 12, 31)), "2026-12-31");
  const info = lib.toScannerMember({
    id: "m1", memberNumber: 3, firstName: "A", lastName: "B", status: "AKTIV", membershipTypeName: "Passivmitglied",
    joinedAt: dates.dateOnly(2020, 1, 1), leftAt: null, offices: [{ kind: "VIZEPRAESIDENT", title: "" }, { kind: "SONSTIGES", title: "Webmaster" }],
  });
  assert.deepEqual(info.offices, ["Vize-Präsident/in", "Webmaster"]);
  assert.equal(info.membershipType, "Passivmitglied");
  assert.equal(info.validUntil, null);
});

// ---- Middleware ------------------------------------------------------------------------------------------------------------------

test("Middleware: /api/scanner wird ohne Sitzung durchgelassen (weder Admin noch Konto), auch mit fremdem Origin-Header", async () => {
  const { middleware } = await import("../../src/middleware.ts");
  const { NextRequest } = await import("next/server");
  const { SITE } = await import("../../src/lib/sites.ts");
  for (const [method, path] of [["GET", "/api/scanner/v1/me"], ["POST", "/api/scanner/v1/scan"], ["PATCH", "/api/scanner/v1/events/abc/attendance"], ["GET", "/api/scanner/v1/members?q=ab"]] as const) {
    const res = await middleware(new NextRequest(`https://${SITE.domain}${path}`, { method, headers: { authorization: "Bearer vgst_x", origin: "https://anderswo.example" } }));
    assert.equal(res.headers.get("x-middleware-next"), "1", `${method} ${path} wird weitergereicht`);
    assert.equal(res.status, 200);
  }
  // Zum Vergleich: der Adminbereich bleibt ohne Sitzung gesperrt
  const admin = await middleware(new NextRequest(`https://${SITE.domain}/api/admin/events`));
  assert.equal(admin.status, 401);
});
