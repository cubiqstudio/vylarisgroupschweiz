// Tests für die Fachlogik des Moduls Anlässe: Plätze und Warteliste, Anmeldeschluss, Erinnerung, Kopie, Kalender (ICS), schema.org, CSV.
// Aufruf:  npx tsx scripts/test/events.test.mts
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { test } from "node:test";

const require = createRequire(import.meta.url);
const serverOnlyPath = require.resolve("server-only");
require.cache[serverOnlyPath] = { id: serverOnlyPath, filename: serverOnlyPath, loaded: true, exports: {}, children: [], paths: [] } as unknown as NodeJS.Module;

const dates = await import("../../src/lib/verein/dates.ts");
const lib = await import("../../src/lib/verein/events-lib.ts");
const ics = await import("../../src/lib/verein/ics.ts");
const csv = await import("../../src/lib/verein/csv.ts");
const token = await import("../../src/lib/verein/events-token.ts");
const schemas = await import("../../src/lib/verein/events-schemas.ts");

const zurich = dates.zurichToDate;

// ---- Plätze und Warteliste ----------------------------------------------------------------------------------------------

test("Plätze: nur angemeldete Personen belegen, Warteliste zählt separat", () => {
  const rows = [
    { status: "ANGEMELDET", seats: 2 },
    { status: "ANGEMELDET", seats: 1 },
    { status: "WARTELISTE", seats: 3 },
    { status: "ABGESAGT", seats: 4 },
  ];
  assert.equal(lib.seatsTaken(rows), 3);
  assert.equal(lib.seatsWaiting(rows), 3);
  assert.equal(lib.seatsLeft(10, 3), 7);
  assert.equal(lib.seatsLeft(2, 3), 0, "nie negativ, auch bei überbuchtem Anlass");
  assert.equal(lib.seatsLeft(null, 99), null);
});

test("Anmeldung: Platz frei, Warteliste, unbegrenzt, zu grosse Gruppe", () => {
  assert.deepEqual(lib.decideRegistration({ capacity: null, taken: 500, seats: 5 }), { ok: true, status: "ANGEMELDET" });
  assert.deepEqual(lib.decideRegistration({ capacity: 10, taken: 8, seats: 2 }), { ok: true, status: "ANGEMELDET" });
  assert.deepEqual(lib.decideRegistration({ capacity: 10, taken: 9, seats: 2 }), { ok: true, status: "WARTELISTE" });
  assert.deepEqual(lib.decideRegistration({ capacity: 10, taken: 10, seats: 1 }), { ok: true, status: "WARTELISTE" });
  assert.deepEqual(lib.decideRegistration({ capacity: 3, taken: 0, seats: 4 }), { ok: false, reason: "TOO_LARGE" });
  assert.deepEqual(lib.decideRegistration({ capacity: 3, taken: 0, seats: 3 }), { ok: true, status: "ANGEMELDET" });
});

test("Warteliste: Nachrücken in der Reihenfolge der Anmeldung", () => {
  const waiting = [
    { id: "a", seats: 1 },
    { id: "b", seats: 1 },
    { id: "c", seats: 1 },
  ];
  assert.deepEqual(lib.planPromotions({ capacity: 10, taken: 8, waiting }), ["a", "b"], "zwei freie Plätze: die zwei Ältesten");
  assert.deepEqual(lib.planPromotions({ capacity: 10, taken: 10, waiting }), []);
  assert.deepEqual(lib.planPromotions({ capacity: 10, taken: 7, waiting }), ["a", "b", "c"]);
  assert.deepEqual(lib.planPromotions({ capacity: null, taken: 100, waiting }), ["a", "b", "c"], "ohne Kapazitätsgrenze rücken alle nach");
  assert.deepEqual(lib.planPromotions({ capacity: 5, taken: 0, waiting: [] }), []);
});

