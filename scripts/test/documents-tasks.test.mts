// Tests für die Fachlogik der Module Dokumente und Aufgaben: Upload-Prüfung (Magic Bytes + Endung), Versionen, Sichtbarkeit,
// Dateinamen, Überfälligkeit, Spalten, Statuswechsel, Zuständige, Erinnerungs-Sperrfrist, Schemas.
// Aufruf:  npx tsx scripts/test/documents-tasks.test.mts
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { test } from "node:test";

const require = createRequire(import.meta.url);
const serverOnlyPath = require.resolve("server-only");
require.cache[serverOnlyPath] = { id: serverOnlyPath, filename: serverOnlyPath, loaded: true, exports: {}, children: [], paths: [] } as unknown as NodeJS.Module;

const dates = await import("../../src/lib/verein/dates.ts");
const docs = await import("../../src/lib/verein/documents-lib.ts");
const meta = await import("../../src/lib/verein/documents-meta.ts");
const docSchemas = await import("../../src/lib/verein/documents-schemas.ts");
const tasks = await import("../../src/lib/verein/tasks-lib.ts");
const taskSchemas = await import("../../src/lib/verein/tasks-schemas.ts");
const http = await import("../../src/app/api/_lib/http.ts");

// ---- Hilfen -------------------------------------------------------------------------------------------------------

const bytes = (...b: number[]) => new Uint8Array(b);
const concat = (head: Uint8Array, len = 64) => {
  const out = new Uint8Array(Math.max(len, head.length));
  out.set(head);
  return out;
};
const PDF = concat(new TextEncoder().encode("%PDF-1.7\n"));
const PNG = concat(bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a));
const JPEG = concat(bytes(0xff, 0xd8, 0xff, 0xe0));
const ZIP = concat(bytes(0x50, 0x4b, 0x03, 0x04));
const EXE = concat(bytes(0x4d, 0x5a, 0x90, 0x00)); // «MZ»: Windows-Programm
const file = (content: Uint8Array | string, name: string) => new File([content as BlobPart], name);

// ---- Upload: Magic Bytes und Endung -------------------------------------------------------------------------------------

test("Upload: erlaubte Typen werden am Inhalt erkannt, Name bleibt bereinigt", async () => {
  const pdf = await docs.checkDocumentUpload(file(PDF, "Statuten 2026.pdf"));
  assert.equal(pdf.ok, true);
  if (pdf.ok) {
    assert.equal(pdf.kind, "pdf");
    assert.equal(pdf.mimeType, "application/pdf");
    assert.match(pdf.sha256, /^[0-9a-f]{64}$/);
    assert.equal(pdf.fileName, "Statuten_2026.pdf");
  }
  const png = await docs.checkDocumentUpload(file(PNG, "logo.PNG"));
  assert.equal(png.ok && png.kind, "png");
  assert.equal(png.ok && png.fileName, "logo.png");
  const jpg = await docs.checkDocumentUpload(file(JPEG, "foto.jpg"));
  assert.equal(jpg.ok && jpg.kind, "jpeg");
  const jpeg = await docs.checkDocumentUpload(file(JPEG, "foto.jpeg"));
  assert.equal(jpeg.ok, true, "beide JPEG-Endungen sind erlaubt");
  const docx = await docs.checkDocumentUpload(file(ZIP, "Reglement.docx"));
  assert.equal(docx.ok && docx.kind, "docx");
  const txt = await docs.checkDocumentUpload(file("Notizen zur Sitzung\nZweite Zeile", "notizen.txt"));
  assert.equal(txt.ok && txt.kind, "txt");
});

