// Tests der einstellbaren Rollenrechte gegen eine eigene, leere SQLite-Datenbank (Datei im Temp-Ordner): Speichern nur mit
// System-Schreibrecht, Zwischenspeicher, kaputte Daten, Änderungsprotokoll und Sichtbarkeit der Dokumente «Nur Vorstand».
// Die Entwicklungsdatenbank bleibt unberührt.
// Aufruf:  npx tsx scripts/test/permissions-db.test.mts
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, test } from "node:test";

const dir = mkdtempSync(join(tmpdir(), "vgs-perms-db-"));
process.env.DATABASE_URL = `file:${join(dir, "test.db")}`;
process.env.AUTH_SECRET = "ein-geheimnis-fuer-den-test-mindestens-32-zeichen";

// "server-only" wirft ausserhalb von Next.js; für den Test durch ein leeres Modul ersetzen.
const require = createRequire(import.meta.url);
const serverOnlyPath = require.resolve("server-only");
require.cache[serverOnlyPath] = { id: serverOnlyPath, filename: serverOnlyPath, loaded: true, exports: {}, children: [], paths: [] } as unknown as NodeJS.Module;

execFileSync("npx", ["prisma", "db", "push", "--skip-generate", "--accept-data-loss"], { env: process.env, stdio: "pipe" });

const { db } = await import("../../src/lib/db.ts");
const perms = await import("../../src/lib/verein/permissions.ts");
const cfg = await import("../../src/lib/verein/permissions-config.ts");
const data = await import("../../src/lib/verein/permissions-data.ts");
const save = await import("../../src/lib/verein/permissions-save.ts");
const docsData = await import("../../src/lib/verein/documents-data.ts");
const docsLib = await import("../../src/lib/verein/documents-lib.ts");
const ledgerData = await import("../../src/lib/verein/ledger-data.ts");
const ledgerLib = await import("../../src/lib/verein/ledger-lib.ts");

after(async () => {
  await db.$disconnect();
  rmSync(dir, { recursive: true, force: true });
});

const KEY = cfg.PERMISSIONS_SETTING_KEY;
const emptyFilters = { q: "", category: "" as const, visibility: "" as const, archived: false };

/** Angemeldete Person mit den wirksamen Rechten, wie getCurrentAdmin sie liefert. */
async function actor(roles: string[]) {
  const matrix = await data.getEffectiveMatrix({ fresh: true });
  return { id: `adm-${roles.join("-")}`, name: `Test ${roles.join("+")}`, email: "a@example.test", role: roles[0], roles: perms.withMatrix(roles as never, matrix), memberId: null, mustChangePassword: false };
}
const input = (o: unknown) => cfg.rolePermissionsInputSchema.parse(o);
const rejects403 = (p: Promise<unknown>) => assert.rejects(p, (e: { status?: number }) => e.status === 403);
const stored = async () => (await db.siteSetting.findUnique({ where: { key: KEY } }))?.value ?? null;

test("Ohne gespeicherte Einstellung gilt die Voreinstellung", async () => {
  data.invalidatePermissionsCache();
  const m = await data.getEffectiveMatrix();
  assert.deepEqual(JSON.parse(JSON.stringify(m)), JSON.parse(JSON.stringify(perms.DEFAULT_MATRIX)));
});

test("Speichern: nur Inhaber und Administration; andere Rollen bekommen 403 und nichts ändert sich", async () => {
  const body = input({ levels: { REVISOR: { members: "read" } } });
  for (const roles of [["PRAESIDENT"], ["KASSIER"], ["REVISOR"], ["EDITOR"], ["PRAESIDENT", "KASSIER", "AKTUAR"]]) {
    await rejects403(save.saveRolePermissions(await actor(roles), body));
  }
  assert.equal(await stored(), null);
  assert.equal(await db.auditLog.count({ where: { action: "permissions.update" } }), 0);
  // Auch mit gelesenem System (in der Matrix auf «Lesen» gestellt) bleibt Ändern verwehrt
  await save.saveRolePermissions(await actor(["ADMIN"]), input({ levels: { PRAESIDENT: { system: "read" } } }));
  await rejects403(save.saveRolePermissions(await actor(["PRAESIDENT"]), body));
  await save.saveRolePermissions(await actor(["OWNER"]), input({}));
  assert.equal(await stored(), null, "zurückgesetzt");
});