test("Warteliste: eine zu grosse Gruppe blockiert kleinere dahinter nicht (keine leeren Plätze)", () => {
  const waiting = [
    { id: "gross", seats: 4 },
    { id: "klein1", seats: 1 },
    { id: "klein2", seats: 1 },
  ];
  // 2 Plätze frei: die Vierergruppe passt nicht, die zwei Einzelpersonen schon.
  assert.deepEqual(lib.planPromotions({ capacity: 10, taken: 8, waiting }), ["klein1", "klein2"]);
  // 5 Plätze frei: die Vierergruppe (älteste) rückt zuerst nach, dann klein1; klein2 passt nicht mehr.
  assert.deepEqual(lib.planPromotions({ capacity: 10, taken: 5, waiting }), ["gross", "klein1"]);
});

test("Warteliste: Szenario Absage macht Platz frei", () => {
  // Kapazität 3: A(2) und B(1) angemeldet, C(2) und D(1) auf der Warteliste.
  const regs = [
    { id: "A", status: "ANGEMELDET", seats: 2 },
    { id: "B", status: "ANGEMELDET", seats: 1 },
    { id: "C", status: "WARTELISTE", seats: 2 },
    { id: "D", status: "WARTELISTE", seats: 1 },
  ];
  assert.equal(lib.seatsTaken(regs), 3);
  // B sagt ab → 1 Platz frei: C (2) passt nicht, D (1) rückt nach.
  const after = regs.map((r) => (r.id === "B" ? { ...r, status: "ABGESAGT" } : r));
  const promoted = lib.planPromotions({ capacity: 3, taken: lib.seatsTaken(after), waiting: after.filter((r) => r.status === "WARTELISTE") });
  assert.deepEqual(promoted, ["D"]);
});

// ---- Anmeldeschluss ------------------------------------------------------------------------------------------------------

test("Anmeldung: Sperrgründe", () => {
  const start = zurich(2026, 11, 20, 19, 0);
  const base = { status: "VEROEFFENTLICHT", startsAt: start, registrationDeadline: null as Date | null };
  const now = zurich(2026, 11, 5, 12, 0);
  assert.equal(lib.registrationBlock(base, now), null);
  assert.equal(lib.registrationBlock({ ...base, status: "ENTWURF" }, now), "DRAFT");
  assert.equal(lib.registrationBlock({ ...base, status: "ABGESAGT" }, now), "CANCELLED");
  assert.equal(lib.registrationBlock(base, zurich(2026, 11, 20, 19, 0)), "PAST", "ab Beginn keine Anmeldung mehr");
  const deadline = zurich(2026, 11, 15, 23, 59);
  assert.equal(lib.registrationBlock({ ...base, registrationDeadline: deadline }, zurich(2026, 11, 15, 23, 0)), null);
  assert.equal(lib.registrationBlock({ ...base, registrationDeadline: deadline }, zurich(2026, 11, 16, 8, 0)), "DEADLINE");
});

test("Abmelden: bis zum Beginn, bei Absage jederzeit", () => {
  const start = zurich(2026, 11, 20, 19, 0);
  assert.equal(lib.canCancelRegistration({ status: "VEROEFFENTLICHT", startsAt: start }, zurich(2026, 11, 20, 18, 59)), true);
  assert.equal(lib.canCancelRegistration({ status: "VEROEFFENTLICHT", startsAt: start }, zurich(2026, 11, 20, 19, 1)), false);
  assert.equal(lib.canCancelRegistration({ status: "ABGESAGT", startsAt: start }, zurich(2026, 12, 1, 8, 0)), true);
});

test("Kommend: Tag des Beginns zählt noch, Ende verlängert", () => {
  const now = zurich(2026, 11, 5, 15, 0);
  assert.equal(lib.isUpcoming({ startsAt: zurich(2026, 11, 5, 9, 0), endsAt: null }, now), true, "heute früher begonnen, ohne Ende: noch kommend");
  assert.equal(lib.isUpcoming({ startsAt: zurich(2026, 11, 4, 20, 0), endsAt: null }, now), false);
  assert.equal(lib.isUpcoming({ startsAt: zurich(2026, 11, 4, 20, 0), endsAt: zurich(2026, 11, 5, 23, 0) }, now), true, "mehrtägig, läuft noch");
  assert.equal(lib.isUpcoming({ startsAt: zurich(2026, 12, 1, 9, 0), endsAt: null }, now), true);
});