test("Upload: Programme und Skripte werden abgelehnt, auch mit harmloser Endung", async () => {
  for (const name of ["programm.exe", "bericht.pdf", "bericht.docx", "bericht.txt"]) {
    const r = await docs.checkDocumentUpload(file(EXE, name));
    assert.equal(r.ok, false, `EXE-Inhalt als «${name}» muss scheitern`);
  }
  const html = await docs.checkDocumentUpload(file("<html><script>alert(1)</script></html>", "seite.html"));
  assert.equal(html.ok, false, "HTML ist kein erlaubter Typ");
  const asPdf = await docs.checkDocumentUpload(file("<html><script>alert(1)</script></html>", "seite.pdf"));
  assert.equal(asPdf.ok, false, "HTML mit PDF-Endung hat keinen PDF-Inhalt");
  const svg = await docs.checkDocumentUpload(file('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>', "bild.svg"));
  assert.equal(svg.ok, false, "SVG ist nicht erlaubt");
  const zipAsPdf = await docs.checkDocumentUpload(file(ZIP, "archiv.pdf"));
  assert.equal(zipAsPdf.ok, false, "ZIP ohne Office-Endung wird abgelehnt");
  const zip = await docs.checkDocumentUpload(file(ZIP, "archiv.zip"));
  assert.equal(zip.ok, false);
  const bin = await docs.checkDocumentUpload(file(bytes(0, 1, 2, 3, 4, 5, 6, 7), "daten.txt"));
  assert.equal(bin.ok, false, "Binärdaten sind kein Text");
});

test("Upload: Endung muss zum erkannten Inhalt passen", async () => {
  const pngAsPdf = await docs.checkDocumentUpload(file(PNG, "scan.pdf"));
  assert.equal(pngAsPdf.ok, false);
  if (!pngAsPdf.ok) assert.match(pngAsPdf.error, /Dateiendung/);
  const pdfAsJpg = await docs.checkDocumentUpload(file(PDF, "scan.jpg"));
  assert.equal(pdfAsJpg.ok, false);
  const doubled = await docs.checkDocumentUpload(file(PDF, "scan.pdf.exe"));
  assert.equal(doubled.ok, false, "die letzte Endung zählt");
  const noExt = await docs.checkDocumentUpload(file(PDF, "Statuten"));
  assert.equal(noExt.ok && noExt.fileName, "Statuten.pdf", "fehlende Endung wird passend ergänzt");
});

test("Upload: Pfade im Dateinamen werden entfernt", async () => {
  const r = await docs.checkDocumentUpload(file(PDF, "../../etc/passwd.pdf"));
  assert.equal(r.ok && r.fileName, "passwd.pdf");
  const win = await docs.checkDocumentUpload(file(PDF, "C:\\Users\\x\\Protokoll.pdf"));
  assert.equal(win.ok && win.fileName, "Protokoll.pdf");
});

test("Upload: leere und zu grosse Dateien werden abgelehnt", async () => {
  const empty = await docs.checkDocumentUpload(file(new Uint8Array(0), "leer.pdf"));
  assert.equal(empty.ok, false);
  if (!empty.ok) assert.match(empty.error, /leer/);
  const big = new Uint8Array(10 * 1024 * 1024 + 1);
  big.set(PDF);
  const tooBig = await docs.checkDocumentUpload(file(big, "gross.pdf"));
  assert.equal(tooBig.ok, false);
  if (!tooBig.ok) assert.match(tooBig.error, /zu gross/);
  const limit = new Uint8Array(10 * 1024 * 1024);
  limit.set(PDF);
  const atLimit = await docs.checkDocumentUpload(file(limit, "genau.pdf"));
  assert.equal(atLimit.ok, true, "genau 10 MB sind erlaubt");
  assert.equal(meta.UPLOAD_LIMIT_BYTES, 10 * 1024 * 1024);
});

test("Dateiendungen: Zuordnung und Abgleich", () => {
  assert.equal(docs.extensionOf("a.b.PDF"), "pdf");
  assert.equal(docs.extensionOf("ohne"), "");
  assert.equal(docs.extensionOf(".versteckt"), "");
  assert.equal(docs.extensionOf("ende."), "");
  assert.deepEqual(docs.reconcileFileName("x.jpg", "jpeg"), { ok: true, fileName: "x.jpg" });
  assert.deepEqual(docs.reconcileFileName("x", "docx"), { ok: true, fileName: "x.docx" });
  assert.equal(docs.reconcileFileName("x.pdf", "docx").ok, false);
});