test("Speichern durch Administration: wirkt sofort (Zwischenspeicher wird ungültig), Änderungsprotokoll ohne Personendaten", async () => {
  const admin = await actor(["ADMIN"]);
  assert.equal(perms.canAccess((await actor(["REVISOR"])).roles, "members"), false);
  const warm = await data.getEffectiveMatrix(); // füllt den Zwischenspeicher
  assert.equal(perms.levelFor(["REVISOR"], "members", warm), null);

  const res = await save.saveRolePermissions(admin, input({ levels: { REVISOR: { members: "read" }, PRAESIDENT: { ledger: "read" } }, flags: { REVISOR: { boardDocuments: true } } }));
  assert.equal(res.changed, true);
  const now = await data.getEffectiveMatrix(); // ohne fresh: darf nicht den alten Stand liefern
  assert.equal(perms.levelFor(["REVISOR"], "members", now), "read");
  assert.equal(perms.levelFor(["PRAESIDENT"], "ledger", now), "read");
  assert.equal(perms.canSeeBoardDocuments(["REVISOR"], now), true);

  const text = await stored();
  assert.ok(text);
  assert.deepEqual(JSON.parse(text), { levels: { REVISOR: { members: "read" }, PRAESIDENT: { ledger: "read" } }, flags: { REVISOR: { boardDocuments: true } } });

  const logs = await db.auditLog.findMany({ where: { action: "permissions.update" } });
  assert.equal(logs.length, 1);
  assert.equal(logs[0].objectType, "RolePermissions");
  assert.deepEqual(JSON.parse(logs[0].before ?? "{}"), { "REVISOR.members": "none", "PRAESIDENT.ledger": "write", "REVISOR.boardDocuments": false });
  assert.deepEqual(JSON.parse(logs[0].after ?? "{}"), { "REVISOR.members": "read", "PRAESIDENT.ledger": "read", "REVISOR.boardDocuments": true });
  assert.ok(!/@|example\.test/.test(`${logs[0].before}${logs[0].after}${logs[0].summary}`), "keine Personendaten");

  // Dieselbe Einstellung nochmals: keine Änderung, kein weiterer Eintrag
  const again = await save.saveRolePermissions(admin, input({ levels: { REVISOR: { members: "read" }, PRAESIDENT: { ledger: "read" } }, flags: { REVISOR: { boardDocuments: true } } }));
  assert.equal(again.changed, false);
  assert.equal(await db.auditLog.count({ where: { action: "permissions.update" } }), 1);
});

test("Zurücksetzen: je Rolle (durch Weglassen) und gesamt (leere Eingabe)", async () => {
  const admin = await actor(["ADMIN"]);
  await save.saveRolePermissions(admin, input({ levels: { REVISOR: { members: "read" }, KASSIER: { members: "write" } } }));
  // Nur REVISOR zurücksetzen: KASSIER bleibt angepasst
  await save.saveRolePermissions(admin, input({ levels: { KASSIER: { members: "write" } } }));
  const m = await data.getEffectiveMatrix();
  assert.equal(perms.levelFor(["REVISOR"], "members", m), null);
  assert.equal(perms.levelFor(["KASSIER"], "members", m), "write");
  // Alles zurücksetzen löscht den Eintrag
  await save.saveRolePermissions(admin, input({}));
  assert.equal(await stored(), null);
  assert.equal(perms.levelFor(["KASSIER"], "members", await data.getEffectiveMatrix()), "read");
  const last = (await db.auditLog.findMany({ where: { action: "permissions.update" }, orderBy: { createdAt: "desc" }, take: 1 }))[0];
  assert.deepEqual(JSON.parse(last.after ?? "{}"), { "KASSIER.members": "read" });
});

test("Ungültige Eingabe wird nicht gespeichert (Schranken gelten schon vor dem Speichern)", async () => {
  assert.throws(() => input({ levels: { PRAESIDENT: { system: "write" } } }));
  assert.throws(() => input({ levels: { OWNER: { ledger: "none" } } }));
  assert.throws(() => input({ levels: { KASSIER: { self: "none" } } }));
  assert.equal(await stored(), null);
});