// ---- Erinnerung ----------------------------------------------------------------------------------------------------------

test("Erinnerung: nur kurz vor dem Beginn", () => {
  const now = zurich(2026, 11, 5, 8, 0);
  assert.equal(lib.isReminderDue(zurich(2026, 11, 6, 19, 0), now), true, "morgen Abend");
  assert.equal(lib.isReminderDue(zurich(2026, 11, 6, 20, 0), now), true, "36 Stunden: gerade noch");
  assert.equal(lib.isReminderDue(zurich(2026, 11, 6, 20, 1), now), false);
  assert.equal(lib.isReminderDue(zurich(2026, 11, 8, 19, 0), now), false);
  assert.equal(lib.isReminderDue(zurich(2026, 11, 5, 7, 0), now), false, "schon begonnen");
  assert.equal(lib.REMINDER_WINDOW_HOURS, 36);
});

// ---- Kopie ---------------------------------------------------------------------------------------------------------------

test("Kopie: Dauer und Anmeldeschluss bleiben, Entwurf", () => {
  const src = {
    title: "Hock",
    description: "Text",
    location: "Heiden",
    startsAt: zurich(2026, 11, 20, 19, 0),
    endsAt: zurich(2026, 11, 20, 22, 0),
    capacity: 20,
    registrationDeadline: zurich(2026, 11, 18, 19, 0),
    isPublic: true,
    membersOnly: false,
  };
  const copy = lib.planCopy(src, zurich(2026, 12, 18, 19, 0));
  assert.equal(copy.status, "ENTWURF");
  assert.equal(copy.startsAt.getTime(), zurich(2026, 12, 18, 19, 0).getTime());
  assert.equal(copy.endsAt?.getTime(), zurich(2026, 12, 18, 22, 0).getTime());
  assert.equal(copy.registrationDeadline?.getTime(), zurich(2026, 12, 16, 19, 0).getTime());
  assert.equal(copy.capacity, 20);
  assert.equal(lib.planCopy({ ...src, endsAt: null, registrationDeadline: null }, zurich(2027, 1, 1, 10, 0)).endsAt, null);
});

// ---- Prüfung der Angaben ----------------------------------------------------------------------------------------------------

test("Angaben: Zusammenhänge", () => {
  const ok = { startsAt: zurich(2026, 11, 20, 19, 0), endsAt: null, registrationDeadline: null, isPublic: true, membersOnly: false, capacity: 10 };
  assert.deepEqual(lib.eventConsistencyErrors(ok), {});
  assert.ok(lib.eventConsistencyErrors({ ...ok, endsAt: zurich(2026, 11, 20, 18, 0) }).endsAt);
  assert.ok(lib.eventConsistencyErrors({ ...ok, registrationDeadline: zurich(2026, 11, 21, 0, 0) }).registrationDeadline);
  assert.ok(lib.eventConsistencyErrors({ ...ok, isPublic: false, membersOnly: false }).membersOnly, "Gäste nur bei öffentlichem Anlass");
  assert.ok(lib.eventConsistencyErrors({ ...ok, capacity: 0 }).capacity);
});