// ---- Versionslogik ---------------------------------------------------------------------------------------------------

test("Versionen: nächste Nummer, nie wiederverwenden", () => {
  assert.equal(docs.nextVersionNumber([]), 1);
  assert.equal(docs.nextVersionNumber([{ version: 1 }]), 2);
  assert.equal(docs.nextVersionNumber([{ version: 1 }, { version: 2 }, { version: 3 }], 3), 4);
  assert.equal(docs.nextVersionNumber([{ version: 1 }, { version: 4 }], 2), 5, "höchste vorhandene Nummer zählt");
  assert.equal(docs.nextVersionNumber([{ version: 1 }], 7), 8, "auch die gespeicherte aktuelle Nummer zählt");
});

test("Versionen: identischer Inhalt legt keine neue Version an", () => {
  const sha = "ab".repeat(32);
  assert.equal(docs.isSameContent(sha, sha), true);
  assert.equal(docs.isSameContent(sha.toUpperCase(), sha), true);
  assert.equal(docs.isSameContent(sha, "cd".repeat(32)), false);
  assert.equal(docs.isSameContent(sha, null), false);
  assert.equal(docs.isSameContent(sha, ""), false);
});

test("Versionen: aktuelle Fassung nach Entfernen und Versionsparameter", () => {
  const v = [{ version: 1 }, { version: 2 }, { version: 3 }];
  assert.equal(docs.currentVersionAfterRemoval(v, 3), 2);
  assert.equal(docs.currentVersionAfterRemoval(v, 1), 3);
  assert.equal(docs.currentVersionAfterRemoval([{ version: 1 }], 1), null);
  assert.equal(docs.isCurrentVersion(3, 3), true);
  assert.equal(docs.isCurrentVersion(2, 3), false);
  assert.equal(docs.parseVersionParam("2"), 2);
  assert.equal(docs.parseVersionParam(" 12 "), 12);
  for (const bad of [null, undefined, "", "0", "-1", "1.5", "abc", "1e3", "9999999"]) assert.equal(docs.parseVersionParam(bad), null, `«${String(bad)}» ist keine Version`);
});

// ---- Sichtbarkeit -------------------------------------------------------------------------------------------------

test("Sichtbarkeit: Besucher, Mitglieder und Verwaltung", () => {
  assert.equal(docs.canView("PUBLIC", "OEFFENTLICH"), true);
  assert.equal(docs.canView("PUBLIC", "MITGLIEDER"), false);
  assert.equal(docs.canView("PUBLIC", "VORSTAND"), false);
  assert.equal(docs.canView("MEMBER", "OEFFENTLICH"), true);
  assert.equal(docs.canView("MEMBER", "MITGLIEDER"), true);
  assert.equal(docs.canView("MEMBER", "VORSTAND"), false);
  assert.equal(docs.canView("BOARD", "VORSTAND"), true);
  assert.equal(docs.canView("BOARD", "MITGLIEDER"), true);
  assert.equal(docs.canView("PUBLIC", "IRGENDWAS"), false, "unbekannte Werte sind nie sichtbar");
  assert.equal(docs.canView("BOARD", "IRGENDWAS"), false);
});

test("Sichtbarkeit: archivierte Dokumente sieht nur die Verwaltung", () => {
  const archived = new Date();
  assert.equal(docs.canView("PUBLIC", "OEFFENTLICH", archived), false);
  assert.equal(docs.canView("MEMBER", "MITGLIEDER", archived), false);
  assert.equal(docs.canView("BOARD", "MITGLIEDER", archived), true);
  assert.deepEqual([...docs.visibilitiesFor("PUBLIC")], ["OEFFENTLICH"]);
  assert.deepEqual([...docs.visibilitiesFor("MEMBER")], ["OEFFENTLICH", "MITGLIEDER"]);
  assert.deepEqual([...docs.visibilitiesFor("BOARD")], ["OEFFENTLICH", "MITGLIEDER", "VORSTAND"]);
});

