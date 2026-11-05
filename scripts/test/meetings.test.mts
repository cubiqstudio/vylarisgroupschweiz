// Tests für die Fachlogik des Moduls Versammlungen (Abstimmungsergebnis, Einladungsfrist, Beschlussfähigkeit, Protokoll-Entwurf, Antwort-Link, Register-Export).
// Aufruf:  npx tsx scripts/test/meetings.test.mts
import assert from "node:assert/strict";
import { test } from "node:test";

const dates = await import("../../src/lib/verein/dates.ts");
const lib = await import("../../src/lib/verein/meetings-lib.ts");
const token = await import("../../src/lib/verein/meetings-token.ts");
const schemas = await import("../../src/lib/verein/meetings-schemas.ts");
const csv = await import("../../src/lib/verein/csv.ts");
const ics = await import("../../src/lib/verein/ics.ts");

const d = dates.dateOnly;
const fmt = dates.formatDateCh;

// ---- Abstimmungsergebnis -----------------------------------------------------------------------------------------------

test("Abstimmung: einfaches Mehr der abgegebenen Stimmen, Enthaltungen zählen nicht mit", () => {
  assert.equal(lib.tallyResolution({ yes: 5, no: 2, abstentions: 3 }).result, "ANGENOMMEN");
  assert.equal(lib.tallyResolution({ yes: 2, no: 5, abstentions: 0 }).result, "ABGELEHNT");
  // 3 Ja, 2 Nein, 10 Enthaltungen: einfaches Mehr der abgegebenen Stimmen (Ja + Nein) genügt
  const o = lib.tallyResolution({ yes: 3, no: 2, abstentions: 10 });
  assert.equal(o.result, "ANGENOMMEN");
  assert.equal(o.cast, 5);
});

test("Abstimmung: Stimmengleichheit ist abgelehnt mit Hinweis, ohne Auszählung kein Ergebnis", () => {
  const tie = lib.tallyResolution({ yes: 3, no: 3 });
  assert.equal(tie.result, "ABGELEHNT");
  assert.equal(tie.tie, true);
  assert.match(tie.note, /Statuten/);
  assert.equal(lib.tallyResolution({ yes: null, no: null }).result, null);
  assert.equal(lib.tallyResolution({ yes: 4, no: null }).result, null);
  assert.equal(lib.tallyResolution({ yes: 0, no: 0, abstentions: 4 }).result, null);
  assert.equal(lib.tallyResolution({ yes: -1, no: 2 }).result, null);
  assert.equal(lib.tallyResolution({ yes: 1.5, no: 2 }).result, null);
});

test("Abstimmung: zwei Drittel und absolutes Mehr", () => {
  assert.equal(lib.tallyResolution({ yes: 6, no: 3, majority: "ZWEIDRITTEL" }).result, "ANGENOMMEN"); // genau 2/3
  assert.equal(lib.tallyResolution({ yes: 5, no: 3, majority: "ZWEIDRITTEL" }).result, "ABGELEHNT");
  assert.equal(lib.tallyResolution({ yes: 4, no: 1, majority: "ABSOLUT", presentVoters: 7 }).result, "ANGENOMMEN"); // 4 > 3.5
  assert.equal(lib.tallyResolution({ yes: 3, no: 0, majority: "ABSOLUT", presentVoters: 7 }).result, "ABGELEHNT");
  assert.equal(lib.tallyResolution({ yes: 3, no: 0, majority: "ABSOLUT" }).result, null); // Zahl der Stimmberechtigten fehlt
  assert.equal(lib.tallyResolution({ yes: 3, no: 0, majority: "ABSOLUT", presentVoters: 6 }).result, "ABGELEHNT"); // 3 ist nicht mehr als die Hälfte von 6
});

test("Abstimmung: Kurztext", () => {
  assert.equal(lib.voteSummary({ votesYes: 5, votesNo: 2, abstentions: 1 }), "Ja 5, Nein 2, Enthaltungen 1");
  assert.equal(lib.voteSummary({ votesYes: null, votesNo: null, abstentions: null }), "");
});