test("Schema: Anlass anlegen liest Zürcher Zeit, Kapazität leer = unbegrenzt", () => {
  const input = schemas.eventCreateSchema.parse({ title: "Sommerhock", startsAt: "2026-07-10T18:30", capacity: "", isPublic: true, membersOnly: false });
  assert.equal(input.startsAt.getTime(), zurich(2026, 7, 10, 18, 30).getTime());
  assert.equal(input.capacity, null);
  assert.equal(input.status, "ENTWURF");
  assert.equal(schemas.eventCreateSchema.parse({ title: "Sommerhock", startsAt: "2026-07-10T18:30", capacity: "25" }).capacity, 25);
  assert.throws(() => schemas.eventCreateSchema.parse({ title: "Sommerhock", startsAt: "2026-07-10T18:30", capacity: "abc" }));
  assert.throws(() => schemas.eventCreateSchema.parse({ title: "Sommerhock", startsAt: "2026-07-10T18:30", endsAt: "2026-07-10T17:00" }), "Ende vor Beginn");
  assert.throws(() => schemas.eventCreateSchema.parse({ title: "ab", startsAt: "2026-07-10T18:30" }), "Titel zu kurz");
  assert.throws(() => schemas.eventCreateSchema.parse({ title: "Sommerhock", startsAt: "2026-07-10T18:30", isPublic: false, membersOnly: false }));
});

test("Schema: Gast-Anmeldung verlangt Einwilligung, begrenzt Personen, Honeypot bleibt lesbar", () => {
  const good = { name: "Anna Muster", email: " Anna@Example.CH ", seats: "2", consent: true };
  const parsed = schemas.guestRegistrationSchema.parse(good);
  assert.equal(parsed.email, "anna@example.ch");
  assert.equal(parsed.seats, 2);
  assert.equal(parsed.website, "");
  assert.throws(() => schemas.guestRegistrationSchema.parse({ ...good, consent: false }));
  assert.throws(() => schemas.guestRegistrationSchema.parse({ name: "Anna Muster", email: "anna@example.ch" }));
  assert.throws(() => schemas.guestRegistrationSchema.parse({ ...good, seats: 6 }));
  assert.throws(() => schemas.guestRegistrationSchema.parse({ ...good, seats: 0 }));
  assert.throws(() => schemas.guestRegistrationSchema.parse({ ...good, email: "keine-mail" }));
  assert.equal(schemas.memberRegistrationSchema.parse({}).seats, 1);
  assert.throws(() => schemas.memberRegistrationSchema.parse({ seats: 11 }));
});

test("Schema: Vorstand trägt Mitglied oder Gast ein", () => {
  assert.equal(schemas.adminRegistrationSchema.parse({ memberId: "abc123" }).memberId, "abc123");
  assert.throws(() => schemas.adminRegistrationSchema.parse({}));
  assert.throws(() => schemas.adminRegistrationSchema.parse({ guestName: "A" }));
  assert.equal(schemas.adminRegistrationSchema.parse({ guestName: "Gast Eins" }).guestEmail, "");
  assert.equal(schemas.registrationActionSchema.parse({ action: "attendance", attended: true }).action, "attendance");
  assert.throws(() => schemas.registrationActionSchema.parse({ action: "löschen" }));
});

// ---- Token ---------------------------------------------------------------------------------------------------------------

test("Abmelde-Token: zufällig, nur als Hash gespeichert, Form wird geprüft", () => {
  const a = token.generateCancelToken();
  const b = token.generateCancelToken();
  assert.notEqual(a.token, b.token);
  assert.match(a.token, /^[A-Za-z0-9_-]{43}$/);
  assert.match(a.hash, /^[0-9a-f]{64}$/);
  assert.equal(token.hashCancelToken(a.token), a.hash);
  assert.notEqual(a.token, a.hash);
  assert.equal(token.isPlausibleCancelToken(a.token), true);
  assert.equal(token.isPlausibleCancelToken("zu kurz"), false);
  assert.equal(token.isPlausibleCancelToken(`${a.token}x`), false);
  assert.equal(token.isPlausibleCancelToken(undefined), false);
  assert.equal(token.secretsEqual("geheim", "geheim"), true);
  assert.equal(token.secretsEqual("geheim", "geheiM"), false);
  assert.equal(token.secretsEqual("a", "ab"), false);
});

// ---- Anzeige -------------------------------------------------------------------------------------------------------------