test("Statuten: nur öffentlich, Kategorie Statuten, nicht archiviert", () => {
  assert.equal(docs.isPublicStatute({ category: "STATUTEN", visibility: "OEFFENTLICH", archivedAt: null }), true);
  assert.equal(docs.isPublicStatute({ category: "STATUTEN", visibility: "MITGLIEDER", archivedAt: null }), false);
  assert.equal(docs.isPublicStatute({ category: "REGLEMENT", visibility: "OEFFENTLICH", archivedAt: null }), false);
  assert.equal(docs.isPublicStatute({ category: "STATUTEN", visibility: "OEFFENTLICH", archivedAt: new Date() }), false);
});

// ---- Anzeige --------------------------------------------------------------------------------------------------------

test("Dateigrösse und Download-Name", () => {
  assert.equal(meta.formatFileSize(0), "0 B");
  assert.equal(meta.formatFileSize(850), "850 B");
  assert.equal(meta.formatFileSize(12_700), "12.4 KB");
  assert.equal(meta.formatFileSize(1_572_864), "1.5 MB");
  assert.equal(meta.formatFileSize(-1), "");
  assert.equal(docs.downloadFileName("Statuten 2026", 3, "x.pdf", true), "Statuten_2026.pdf");
  assert.equal(docs.downloadFileName("Statuten 2026", 2, "x.pdf", false), "Statuten_2026-v2.pdf");
  assert.equal(docs.downloadFileName("Protokoll «Gründung»/../x", 1, "p.docx", true).includes("/"), false);
  assert.equal(docs.downloadFileName("Über uns", 1, "a.pdf", true), "Ueber_uns.pdf");
  assert.equal(docs.downloadFileName("", 1, "a.pdf", true), "dokument.pdf");
});

test("Dokumentfilter: unbekannte Werte werden ignoriert", () => {
  const get = (m: Record<string, string>) => (k: string) => m[k] ?? "";
  assert.deepEqual(docs.parseDocumentFilters(get({ q: "  Statuten ", category: "STATUTEN", visibility: "OEFFENTLICH", archived: "1" })), { q: "Statuten", category: "STATUTEN", visibility: "OEFFENTLICH", archived: true });
  assert.deepEqual(docs.parseDocumentFilters(get({ category: "X", visibility: "Y", archived: "ja" })), { q: "", category: "", visibility: "", archived: false });
});

// ---- Dokument-Schemas -------------------------------------------------------------------------------------------------

test("Schema Dokument: Pflichtfelder, Vorgaben, Sichtbarkeit nur aus der Liste", () => {
  const ok = docSchemas.documentCreateSchema.safeParse({ title: " Statuten 2026 ", category: "STATUTEN" });
  assert.equal(ok.success, true);
  if (ok.success) {
    assert.equal(ok.data.title, "Statuten 2026");
    assert.equal(ok.data.visibility, "VORSTAND", "ohne Angabe nur für den Vorstand");
    assert.equal(ok.data.meetingId, null);
    assert.equal(ok.data.description, "");
  }
  assert.equal(docSchemas.documentCreateSchema.safeParse({ title: "ab", category: "STATUTEN" }).success, false);
  assert.equal(docSchemas.documentCreateSchema.safeParse({ title: "Titel", category: "GEHEIM" }).success, false);
  assert.equal(docSchemas.documentCreateSchema.safeParse({ title: "Titel", category: "SONSTIGES", visibility: "ALLE" }).success, false);
  assert.equal(docSchemas.documentCreateSchema.safeParse({ title: "Titel", category: "SONSTIGES", meetingId: "abc 123" }).success, false);
  const m = docSchemas.documentCreateSchema.safeParse({ title: "Titel", category: "PROTOKOLL", meetingId: "clx123abc" });
  assert.equal(m.success && m.data.meetingId, "clx123abc");
});