test("Beschädigte oder manipulierte Daten in der Datenbank: Voreinstellung, nie mehr Rechte", async () => {
  const cases: Array<[string, string]> = [
    ["kaputtes JSON", "{nicht json"],
    ["falsche Form", "[1,2,3]"],
    ["Rechteausweitung", JSON.stringify({ levels: { KASSIER: { system: "write" }, HACKER: { system: "write" }, OWNER: { ledger: "none" } } })],
  ];
  for (const [label, value] of cases) {
    await db.siteSetting.upsert({ where: { key: KEY }, create: { key: KEY, value }, update: { value } });
    data.invalidatePermissionsCache();
    const m = await data.getEffectiveMatrix();
    assert.equal(perms.canAccess(["KASSIER"], "system", "write", m), false, label);
    assert.equal(perms.canAccess(["OWNER"], "ledger", "write", m), true, label);
    assert.deepEqual(JSON.parse(JSON.stringify(m)), JSON.parse(JSON.stringify(perms.DEFAULT_MATRIX)), label);
  }
  // Gemischt: Gültiges gilt, Unzulässiges nicht
  const mixed = JSON.stringify({ levels: { KASSIER: { system: "write", ledger: "read" } } });
  await db.siteSetting.update({ where: { key: KEY }, data: { value: mixed } });
  data.invalidatePermissionsCache();
  const m = await data.getEffectiveMatrix();
  assert.equal(perms.canAccess(["KASSIER"], "system", "write", m), false);
  assert.equal(perms.levelFor(["KASSIER"], "ledger", m), "read");
  await db.siteSetting.delete({ where: { key: KEY } });
  data.invalidatePermissionsCache();
});