test("Anzeige: Zeitangabe in Zürcher Zeit (Winter und Sommer)", () => {
  // Winter: 18:30 UTC = 19:30 Zürich; Sommer: 17:30 UTC = 19:30 Zürich
  const winter = new Date(Date.UTC(2026, 10, 5, 18, 30));
  const summer = new Date(Date.UTC(2026, 6, 9, 17, 30));
  assert.equal(lib.formatEventWhen(winter), "Donnerstag, 5.11.2026, 19:30 Uhr");
  assert.equal(lib.formatEventWhen(summer), "Donnerstag, 9.7.2026, 19:30 Uhr");
  assert.equal(lib.formatEventWhen(winter, new Date(Date.UTC(2026, 10, 5, 20, 0))), "Donnerstag, 5.11.2026, 19:30 – 21:00 Uhr");
  assert.equal(lib.formatEventWhen(winter, new Date(Date.UTC(2026, 10, 6, 1, 0))), "5.11.2026, 19:30 Uhr – 6.11.2026, 02:00 Uhr");
  assert.equal(lib.formatEventWhen(winter, winter), "Donnerstag, 5.11.2026, 19:30 Uhr", "Ende = Beginn zählt als ohne Ende");
  assert.deepEqual(lib.calendarBadge(winter), { day: "5", month: "Nov.", weekday: "Do" });
});

test("Markdown: schlichter Text ohne HTML und Links", () => {
  const md = "# Titel\n\nEin **fetter** Text mit [Link](https://example.com) und `Code`.\n\n- Punkt 1\n- Punkt 2\n\n<script>alert(1)</script>";
  const t = lib.stripMarkdown(md, 500);
  assert.ok(!t.includes("<"));
  assert.ok(!t.includes("**"));
  assert.ok(!t.includes("https://"));
  assert.ok(t.includes("fetter"));
  assert.ok(t.includes("Link"));
  const long = lib.stripMarkdown("Wort ".repeat(100), 50);
  assert.ok(long.length <= 50 && long.endsWith("…"));
});

// ---- Kalender (ICS) -------------------------------------------------------------------------------------------------------

const sampleEvent = {
  id: "cabc123",
  title: "Sommerhock, mit Grill",
  description: "Wir **grillieren**.\nBring etwas mit!",
  location: "Schützengasse 13, Heiden",
  startsAt: new Date(Date.UTC(2026, 6, 9, 17, 30)),
  endsAt: new Date(Date.UTC(2026, 6, 9, 20, 0)),
  status: "VEROEFFENTLICHT",
  updatedAt: new Date(Date.UTC(2026, 5, 1, 8, 0, 0)),
  sequence: 2,
};

test("ICS: Aufbau nach RFC 5545 (CRLF, UTC, stabile UID, Escaping)", () => {
  const text = ics.buildIcs([lib.eventToIcs(sampleEvent, "https://vylaris.ch/anlaesse/cabc123")], { calendarName: "Anlässe", now: new Date(Date.UTC(2026, 6, 1)) });
  assert.ok(text.startsWith("BEGIN:VCALENDAR\r\n"));
  assert.ok(text.endsWith("END:VCALENDAR\r\n"));
  assert.ok(!/(^|[^\r])\n/.test(text), "jede Zeile endet mit CRLF");
  assert.ok(text.includes("UID:anlass-cabc123@vylaris.ch\r\n"));
  assert.ok(text.includes("DTSTART:20260709T173000Z\r\n"));
  assert.ok(text.includes("DTEND:20260709T200000Z\r\n"));
  assert.ok(text.includes("DTSTAMP:20260601T080000Z\r\n"));
  assert.ok(text.includes("SEQUENCE:2\r\n"));
  assert.ok(text.includes("STATUS:CONFIRMED\r\n"));
  assert.ok(text.includes("SUMMARY:Sommerhock\\, mit Grill\r\n"));
  assert.ok(text.includes("URL:https://vylaris.ch/anlaesse/cabc123\r\n"));
  assert.ok(text.includes("DESCRIPTION:Wir grillieren. Bring etwas mit!\r\n"));
  assert.ok(text.includes("LOCATION:Schützengasse 13\\, Heiden\r\n"), "Komma im Ort ist escaped");
  assert.ok(!text.includes("**"), "Markdown wird nicht in den Kalender übernommen");
  assert.equal((text.match(/BEGIN:VEVENT/g) ?? []).length, 1);
  // UID bleibt bei Änderungen gleich
  const moved = ics.buildIcs([lib.eventToIcs({ ...sampleEvent, startsAt: new Date(Date.UTC(2026, 6, 10, 17, 30)), sequence: 3 })]);
  assert.ok(moved.includes("UID:anlass-cabc123@vylaris.ch\r\n"));
  assert.ok(moved.includes("SEQUENCE:3\r\n"));
});