test("Schema Dokument: Änderung liest nur gesendete Felder", async () => {
  const req = new Request("http://x", { method: "PATCH", body: JSON.stringify({ visibility: "MITGLIEDER", archived: true }) });
  const patch = await http.parsePatch(req, docSchemas.documentPatchSchema);
  assert.deepEqual(patch, { visibility: "MITGLIEDER", archived: true });
  const form = new FormData();
  form.set("title", "X Titel");
  form.set("file", new File(["a"], "a.txt"));
  assert.deepEqual(docSchemas.formFields(form), { title: "X Titel" }, "Dateien gehören nicht in die Textfelder");
});

// ---- Aufgaben: Überfälligkeit und Reihenfolge ---------------------------------------------------------------------------

const now = dates.zurichToDate(2026, 11, 5, 10, 0);
const day = (y: number, m: number, d: number) => dates.dateOnly(y, m, d);
const task = (over: Partial<{ status: string; priority: string; dueDate: Date | null; title: string; doneAt: Date | null }> = {}) => ({
  status: "OFFEN",
  priority: "NORMAL",
  dueDate: null as Date | null,
  title: "Aufgabe",
  doneAt: null as Date | null,
  ...over,
});

test("Überfällig: erst ab dem Tag nach der Frist, erledigte nie", () => {
  assert.equal(tasks.isTaskOverdue(task({ dueDate: day(2026, 11, 4) }), now), true);
  assert.equal(tasks.isTaskOverdue(task({ dueDate: day(2026, 11, 5) }), now), false, "am Fälligkeitstag noch nicht");
  assert.equal(tasks.isTaskOverdue(task({ dueDate: day(2026, 11, 6) }), now), false);
  assert.equal(tasks.isTaskOverdue(task({ dueDate: null }), now), false);
  assert.equal(tasks.isTaskOverdue(task({ dueDate: day(2026, 1, 1), status: "ERLEDIGT" }), now), false);
  assert.equal(tasks.isTaskOverdue(task({ dueDate: day(2026, 1, 1), status: "IN_ARBEIT" }), now), true);
});

test("Frist als Text", () => {
  assert.equal(tasks.dueLabel(task({ dueDate: null }), now), "");
  assert.equal(tasks.dueLabel(task({ dueDate: day(2026, 11, 5) }), now), "heute fällig");
  assert.equal(tasks.dueLabel(task({ dueDate: day(2026, 11, 6) }), now), "morgen fällig");
  assert.equal(tasks.dueLabel(task({ dueDate: day(2026, 11, 10) }), now), "in 5 Tagen (10.11.2026)");
  assert.equal(tasks.dueLabel(task({ dueDate: day(2026, 11, 4) }), now), "1 Tag überfällig (4.11.2026)");
  assert.equal(tasks.dueLabel(task({ dueDate: day(2026, 11, 1) }), now), "4 Tage überfällig (1.11.2026)");
  assert.equal(tasks.dueLabel(task({ dueDate: day(2026, 11, 1), status: "ERLEDIGT" }), now), "1.11.2026");
});

test("Reihenfolge: überfällige zuerst, dann Frist, dann Priorität", () => {
  const list = [
    task({ title: "ohne Frist", dueDate: null }),
    task({ title: "später", dueDate: day(2026, 12, 1) }),
    task({ title: "überfällig", dueDate: day(2026, 10, 1) }),
    task({ title: "bald hoch", dueDate: day(2026, 11, 20), priority: "HOCH" }),
    task({ title: "bald niedrig", dueDate: day(2026, 11, 20), priority: "NIEDRIG" }),
  ];
  const sorted = [...list].sort((a, b) => tasks.compareTasks(a, b, now)).map((t) => t.title);
  assert.deepEqual(sorted, ["überfällig", "bald hoch", "bald niedrig", "später", "ohne Frist"]);
});