test("Dokumente «Nur Vorstand»: Revisor sieht sie nur mit dem Einzelrecht (Liste, Suche, Zähler, Einzelansicht, Download-Publikum)", async () => {
  const mk = (title: string, visibility: string) =>
    db.document.create({ data: { title, category: "SONSTIGES", visibility, currentVersion: 1, versions: { create: { version: 1, fileName: "a.pdf", mimeType: "application/pdf", sizeBytes: 3, sha256: "x".repeat(8), data: new Uint8Array([1, 2, 3]), uploadedByName: "T" } } } });
  const open = await mk("Jahresbericht offen", "OEFFENTLICH");
  const members = await mk("Rundschreiben Mitglieder", "MITGLIEDER");
  const board = await mk("Vorstandsprotokoll GEHEIM", "VORSTAND");
  const archivedBoard = await db.document.create({ data: { title: "Altes Vorstandsdokument GEHEIM", category: "SONSTIGES", visibility: "VORSTAND", currentVersion: 1, archivedAt: new Date() } });

  data.invalidatePermissionsCache();
  const revisor = await actor(["REVISOR"]);
  const sees = docsData.adminSeesBoardDocuments(revisor);
  assert.equal(sees, false, "Voreinstellung: Revisor sieht «Nur Vorstand» nicht");
  const titles = async (admin: { roles: readonly string[] }, filters = emptyFilters) => (await docsData.listDocuments(filters, 0, 50, docsData.adminSeesBoardDocuments(admin))).rows.map((r) => r.title).sort();
  assert.deepEqual(await titles(revisor), ["Jahresbericht offen", "Rundschreiben Mitglieder"]);
  assert.deepEqual(await titles(revisor, { ...emptyFilters, q: "GEHEIM" }), [], "Suche findet «Nur Vorstand» nicht");
  assert.deepEqual(await titles(revisor, { ...emptyFilters, visibility: "VORSTAND" }), [], "Filter auf «Nur Vorstand» bleibt leer");
  assert.deepEqual(await titles(revisor, { ...emptyFilters, archived: true }), [], "auch im Archiv");
  assert.deepEqual(await docsData.documentCounts(false), { active: 2, archived: 0 });
  assert.equal(await docsData.getDocumentDetail(board.id, false), null);
  assert.ok(await docsData.getDocumentDetail(members.id, false));
  assert.ok(await docsData.getDocumentDetail(open.id, false));
  assert.equal(docsLib.canView(docsLib.adminAudience(perms.canSeeBoardDocuments(revisor.roles)), "VORSTAND"), false);
  // Ändern, neue Version, Löschen und Anlegen «Nur Vorstand» sind ebenfalls verwehrt
  const writer = await actor(["REVISOR"]);
  await assert.rejects(docsData.updateDocument(writer as never, board.id, { title: "Neu" }), (e: { status?: number }) => e.status === 404);
  await assert.rejects(docsData.deleteDocument(writer as never, board.id), (e: { status?: number }) => e.status === 404);
  await assert.rejects(docsData.updateDocument(writer as never, members.id, { visibility: "VORSTAND" }), (e: { status?: number }) => e.status === 403);
  assert.ok(await db.document.findUnique({ where: { id: board.id } }), "Dokument ist unverändert vorhanden");
  assert.equal((await db.document.findUniqueOrThrow({ where: { id: board.id } })).title, "Vorstandsprotokoll GEHEIM");

  // Vorstandsrollen sehen alles
  const kassier = await actor(["KASSIER"]);
  assert.deepEqual(await titles(kassier), ["Jahresbericht offen", "Rundschreiben Mitglieder", "Vorstandsprotokoll GEHEIM"]);
  assert.deepEqual(await titles(kassier, { ...emptyFilters, archived: true }), ["Altes Vorstandsdokument GEHEIM"]);
  assert.ok(await docsData.getDocumentDetail(board.id, true));

  // Einzelrecht für den Revisor einschalten (durch die Administration): wirkt sofort
  await save.saveRolePermissions(await actor(["ADMIN"]), input({ flags: { REVISOR: { boardDocuments: true } } }));
  const revisor2 = await actor(["REVISOR"]);
  assert.equal(docsData.adminSeesBoardDocuments(revisor2), true);
  assert.deepEqual(await titles(revisor2), ["Jahresbericht offen", "Rundschreiben Mitglieder", "Vorstandsprotokoll GEHEIM"]);
  assert.deepEqual(await titles(revisor2, { ...emptyFilters, q: "GEHEIM" }), ["Vorstandsprotokoll GEHEIM"]);
  assert.ok(await docsData.getDocumentDetail(board.id, docsData.adminSeesBoardDocuments(revisor2)));
  assert.equal(docsLib.canView(docsLib.adminAudience(perms.canSeeBoardDocuments(revisor2.roles)), "VORSTAND"), true);

  // …und wieder ausschalten (Zurücksetzen auf die Voreinstellung)
  await save.saveRolePermissions(await actor(["OWNER"]), input({}));
  assert.equal(docsData.adminSeesBoardDocuments(await actor(["REVISOR"])), false);
  assert.equal(await docsData.getDocumentDetail(board.id, false), null);
  void archivedBoard;
});

test("Vorstandsnotizen: Einzelrecht folgt der Einstellung", async () => {
  data.invalidatePermissionsCache();
  assert.equal(perms.canSeeBoardNotes((await actor(["REVISOR"])).roles), false);
  assert.equal(perms.canSeeBoardNotes((await actor(["AKTUAR"])).roles), true);
  await save.saveRolePermissions(await actor(["ADMIN"]), input({ flags: { AKTUAR: { boardNotes: false }, REVISOR: { boardNotes: true } } }));
  assert.equal(perms.canSeeBoardNotes((await actor(["REVISOR"])).roles), true);
  assert.equal(perms.canSeeBoardNotes((await actor(["AKTUAR"])).roles), false);
  assert.equal(perms.hasBoardRole((await actor(["AKTUAR"])).roles), false);
  await save.saveRolePermissions(await actor(["ADMIN"]), input({}));
  assert.equal(perms.canSeeBoardNotes((await actor(["AKTUAR"])).roles), true);
});