// ---- Einladungsfrist -----------------------------------------------------------------------------------------------------

test("Einladungsfrist: rechtzeitig, zu spät, unbekannt, vorbei", () => {
  const start = dates.zurichToDate(2026, 12, 10, 19, 30);
  const now = dates.zurichToDate(2026, 11, 5, 12, 0);
  const ok = lib.invitationTiming({ start, minDays: 20, now });
  assert.equal(ok.state, "ok");
  assert.equal(fmt(ok.latest!), "20.11.2026"); // 10.12. minus 20 Tage
  // Genau am letzten Tag ist es noch rechtzeitig, einen Tag später nicht
  assert.equal(lib.invitationTiming({ start, minDays: 20, now: dates.zurichToDate(2026, 11, 20, 23, 0) }).state, "ok");
  const late = lib.invitationTiming({ start, minDays: 20, now: dates.zurichToDate(2026, 11, 21, 8, 0) });
  assert.equal(late.state, "late");
  assert.equal(late.daysShort, 1);
  assert.match(late.text, /unterschritten/);
  assert.equal(lib.invitationTiming({ start, minDays: null, now }).state, "unknown");
  assert.equal(lib.invitationTiming({ start, minDays: null, now }).latest, null);
  assert.equal(lib.invitationTiming({ start, minDays: 20, now: dates.zurichToDate(2026, 12, 11, 8, 0) }).state, "past");
});

test("Einladungsfrist: früherer Versand beurteilen", () => {
  const start = dates.zurichToDate(2026, 12, 10, 19, 30);
  assert.equal(lib.wasSentOnTime(d(2026, 11, 20), start, 20), true);
  assert.equal(lib.wasSentOnTime(d(2026, 11, 21), start, 20), false);
  assert.equal(lib.wasSentOnTime(d(2026, 11, 21), start, null), null);
});

// ---- Beschlussfähigkeit (nur Hinweis) --------------------------------------------------------------------------------------

test("Beschlussfähigkeit: nur Hinweis, nie Sperre", () => {
  assert.equal(lib.quorumHint({ presentVoters: 3, quorumMin: null }).state, "none");
  assert.equal(lib.quorumHint({ presentVoters: 4, quorumMin: 4 }).state, "ok");
  const below = lib.quorumHint({ presentVoters: 2, quorumMin: 4 });
  assert.equal(below.state, "below");
  assert.match(below.text, /Statuten/);
  assert.equal(lib.countPresentVoters([{ status: "ANWESEND", canVote: true }, { status: "ANWESEND", canVote: false }, { status: "ENTSCHULDIGT", canVote: true }]), 1);
});

// ---- Reihenfolge und Nummern -------------------------------------------------------------------------------------------------

test("Reihenfolge der Traktanden: auf und ab, Ränder bleiben", () => {
  assert.deepEqual(lib.moveId(["a", "b", "c"], "b", "up"), ["b", "a", "c"]);
  assert.deepEqual(lib.moveId(["a", "b", "c"], "b", "down"), ["a", "c", "b"]);
  assert.deepEqual(lib.moveId(["a", "b", "c"], "a", "up"), ["a", "b", "c"]);
  assert.deepEqual(lib.moveId(["a", "b", "c"], "c", "down"), ["a", "b", "c"]);
  assert.deepEqual(lib.moveId(["a", "b"], "x", "up"), ["a", "b"]);
  assert.equal(lib.nextResolutionNumber([]), 1);
  assert.equal(lib.nextResolutionNumber([1, 2, 5]), 6);
});

// ---- Darstellung -------------------------------------------------------------------------------------------------------------

test("Zeitangabe in Zürcher Zeit", () => {
  const start = dates.zurichToDate(2026, 11, 5, 19, 30);
  assert.equal(lib.formatMeetingWhen(start, dates.zurichToDate(2026, 11, 5, 21, 0)), "Donnerstag, 5.11.2026, 19:30–21:00 Uhr");
  assert.equal(lib.formatMeetingWhen(start, null), "Donnerstag, 5.11.2026, 19:30 Uhr");
  assert.equal(lib.defaultMeetingTitle("MITGLIEDERVERSAMMLUNG", start), "Mitgliederversammlung 2026");
});