test("ICS: lange Zeilen werden auf 75 Oktette gefaltet, Umlaute bleiben heil", () => {
  const long = { ...sampleEvent, description: "Ä".repeat(200) };
  const text = ics.buildIcs([lib.eventToIcs(long)]);
  const enc = new TextEncoder();
  for (const line of text.split("\r\n")) assert.ok(enc.encode(line).length <= 75, `Zeile zu lang: ${line.length}`);
  const unfolded = text.replace(/\r\n /g, "");
  assert.ok(unfolded.includes("DESCRIPTION:" + "Ä".repeat(200)), "entfaltet ist der Text vollständig");
});

test("ICS: abgesagte Anlässe sind CANCELLED, Anlass ohne Ende hat kein DTEND", () => {
  const text = ics.buildIcs([lib.eventToIcs({ ...sampleEvent, status: "ABGESAGT", endsAt: null })]);
  assert.ok(text.includes("STATUS:CANCELLED\r\n"));
  assert.ok(!text.includes("DTEND"));
});

test("ICS: Feed mit mehreren Anlässen und Kalenderende", () => {
  const text = ics.buildIcs([lib.eventToIcs(sampleEvent), lib.eventToIcs({ ...sampleEvent, id: "zwei" })]);
  assert.equal((text.match(/BEGIN:VEVENT/g) ?? []).length, 2);
  assert.equal((text.match(/END:VEVENT/g) ?? []).length, 2);
  assert.ok(text.includes("UID:anlass-zwei@vylaris.ch"));
});

// ---- schema.org ----------------------------------------------------------------------------------------------------------

test("schema.org: Event mit Zürcher Offset, Status und Kapazität", () => {
  assert.equal(lib.isoZurich(new Date(Date.UTC(2026, 10, 5, 18, 30))), "2026-11-05T19:30:00+01:00");
  assert.equal(lib.isoZurich(new Date(Date.UTC(2026, 6, 9, 17, 30))), "2026-07-09T19:30:00+02:00");
  const ld = lib.eventJsonLd({ ...sampleEvent, capacity: 30 }, { url: "https://vylaris.ch/anlaesse/cabc123", organizerName: "VylarisGroup", organizerUrl: "https://vylaris.ch" });
  assert.equal(ld["@type"], "Event");
  assert.equal(ld.startDate, "2026-07-09T19:30:00+02:00");
  assert.equal(ld.endDate, "2026-07-09T22:00:00+02:00");
  assert.equal(ld.eventStatus, "https://schema.org/EventScheduled");
  assert.equal(ld.maximumAttendeeCapacity, 30);
  assert.ok(!("offers" in ld), "keine erfundenen Preise");
  const cancelled = lib.eventJsonLd({ ...sampleEvent, status: "ABGESAGT", capacity: null, location: "" }, { url: "https://vylaris.ch/x", organizerName: "V", organizerUrl: "https://vylaris.ch" });
  assert.equal(cancelled.eventStatus, "https://schema.org/EventCancelled");
  assert.ok(!("location" in cancelled) && !("maximumAttendeeCapacity" in cancelled));
});