test("Geschäftsjahr abschliessen: Einzelrecht über die echte Speicherfunktion, serverseitig erzwungen, im Änderungsprotokoll", async () => {
  data.invalidatePermissionsCache();
  await save.saveRolePermissions(await actor(["ADMIN"]), input({}));
  const lock = { action: "lock" as const, note: "", confirmUnbooked: false };
  const closeCount = async () => db.auditLog.count({ where: { action: "permissions.update" } });
  const before = await closeCount();

  // Voreinstellung: Kassier und Präsident dürfen, Vize, Aktuar, Revisor nicht
  for (const r of ["KASSIER", "PRAESIDENT", "OWNER", "ADMIN"]) assert.equal(ledgerLib.canCloseFiscalYear((await actor([r])).roles), true, r);
  for (const r of ["VIZEPRAESIDENT", "AKTUAR", "REVISOR", "EDITOR"]) assert.equal(ledgerLib.canCloseFiscalYear((await actor([r])).roles), false, r);

  // Präsident und Kassier das Recht wegnehmen; Revisor bekommt es (ohne Kasse-Schreibrecht, mit Leserecht)
  const res = await save.saveRolePermissions(await actor(["ADMIN"]), input({ flags: { PRAESIDENT: { fiscalYearClose: false }, KASSIER: { fiscalYearClose: false }, VIZEPRAESIDENT: { fiscalYearClose: true } } }));
  assert.equal(res.changed, true);
  assert.deepEqual(JSON.parse((await stored()) ?? "{}"), { flags: { PRAESIDENT: { fiscalYearClose: false }, KASSIER: { fiscalYearClose: false }, VIZEPRAESIDENT: { fiscalYearClose: true } } });

  const praes = await actor(["PRAESIDENT"]);
  const kassier = await actor(["KASSIER"]);
  assert.equal(ledgerLib.canCloseFiscalYear(praes.roles), false);
  assert.equal(ledgerLib.canCloseFiscalYear(kassier.roles), false);
  assert.equal(ledgerLib.canCloseFiscalYear((await actor(["VIZEPRAESIDENT"])).roles), true);
  assert.equal(perms.canAccess(kassier.roles, "ledger", "write"), true, "Buchen bleibt am Schreibrecht");

  // Serverseitig: der Abschluss wird vor jedem Datenzugriff mit 403 abgelehnt
  await rejects403(ledgerData.applyFiscalAction(praes, 2020, lock));
  await rejects403(ledgerData.applyFiscalAction(kassier, 2020, lock));
  await rejects403(ledgerData.applyFiscalAction(kassier, 2020, { action: "unlock", note: "Korrektur", confirmUnbooked: false }));
  await rejects403(ledgerData.applyFiscalAction(await actor(["REVISOR"]), 2020, lock));

  // Änderungsprotokoll mit Vorher/Nachher
  const log = (await db.auditLog.findMany({ where: { action: "permissions.update" }, orderBy: { createdAt: "desc" }, take: 1 }))[0];
  assert.equal(await closeCount(), before + 1);
  assert.deepEqual(JSON.parse(log.before ?? "{}"), { "PRAESIDENT.fiscalYearClose": true, "KASSIER.fiscalYearClose": true, "VIZEPRAESIDENT.fiscalYearClose": false });
  assert.deepEqual(JSON.parse(log.after ?? "{}"), { "PRAESIDENT.fiscalYearClose": false, "KASSIER.fiscalYearClose": false, "VIZEPRAESIDENT.fiscalYearClose": true });

  // Recht an, aber Kasse ganz weg: kein Abschluss
  await save.saveRolePermissions(await actor(["ADMIN"]), input({ levels: { KASSIER: { ledger: "none" } } }));
  assert.equal(ledgerLib.canCloseFiscalYear((await actor(["KASSIER"])).roles), false);

  // Zurücksetzen: Voreinstellung gilt wieder
  await save.saveRolePermissions(await actor(["OWNER"]), input({}));
  assert.equal(await stored(), null);
  assert.equal(ledgerLib.canCloseFiscalYear((await actor(["PRAESIDENT"])).roles), true);
  assert.equal(ledgerLib.canCloseFiscalYear((await actor(["KASSIER"])).roles), true);
  assert.equal(ledgerLib.canCloseFiscalYear((await actor(["VIZEPRAESIDENT"])).roles), false);
});