test("Markdown in Namen wird entschärft", () => {
  assert.equal(lib.escapeMd("A *B* [x](y)\nZ"), "A \\*B\\* \\[x\\](y) Z");
});

// ---- Protokoll-Entwurf --------------------------------------------------------------------------------------------------------

test("Protokoll-Entwurf aus Traktanden, Anwesenheit und Beschlüssen", () => {
  const md = lib.buildMinutesDraft({
    meeting: { kind: "MITGLIEDERVERSAMMLUNG", title: "Mitgliederversammlung 2026", startsAt: dates.zurichToDate(2026, 11, 5, 19, 30), endsAt: null, location: "Heiden", quorumMin: 3, leaderName: "A B", recorderName: "C D" },
    agenda: [
      { id: "t2", position: 2, title: "Jahresrechnung", description: "", motion: "Die Jahresrechnung sei zu genehmigen." },
      { id: "t1", position: 1, title: "Begrüssung", description: "Kurze Begrüssung.", motion: "" },
    ],
    resolutions: [
      { agendaItemId: "t2", number: 1, text: "Die Jahresrechnung wird genehmigt.", votesYes: 4, votesNo: 0, abstentions: 1, result: "ANGENOMMEN", recusal: "X Y (Kassier)" },
      { agendaItemId: null, number: 2, text: "Sonstiges", votesYes: null, votesNo: null, abstentions: null, result: "VERSCHOBEN", recusal: "" },
    ],
    attendance: [
      { name: "A B", status: "ANWESEND", canVote: true },
      { name: "C D", status: "ANWESEND", canVote: true },
      { name: "E F", status: "ENTSCHULDIGT", canVote: true },
    ],
  });
  assert.match(md, /^# Protokoll: Mitgliederversammlung 2026/);
  assert.match(md, /\*\*Anwesend \(2, davon stimmberechtigt 2\):\*\* A B, C D/);
  assert.match(md, /\*\*Entschuldigt \(1\):\*\* E F/);
  assert.match(md, /Nur 2 anwesende Stimmberechtigte, Mindestzahl gemäss Statuten: 3/);
  // Traktanden in der Reihenfolge ihrer Position, Beschluss beim passenden Traktandum
  assert.ok(md.indexOf("### 1. Begrüssung") < md.indexOf("### 2. Jahresrechnung"));
  assert.match(md, /\*\*Beschluss 1:\*\* Die Jahresrechnung wird genehmigt\. Ergebnis: Angenommen \(Ja 4, Nein 0, Enthaltungen 1\)\. Ausstand: X Y \(Kassier\)\./);
  assert.match(md, /### Weitere Beschlüsse/);
  assert.match(md, /Ergebnis: Verschoben\./);
  assert.doesNotMatch(md, /\n{3,}/);
});

test("Protokoll-Entwurf: leere Sitzung", () => {
  const md = lib.buildMinutesDraft({ meeting: { kind: "VORSTANDSSITZUNG", title: "Sitzung", startsAt: d(2026, 11, 5), endsAt: null, location: "", quorumMin: null, leaderName: null, recorderName: null }, agenda: [], resolutions: [], attendance: [] });
  assert.match(md, /Anwesenheit noch nicht erfasst/);
  assert.match(md, /Keine Traktanden erfasst/);
});

// ---- Sperre nach Genehmigung ---------------------------------------------------------------------------------------------------

test("Protokoll: Sperre und Änderungsvermerk", () => {
  assert.equal(lib.isMinutesLocked({ minutesApprovedAt: null }), false);
  assert.equal(lib.isMinutesLocked({ minutesApprovedAt: d(2026, 11, 20) }), true);
  const note = lib.amendmentNote("Genehmigt am 20.11.2026.", d(2026, 12, 1), "  Tippfehler   im Namen ");
  assert.equal(note, "Genehmigt am 20.11.2026.\nNachträglich geändert am 1.12.2026: Tippfehler im Namen");
  assert.equal(lib.amendmentNote("", d(2026, 12, 1), "Grund"), "Nachträglich geändert am 1.12.2026: Grund");
});

test("Sichtbarkeit: nur Versammlungen der Mitglieder sind im Portal, Vorstandssitzungen nie", () => {
  assert.equal(lib.isAssemblyKind("MITGLIEDERVERSAMMLUNG"), true);
  assert.equal(lib.isAssemblyKind("AUSSERORDENTLICH"), true);
  assert.equal(lib.isAssemblyKind("VORSTANDSSITZUNG"), false);
});

// ---- Antwort-Link --------------------------------------------------------------------------------------------------------------------

test("Antwort-Link: signiert, an Sitzung und Person gebunden, fälschungssicher", () => {
  const secret = "test-secret-test-secret-test-secret-12345";
  const t = token.signRsvpToken(secret, "clmeeting1", "clmember1");
  assert.deepEqual(token.verifyRsvpToken(secret, t), { meetingId: "clmeeting1", memberId: "clmember1" });
  assert.equal(token.verifyRsvpToken("anderes-geheimnis-anderes-geheimnis-123", t), null);
  // andere Person oder andere Sitzung einsetzen -> ungültig
  const [m, , sig] = t.split(".");
  assert.equal(token.verifyRsvpToken(secret, `${m}.clmember2.${sig}`), null);
  assert.equal(token.verifyRsvpToken(secret, `clmeeting2.clmember1.${sig}`), null);
  // Müll
  for (const bad of ["", "a.b", "a.b.c.d", `${m}.clmember1.`, "x".repeat(500), "../..", `${m}.clmember1.${sig}x`]) assert.equal(token.verifyRsvpToken(secret, bad), null);
  assert.throws(() => token.signRsvpToken(secret, "a.b", "c"));
  assert.match(t, /^[A-Za-z0-9_.-]+$/);
});

// ---- Eingaben ---------------------------------------------------------------------------------------------------------------------------

test("Eingabe Sitzung: Pflichtfelder, Zeitpunkt in Zürcher Zeit, Ende nach Beginn", () => {
  const ok = schemas.meetingCreateSchema.safeParse({ kind: "MITGLIEDERVERSAMMLUNG", title: "Mitgliederversammlung 2026", startsAt: "2026-11-05T19:30", endsAt: "2026-11-05T21:00", quorumMin: 3 });
  assert.equal(ok.success, true);
  if (ok.success) {
    assert.equal(dates.formatDateTimeCh(ok.data.startsAt), "5.11.2026, 19:30 Uhr");
    assert.equal(ok.data.quorumMin, 3);
    assert.equal(ok.data.leaderId, null);
  }
  const bad = schemas.meetingCreateSchema.safeParse({ kind: "MITGLIEDERVERSAMMLUNG", title: "Titel", startsAt: "2026-11-05T19:30", endsAt: "2026-11-05T18:00" });
  assert.equal(bad.success, false);
  assert.equal(schemas.meetingCreateSchema.safeParse({ kind: "FEST", title: "Titel", startsAt: "2026-11-05T19:30" }).success, false);
  assert.equal(schemas.meetingCreateSchema.safeParse({ kind: "VORSTANDSSITZUNG", title: "ab", startsAt: "2026-11-05T19:30" }).success, false);
  assert.equal(schemas.meetingCreateSchema.safeParse({ kind: "VORSTANDSSITZUNG", title: "Sitzung", startsAt: "2026-11-05T19:30", quorumMin: 0 }).success, false);
  const empty = schemas.meetingCreateSchema.safeParse({ kind: "VORSTANDSSITZUNG", title: "Sitzung", startsAt: "2026-11-05T19:30", quorumMin: "", endsAt: "" });
  assert.equal(empty.success && empty.data.quorumMin === null && empty.data.endsAt === null, true);
});

test("Eingabe Beschluss: Zahlen ab 0, leer = nicht gezählt, Ergebnis aus der Liste", () => {
  const ok = schemas.resolutionCreateSchema.safeParse({ text: "Der Antrag wird angenommen.", votesYes: 4, votesNo: "", abstentions: 0, result: "ANGENOMMEN" });
  assert.equal(ok.success, true);
  if (ok.success) {
    assert.equal(ok.data.votesYes, 4);
    assert.equal(ok.data.votesNo, null);
    assert.equal(ok.data.abstentions, 0);
    assert.equal(ok.data.majority, "EINFACH");
  }
  assert.equal(schemas.resolutionCreateSchema.safeParse({ text: "Antrag", votesYes: -1, result: "ANGENOMMEN" }).success, false);
  assert.equal(schemas.resolutionCreateSchema.safeParse({ text: "Antrag", votesYes: 1.5, result: "ANGENOMMEN" }).success, false);
  assert.equal(schemas.resolutionCreateSchema.safeParse({ text: "Antrag", result: "VIELLEICHT" }).success, false);
});

test("Eingabe Rückmeldung und Versand", () => {
  assert.equal(schemas.rsvpSchema.safeParse({ status: "ZUSAGE" }).success, true);
  assert.equal(schemas.rsvpSchema.safeParse({ status: "VIELLEICHT" }).success, false);
  assert.equal(schemas.invitationSendSchema.parse({ kind: "EINLADUNG" }).mode, "ALL");
  assert.equal(schemas.invitationSendSchema.safeParse({ kind: "ABSAGE" }).success, false);
  assert.equal(schemas.minutesUnapproveSchema.safeParse({ reason: "kurz" }).success, false);
});

// ---- Register-Export und Kalender --------------------------------------------------------------------------------------------------------

test("Register-Export: Formel-Schutz, Datum und Zahlen", () => {
  const rows = lib.registerCsvRows([
    { meetingStart: dates.zurichToDate(2026, 11, 5, 19, 30), meetingTitle: "=HYPERLINK(\"x\")", meetingKind: "MITGLIEDERVERSAMMLUNG", number: 1, agendaTitle: "", text: "+Beschluss", votesYes: 4, votesNo: null, abstentions: 0, majority: "EINFACH", result: "ANGENOMMEN", recusal: "@Name" },
  ]);
  const text = csv.toCsv(lib.RESOLUTION_CSV_HEADERS, rows);
  assert.match(text, /5\.11\.2026;"'=HYPERLINK/);
  assert.match(text, /;'\+Beschluss;4;;0;Einfaches Mehr;Angenommen;'@Name/);
});

test("Kalender: Sitzung als iCalendar", () => {
  const event = lib.meetingIcsEvent({
    id: "abc123",
    kind: "MITGLIEDERVERSAMMLUNG",
    title: "Mitgliederversammlung 2026",
    startsAt: dates.zurichToDate(2026, 11, 5, 19, 30),
    endsAt: dates.zurichToDate(2026, 11, 5, 21, 0),
    location: "Heiden",
    status: "EINGELADEN",
    updatedAt: new Date("2026-10-01T10:00:00Z"),
    agenda: [{ title: "Begrüssung" }, { title: "Jahresrechnung" }],
  });
  const out = ics.buildIcs([event], { now: new Date("2026-10-01T10:00:00Z") });
  assert.match(out, /BEGIN:VEVENT/);
  assert.match(out, /UID:versammlung-abc123@vylaris\.ch/);
  assert.match(out, /DTSTART:20261105T183000Z/);
  assert.match(out, /STATUS:CONFIRMED/);
  assert.match(out, /1\. Begrüssung/);
  const cancelled = ics.buildIcs([lib.meetingIcsEvent({ id: "x", kind: "VORSTANDSSITZUNG", title: "S", startsAt: d(2026, 1, 1), endsAt: null, location: "", status: "ABGESAGT", updatedAt: d(2026, 1, 1) })]);
  assert.match(cancelled, /STATUS:CANCELLED/);
});