test("schema.org: JSON im Skriptblock kann ihn nicht beenden", () => {
  const s = lib.jsonLdString({ name: "</script><script>alert(1)</script>" });
  assert.ok(!s.includes("</script>"));
  assert.ok(!s.includes("<"));
  assert.equal(JSON.parse(s).name, "</script><script>alert(1)</script>");
});

// ---- CSV -----------------------------------------------------------------------------------------------------------------

test("CSV: Teilnehmerliste neutralisiert Formeln und nennt Mitglied/Gast", () => {
  const rows = lib.registrationCsvRows([
    { name: "=HYPERLINK(\"http://böse\")", isMember: false, memberNumber: null, email: "+a@example.ch", seats: 2, statusLabel: "Angemeldet", attended: true, createdAt: new Date(Date.UTC(2026, 10, 5, 12)), note: "@Note" },
    { name: "Anna Muster", isMember: true, memberNumber: 7, email: "anna@example.ch", seats: 1, statusLabel: "Warteliste", attended: false, createdAt: new Date(Date.UTC(2026, 10, 6, 12)), note: "" },
  ]);
  const text = csv.toCsv(lib.REGISTRATION_CSV_HEADERS, rows);
  const lines = text.replace(csv.CSV_BOM, "").split("\r\n");
  assert.equal(lines[0], "Name;Art;Mitgliedernr.;E-Mail;Personen;Status;Anwesend;Angemeldet am;Bemerkung");
  assert.ok(lines[1]!.startsWith("\"'=HYPERLINK("), "Formel am Zellanfang wird mit ' neutralisiert");
  assert.ok(lines[1]!.includes(";Gast;"));
  assert.ok(lines[1]!.includes(";'+a@example.ch;"));
  assert.ok(lines[1]!.includes(";'@Note"));
  assert.ok(lines[1]!.includes(";Ja;"));
  assert.ok(lines[2]!.startsWith("Anna Muster;Mitglied;7;anna@example.ch;1;Warteliste;Nein;6.11.2026;"));
});

test("Name einer Anmeldung: Mitglied, Gast, anonymisiert", () => {
  assert.equal(lib.registrantName({ guestName: "", member: { firstName: "Anna", lastName: "Muster" } }), "Anna Muster");
  assert.equal(lib.registrantName({ guestName: " Gast ", member: null }), "Gast");
  assert.equal(lib.registrantName({ guestName: "", member: null }), "Gast");
  assert.equal(lib.registrantName({ guestName: "", member: { firstName: "", lastName: "", anonymizedAt: new Date() } }), "Anonymisiertes Mitglied");
});

// ---- Bestätigung der E-Mail-Adresse (Double-Opt-In für Gäste) ---------------------------------------------------------

const SECRET = "ein-geheimnis-fuer-den-test-mindestens-32-zeichen";

test("Bestätigungs-Token: signiert, 48 Stunden gültig, nur für diese Anmeldung", () => {
  const created = new Date("2026-11-05T10:00:00Z");
  const expires = lib.confirmExpiresAt(created);
  assert.equal(expires.getTime() - created.getTime(), 48 * 3_600_000);
  const t = token.signConfirmToken(SECRET, "reg_abc123", expires);
  assert.ok(token.isPlausibleConfirmToken(t));
  assert.ok(!t.includes("@"), "keine Personendaten im Token");
  const ok = token.verifyConfirmToken(SECRET, t, new Date("2026-11-06T10:00:00Z"));
  assert.deepEqual(ok, { ok: true, registrationId: "reg_abc123", expiresAt: expires });
  // Kurz vor dem Ablauf gilt es, zum Ablaufzeitpunkt nicht mehr.
  assert.equal(token.verifyConfirmToken(SECRET, t, new Date(expires.getTime() - 1)).ok, true);
  assert.deepEqual(token.verifyConfirmToken(SECRET, t, expires), { ok: false, reason: "EXPIRED", registrationId: "reg_abc123" });
  assert.deepEqual(token.verifyConfirmToken(SECRET, t, new Date("2026-12-31T00:00:00Z")), { ok: false, reason: "EXPIRED", registrationId: "reg_abc123" });
});