test("Spalten: Aufgaben nach Status, unbekannter Status gilt als offen", () => {
  const cols = tasks.groupByStatus(
    [
      task({ title: "a", status: "OFFEN" }),
      task({ title: "b", status: "IN_ARBEIT" }),
      task({ title: "c", status: "ERLEDIGT", doneAt: new Date("2026-10-01T10:00:00Z") }),
      task({ title: "d", status: "ERLEDIGT", doneAt: new Date("2026-10-05T10:00:00Z") }),
      task({ title: "e", status: "KAPUTT" }),
    ],
    now,
  );
  assert.deepEqual(cols.OFFEN.map((t) => t.title).sort(), ["a", "e"]);
  assert.deepEqual(cols.IN_ARBEIT.map((t) => t.title), ["b"]);
  assert.deepEqual(cols.ERLEDIGT.map((t) => t.title), ["d", "c"], "zuletzt erledigte zuerst");
});

test("Statuswechsel: Nachbarn und Erledigt-Zeitpunkt", () => {
  assert.equal(tasks.neighbourStatus("OFFEN", "prev"), null);
  assert.equal(tasks.neighbourStatus("OFFEN", "next"), "IN_ARBEIT");
  assert.equal(tasks.neighbourStatus("IN_ARBEIT", "prev"), "OFFEN");
  assert.equal(tasks.neighbourStatus("IN_ARBEIT", "next"), "ERLEDIGT");
  assert.equal(tasks.neighbourStatus("ERLEDIGT", "next"), null);
  assert.equal(tasks.neighbourStatus("ERLEDIGT", "prev"), "IN_ARBEIT");
  assert.deepEqual(tasks.doneAtFor("ERLEDIGT", "IN_ARBEIT", null, now), now);
  const earlier = new Date("2026-10-01T10:00:00Z");
  assert.deepEqual(tasks.doneAtFor("ERLEDIGT", "ERLEDIGT", earlier, now), earlier, "bleibt erledigt: Zeitpunkt unverändert");
  assert.equal(tasks.doneAtFor("OFFEN", "ERLEDIGT", earlier, now), null, "Wiedereröffnen löscht den Zeitpunkt");
  assert.equal(tasks.doneAtFor("IN_ARBEIT", "OFFEN", null, now), null);
});

// ---- Aufgaben: Zuständige, Erinnerung ------------------------------------------------------------------------------------

test("Zuständige: Auswahlwert hin und zurück", () => {
  assert.equal(tasks.encodeAssignee("a1", null), "admin:a1");
  assert.equal(tasks.encodeAssignee(null, "m1"), "member:m1");
  assert.equal(tasks.encodeAssignee("a1", "m1"), "admin:a1", "Admin-Konto hat Vorrang");
  assert.equal(tasks.encodeAssignee(null, null), "");
  assert.deepEqual(tasks.decodeAssignee("admin:abc_1-2"), { kind: "admin", id: "abc_1-2" });
  assert.deepEqual(tasks.decodeAssignee("member:xyz"), { kind: "member", id: "xyz" });
  for (const bad of ["", "user:abc", "admin:", "admin:a b", "admin:a;drop", null, undefined]) assert.equal(tasks.decodeAssignee(bad), null);
});

test("«Meine Aufgaben»: Admin-Konto oder verknüpftes Mitglied", () => {
  const me = { adminId: "a1", memberId: "m1" };
  assert.equal(tasks.isMine({ assigneeAdminId: "a1", assigneeMemberId: null }, me), true);
  assert.equal(tasks.isMine({ assigneeAdminId: null, assigneeMemberId: "m1" }, me), true);
  assert.equal(tasks.isMine({ assigneeAdminId: "a2", assigneeMemberId: null }, me), false);
  assert.equal(tasks.isMine({ assigneeAdminId: null, assigneeMemberId: null }, me), false);
  assert.equal(tasks.isMine({ assigneeAdminId: null, assigneeMemberId: "m1" }, { adminId: "a1", memberId: null }), false, "ohne verknüpftes Mitglied zählt nur das Konto");
});