test("Bestätigungs-Token: gefälscht, falsches Geheimnis, verlängerte Frist, fremde Anmeldung, Müll", () => {
  const expires = new Date("2026-11-07T10:00:00Z");
  const now = new Date("2026-11-05T10:00:00Z");
  const t = token.signConfirmToken(SECRET, "reg_a", expires);
  const [id, ms, sig] = t.split(".") as [string, string, string];
  const invalid = { ok: false, reason: "INVALID" };
  assert.deepEqual(token.verifyConfirmToken("anderes-geheimnis-anderes-geheimnis-xx", t, now), invalid);
  assert.deepEqual(token.verifyConfirmToken(SECRET, `${id}.${Number(ms) + 86_400_000}.${sig}`, now), invalid, "Frist lässt sich nicht verlängern");
  assert.deepEqual(token.verifyConfirmToken(SECRET, `reg_b.${ms}.${sig}`, now), invalid, "Signatur gilt nur für die eigene Anmeldung");
  assert.deepEqual(token.verifyConfirmToken(SECRET, `${id}.${ms}.${sig.slice(0, -1)}A`, now), invalid);
  for (const junk of ["", "a.b", "a.b.c.d", `${id}.${ms}.`, `${id}..${sig}`, null, undefined, 42, "x".repeat(500)]) {
    assert.deepEqual(token.verifyConfirmToken(SECRET, junk, now), invalid, String(junk));
    assert.equal(token.isPlausibleConfirmToken(junk), false);
  }
  assert.throws(() => token.signConfirmToken(SECRET, "../etc", expires));
  assert.equal(schemas.confirmTokenSchema.safeParse({ token: t }).success, true);
  assert.equal(schemas.confirmTokenSchema.safeParse({ token: "nope" }).success, false);
});

test("Bestätigung: Frist, Drosselung des erneuten Versands, Stichtag fürs Aufräumen", () => {
  const created = new Date("2026-11-05T10:00:00Z");
  assert.equal(lib.isConfirmationExpired(created, new Date("2026-11-07T09:59:59Z")), false);
  assert.equal(lib.isConfirmationExpired(created, new Date("2026-11-07T10:00:00Z")), true);

  assert.equal(lib.canResendConfirmation(null, created), true, "noch nie verschickt");
  const sent = new Date("2026-11-05T10:00:00Z");
  assert.equal(lib.canResendConfirmation(sent, new Date(sent.getTime() + (lib.CONFIRM_RESEND_MINUTES * 60_000 - 1))), false);
  assert.equal(lib.canResendConfirmation(sent, new Date(sent.getTime() + lib.CONFIRM_RESEND_MINUTES * 60_000)), true);

  const now = new Date("2026-11-10T12:00:00Z");
  assert.equal(lib.confirmPurgeCutoff(now).getTime(), now.getTime() - 48 * 3_600_000);
});

test("Plätze: unbestätigte Anmeldungen belegen nichts und zählen nicht zur Warteliste", () => {
  const rows = [
    { status: "ANGEMELDET", seats: 2 },
    { status: "UNBESTAETIGT", seats: 5 },
    { status: "WARTELISTE", seats: 1 },
  ];
  assert.equal(lib.seatsTaken(rows), 2);
  assert.equal(lib.seatsWaiting(rows), 1);
  assert.deepEqual(lib.decideRegistration({ capacity: 5, taken: lib.seatsTaken(rows), seats: 3 }), { ok: true, status: "ANGEMELDET" });
});

test("Schema: Vorstand kann eine Anmeldung von Hand bestätigen", () => {
  const r = schemas.registrationActionSchema.safeParse({ action: "confirm" });
  assert.equal(r.success, true);
  if (r.success) assert.deepEqual(r.data, { action: "confirm", force: false, sendMail: true });
});