test("Erinnerung: nicht für Erledigtes, Sperrfrist gegen Mehrfachversand", () => {
  assert.deepEqual(tasks.canRemind({ status: "OFFEN", lastReminderAt: null }, now), { ok: true });
  assert.equal(tasks.canRemind({ status: "ERLEDIGT", lastReminderAt: null }, now).ok, false);
  const recent = new Date(now.getTime() - 3 * 3_600_000);
  assert.equal(tasks.canRemind({ status: "OFFEN", lastReminderAt: recent }, now).ok, false);
  const old = new Date(now.getTime() - (tasks.REMINDER_COOLDOWN_HOURS + 1) * 3_600_000);
  assert.deepEqual(tasks.canRemind({ status: "IN_ARBEIT", lastReminderAt: old }, now), { ok: true });
});

test("Vorschautext: eine Zeile, gekürzt", () => {
  assert.equal(tasks.previewText("  a\n\n b   c "), "a b c");
  assert.equal(tasks.previewText("x".repeat(200), 10), `${"x".repeat(9)}…`);
});

// ---- Aufgaben-Schemas -------------------------------------------------------------------------------------------------------

test("Schema Aufgabe: Vorgaben, Frist, Zuständige", () => {
  const ok = taskSchemas.taskCreateSchema.safeParse({ title: " Jahresbericht ", dueDate: "2026-12-15", assignee: "admin:abc" });
  assert.equal(ok.success, true);
  if (ok.success) {
    assert.equal(ok.data.title, "Jahresbericht");
    assert.equal(ok.data.status, "OFFEN");
    assert.equal(ok.data.priority, "NORMAL");
    assert.deepEqual(ok.data.assignee, { assigneeAdminId: "abc", assigneeMemberId: null });
    assert.equal(ok.data.dueDate && dates.formatDateCh(ok.data.dueDate), "15.12.2026");
    assert.equal(ok.data.meetingId, null);
  }
  const member = taskSchemas.taskCreateSchema.parse({ title: "Aufgabe 2", assignee: "member:m9" });
  assert.deepEqual(member.assignee, { assigneeAdminId: null, assigneeMemberId: "m9" });
  const none = taskSchemas.taskCreateSchema.parse({ title: "Aufgabe 3", assignee: "", dueDate: "" });
  assert.deepEqual(none.assignee, { assigneeAdminId: null, assigneeMemberId: null });
  assert.equal(none.dueDate, null);
  assert.equal(taskSchemas.taskCreateSchema.safeParse({ title: "ab" }).success, false);
  assert.equal(taskSchemas.taskCreateSchema.safeParse({ title: "Aufgabe", priority: "DRINGEND" }).success, false);
  assert.equal(taskSchemas.taskCreateSchema.safeParse({ title: "Aufgabe", status: "FERTIG" }).success, false);
  assert.equal(taskSchemas.taskCreateSchema.safeParse({ title: "Aufgabe", assignee: "root:1" }).success, false);
  assert.equal(taskSchemas.taskCreateSchema.safeParse({ title: "Aufgabe", dueDate: "31.02.2026" }).success, false);
});

test("Schema Aufgabe: Änderung liest nur gesendete Felder, Kommentar braucht Text", async () => {
  const req = new Request("http://x", { method: "PATCH", body: JSON.stringify({ status: "ERLEDIGT" }) });
  assert.deepEqual(await http.parsePatch(req, taskSchemas.taskPatchSchema), { status: "ERLEDIGT" });
  const clear = new Request("http://x", { method: "PATCH", body: JSON.stringify({ assignee: "", dueDate: "" }) });
  const patch = await http.parsePatch(clear, taskSchemas.taskPatchSchema);
  assert.deepEqual(patch.assignee, { assigneeAdminId: null, assigneeMemberId: null }, "leere Auswahl entfernt die Zuteilung");
  assert.equal(patch.dueDate, null, "leere Frist entfernt die Frist");
  assert.equal(taskSchemas.taskCommentSchema.safeParse({ body: "   " }).success, false);
  assert.equal(taskSchemas.taskCommentSchema.safeParse({ body: "x".repeat(2001) }).success, false);
  assert.equal(taskSchemas.taskCommentSchema.parse({ body: " ok " }).body, "ok");
});
