// Tests der einstellbaren Rollenrechte (reine Funktionen, ohne Datenbank): Auflösung, Schranken, Aussperr- und Ausweitungsschutz,
// kaputte Daten, Einzelrechte, Erklärungen.
// Aufruf:  npx tsx scripts/test/permissions.test.mts
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { test } from "node:test";

// "server-only" wirft ausserhalb von Next.js; für den Test durch ein leeres Modul ersetzen.
const require = createRequire(import.meta.url);
const serverOnlyPath = require.resolve("server-only");
require.cache[serverOnlyPath] = { id: serverOnlyPath, filename: serverOnlyPath, loaded: true, exports: {}, children: [], paths: [] } as unknown as NodeJS.Module;

const perms = await import("../../src/lib/verein/permissions.ts");
const cfg = await import("../../src/lib/verein/permissions-config.ts");
const docs = await import("../../src/lib/verein/documents-lib.ts");

const { resolveMatrix, DEFAULT_MATRIX, canAccess, levelFor, VEREIN_MODULES, CONFIGURABLE_ROLES } = perms;

test("Voreinstellung: Präsident darf in der Kasse buchen, Vize nur lesen", () => {
  assert.equal(levelFor(["PRAESIDENT"], "ledger"), "write");
  assert.equal(levelFor(["VIZEPRAESIDENT"], "ledger"), "read");
  assert.equal(levelFor(["KASSIER"], "ledger"), "write");
  assert.match(perms.ADMIN_ROLE_HINT.PRAESIDENT, /Kasse \(buchen, Konten ändern\)/);
});

test("Voreinstellung: Einzelrechte nur für Vorstandsrollen, nicht für Revisor und Redakteur", () => {
  for (const r of ["OWNER", "ADMIN", "PRAESIDENT", "VIZEPRAESIDENT", "KASSIER", "AKTUAR"]) {
    assert.equal(perms.canSeeBoardNotes([r]), true, `${r} Notizen`);
    assert.equal(perms.canSeeBoardDocuments([r]), true, `${r} Dokumente`);
  }
  for (const r of ["REVISOR", "EDITOR"]) {
    assert.equal(perms.canSeeBoardNotes([r]), false, `${r} Notizen`);
    assert.equal(perms.canSeeBoardDocuments([r]), false, `${r} Dokumente`);
  }
  assert.equal(perms.hasBoardRole(["AKTUAR"]), true);
  assert.equal(perms.hasBoardRole(["REVISOR"]), false);
  assert.equal(perms.canSeeBoardDocuments([]), false);
  assert.equal(perms.canSeeBoardDocuments(["HACKER"]), false);
});

test("resolveMatrix: ohne Angaben ist die Matrix die Voreinstellung", () => {
  for (const input of [undefined, null, {}, [], "x", 5, { levels: null }, { levels: [], flags: "x" }]) {
    const m = resolveMatrix(input);
    assert.deepEqual(JSON.parse(JSON.stringify(m)), JSON.parse(JSON.stringify(DEFAULT_MATRIX)), JSON.stringify(input));
  }
});

test("resolveMatrix: Abweichungen gelten, der Rest bleibt Voreinstellung", () => {
  const m = resolveMatrix({
    levels: { PRAESIDENT: { ledger: "read" }, REVISOR: { members: "read", fees: "none" }, AKTUAR: { ledger: "write" } },
    flags: { REVISOR: { boardDocuments: true } },
  });
  assert.equal(levelFor(["PRAESIDENT"], "ledger", m), "read");
  assert.equal(levelFor(["PRAESIDENT"], "members", m), "write", "unberührt");
  assert.equal(levelFor(["REVISOR"], "members", m), "read");
  assert.equal(levelFor(["REVISOR"], "fees", m), null, "«none» nimmt die Stufe weg");
  assert.equal(levelFor(["AKTUAR"], "ledger", m), "write");
  assert.equal(perms.canSeeBoardDocuments(["REVISOR"], m), true);
  assert.equal(perms.canSeeBoardNotes(["REVISOR"], m), false);
  // Die Voreinstellung bleibt unverändert
  assert.equal(levelFor(["REVISOR"], "fees"), "read");
  assert.equal(perms.canSeeBoardDocuments(["REVISOR"]), false);
});

test("Schranken: Inhaber und Administration sind fest und nie einschränkbar", () => {
  const m = resolveMatrix({
    levels: { OWNER: Object.fromEntries(VEREIN_MODULES.map((x) => [x, "none"])), ADMIN: { system: "none", self: "none", dashboard: "none" } },
    flags: { OWNER: { boardDocuments: false, boardNotes: false }, ADMIN: { boardDocuments: false } },
  });
  for (const r of ["OWNER", "ADMIN"]) {
    for (const mod of VEREIN_MODULES) assert.equal(levelFor([r], mod, m), "write", `${r} ${mod}`);
    assert.equal(perms.canSeeBoardDocuments([r], m), true);
    assert.equal(perms.canSeeBoardNotes([r], m), true);
  }
});

test("Schranken: self bleibt «Ändern», dashboard mindestens «Lesen»", () => {
  for (const role of CONFIGURABLE_ROLES) {
    const m = resolveMatrix({ levels: { [role]: { self: "none", dashboard: "none" } } });
    assert.equal(levelFor([role], "self", m), "write", `${role} self`);
    assert.ok(canAccess([role], "dashboard", "read", m), `${role} dashboard`);
    const r = resolveMatrix({ levels: { [role]: { self: "read" } } });
    assert.equal(levelFor([role], "self", r), "write");
  }
  assert.equal(perms.isAllowedLevel("KASSIER", "self", "read"), false);
  assert.equal(perms.isAllowedLevel("KASSIER", "dashboard", "none"), false);
  assert.equal(perms.isAllowedLevel("KASSIER", "dashboard", "write"), true);
});

test("Ausweitungsschutz: «system» nie «Ändern» für andere Rollen, höchstens «Lesen»", () => {
  for (const role of CONFIGURABLE_ROLES) {
    const m = resolveMatrix({ levels: { [role]: { system: "write" } } });
    assert.equal(canAccess([role], "system", "write", m), false, `${role} darf system nicht ändern`);
    assert.equal(levelFor([role], "system", m), perms.DEFAULT_MATRIX.levels[role].system ?? null, "gespeichertes «write» wird verworfen: Voreinstellung");
    const r = resolveMatrix({ levels: { [role]: { system: "read" } } });
    assert.equal(levelFor([role], "system", r), "read");
    assert.equal(canAccess([role], "system", "write", r), false);
  }
  assert.equal(perms.isAllowedLevel("PRAESIDENT", "system", "write"), false);
  assert.equal(perms.isAllowedLevel("PRAESIDENT", "system", "read"), true);
  assert.equal(perms.isAllowedLevel("PRAESIDENT", "system", "none"), true);
  assert.equal(perms.isAllowedLevel("OWNER", "ledger", "none"), false, "feste Rollen sind nicht einstellbar");
  assert.equal(perms.isAllowedLevel("HACKER", "ledger", "read"), false);
});

test("Mehrere Rollen: höchste Stufe zählt auch mit eigener Matrix, system nur über Inhaber/Administration", () => {
  const m = resolveMatrix({ levels: { KASSIER: { members: "none" }, AKTUAR: { members: "read" } } });
  assert.equal(levelFor(["KASSIER", "AKTUAR"], "members", m), "read");
  assert.equal(canAccess(["KASSIER", "PRAESIDENT"], "system", "write", m), false);
  assert.equal(canAccess(["KASSIER", "ADMIN"], "system", "write", m), true);
});

test("Verfälschte oder alte Daten: unbekannte Rollen, Module, Werte und Typen werden verworfen", () => {
  const evil = {
    levels: {
      PRAESIDENT: { ledger: "superuser", members: 5, hacking: "write", __proto__: { system: "write" }, constructor: "write", system: "write" },
      HACKER: { system: "write", ledger: "write" },
      constructor: { system: "write" },
      __proto__: { KASSIER: { system: "write" } },
      REVISOR: "write",
      KASSIER: null,
    },
    flags: { PRAESIDENT: { boardNotes: "yes", other: true }, REVISOR: { boardDocuments: 1 }, HACKER: { boardDocuments: true } },
  };
  const m = resolveMatrix(evil);
  assert.deepEqual(JSON.parse(JSON.stringify(m)), JSON.parse(JSON.stringify(DEFAULT_MATRIX)));
  assert.equal(canAccess(["HACKER"], "dashboard", "read", m), false);
  assert.equal(Object.keys(m.levels).includes("HACKER"), false);
});

test("Gespeicherter Text: kaputtes JSON, falsche Form, zu gross → Voreinstellung", () => {
  const same = (raw: string | null | undefined) =>
    assert.deepEqual(JSON.parse(JSON.stringify(cfg.matrixFromStored(raw))), JSON.parse(JSON.stringify(DEFAULT_MATRIX)), String(raw).slice(0, 40));
  for (const raw of [null, undefined, "", "   ", "{", "nicht json", "[]", "null", "5", '"x"', '{"levels":5}', '{"levels":{"KASSIER":5}}', '{"levels":{"KASSIER":{"ledger":5}}}', '{"flags":{"REVISOR":{"boardDocuments":"ja"}}}']) same(raw);
  same(JSON.stringify({ levels: { KASSIER: { notes: "x".repeat(30_000) } } }));
  // gültig und ungültig gemischt: nur das Gültige gilt
  const m = cfg.matrixFromStored('{"levels":{"KASSIER":{"ledger":"read","system":"write"}},"flags":{"REVISOR":{"boardDocuments":true}}}');
  assert.equal(levelFor(["KASSIER"], "ledger", m), "read");
  assert.equal(canAccess(["KASSIER"], "system", "write", m), false);
  assert.equal(perms.canSeeBoardDocuments(["REVISOR"], m), true);
});

test("Speicherformat: nur Abweichungen, Rundreise, leer = null", () => {
  assert.equal(cfg.serializeOverrides(perms.diffFromDefault(DEFAULT_MATRIX)), null);
  const m = resolveMatrix({ levels: { PRAESIDENT: { ledger: "read" }, REVISOR: { fees: "none" } }, flags: { REVISOR: { boardNotes: true } } });
  const diff = perms.diffFromDefault(m);
  assert.deepEqual(diff, { levels: { PRAESIDENT: { ledger: "read" }, REVISOR: { fees: "none" } }, flags: { REVISOR: { boardNotes: true } } });
  const text = cfg.serializeOverrides(diff);
  assert.ok(text);
  assert.deepEqual(JSON.parse(JSON.stringify(cfg.matrixFromStored(text))), JSON.parse(JSON.stringify(m)));
  // Eine Angabe, die der Voreinstellung entspricht, wird nicht gespeichert
  const same = resolveMatrix({ levels: { PRAESIDENT: { ledger: "write" } } });
  assert.equal(cfg.serializeOverrides(perms.diffFromDefault(same)), null);
});

test("Eingabeprüfung (Zod): streng, deutsche Meldungen, Schranken", () => {
  const ok = cfg.rolePermissionsInputSchema.safeParse({ levels: { KASSIER: { ledger: "read", members: "none" } }, flags: { REVISOR: { boardDocuments: true } } });
  assert.equal(ok.success, true);
  assert.equal(cfg.rolePermissionsInputSchema.safeParse({}).success, true, "leer = alles Voreinstellung");
  const bad: unknown[] = [
    { levels: { KASSIER: { system: "write" } } },
    { levels: { PRAESIDENT: { self: "read" } } },
    { levels: { PRAESIDENT: { dashboard: "none" } } },
    { levels: { OWNER: { ledger: "none" } } },
    { levels: { ADMIN: { system: "none" } } },
    { levels: { HACKER: { ledger: "read" } } },
    { levels: { KASSIER: { gibtsnicht: "read" } } },
    { levels: { KASSIER: { ledger: "admin" } } },
    { flags: { OWNER: { boardDocuments: false } } },
    { flags: { REVISOR: { boardDocuments: "ja" } } },
    { flags: { REVISOR: { unbekannt: true } } },
    { extra: 1 },
  ];
  for (const b of bad) {
    const r = cfg.rolePermissionsInputSchema.safeParse(b);
    assert.equal(r.success, false, JSON.stringify(b));
  }
  const sys = cfg.rolePermissionsInputSchema.safeParse({ levels: { KASSIER: { system: "write" } } });
  assert.ok(!sys.success && sys.error.issues.some((i) => /höchstens «Lesen»/.test(i.message)), "Meldung auf Deutsch");
  // «system: read» ist erlaubt
  assert.equal(cfg.rolePermissionsInputSchema.safeParse({ levels: { KASSIER: { system: "read" } } }).success, true);
});

test("Eingabe → Matrix → Oberfläche: Rundreise mit matrixToInput", () => {
  const parsed = cfg.rolePermissionsInputSchema.parse({ levels: { REVISOR: { members: "read" } }, flags: { REVISOR: { boardNotes: true } } });
  const m = cfg.matrixFromInput(parsed);
  const ui = cfg.matrixToInput(m);
  assert.equal(ui.levels.REVISOR.members, "read");
  assert.equal(ui.levels.REVISOR.fees, "read");
  assert.equal(ui.levels.REVISOR.system, "none");
  assert.equal(ui.flags.REVISOR.boardNotes, true);
  assert.equal("OWNER" in ui.levels, false);
  assert.equal("ADMIN" in ui.levels, false);
  // matrixToInput der Voreinstellung wieder eingelesen ergibt die Voreinstellung
  const again = cfg.matrixFromInput(cfg.rolePermissionsInputSchema.parse(cfg.matrixToInput(DEFAULT_MATRIX)));
  assert.deepEqual(JSON.parse(JSON.stringify(again)), JSON.parse(JSON.stringify(DEFAULT_MATRIX)));
});

test("Wirksame Matrix an der Rollenliste: canAccess, levelsFor, visibleModules, filterNav folgen ihr", () => {
  const m = resolveMatrix({ levels: { REVISOR: { ledger: "none", members: "read" } } });
  const roles = perms.withMatrix(["REVISOR"], m);
  assert.equal(canAccess(roles, "ledger"), false);
  assert.equal(canAccess(roles, "members"), true);
  assert.ok(!perms.visibleModules(roles).includes("ledger"));
  assert.equal(perms.levelsFor(roles).ledger, undefined);
  assert.equal(perms.levelsFor(roles).members, "read");
  const groups = [{ title: "Verein", items: [{ href: "/admin/ledger", label: "Kasse", module: "ledger" as const }, { href: "/admin/members", label: "Mitglieder", module: "members" as const }] }];
  assert.deepEqual(perms.filterNav(groups, roles).map((g) => g.items.map((i) => i.label)), [["Mitglieder"]]);
  assert.deepEqual(perms.filterNavByLevels(groups, perms.levelsFor(roles)).map((g) => g.items.map((i) => i.label)), [["Mitglieder"]]);
  // Die Rollenliste selbst bleibt eine gewöhnliche Liste
  assert.deepEqual([...roles], ["REVISOR"]);
  assert.equal(JSON.stringify(roles), '["REVISOR"]');
  // Ohne angehängte Matrix gilt die Voreinstellung
  assert.equal(canAccess(["REVISOR"], "ledger"), true);
  // Eine manipulierte «Matrix» an der Liste gilt nicht
  const fake = Object.defineProperty(["REVISOR"], Symbol.for("vylaris.verein.effectiveMatrix"), { value: "x" });
  assert.equal(canAccess(fake, "ledger"), true);
});

test("Rechte-Seite gehört zum Modul «system»", () => {
  assert.equal(perms.moduleForPath("/api/admin/settings/verein/rollen"), "system");
  assert.equal(perms.moduleForPath("/admin/verein/rollen"), "system");
  assert.equal(perms.moduleForPath("/admin/verein/rollen/"), "system");
  assert.equal(perms.moduleForPath("/api/admin/settings/verein"), "verein_settings");
});

test("Erklärung je Rolle folgt der wirksamen Matrix", () => {
  assert.match(perms.roleHint("PRAESIDENT"), /Ändern: .*Kasse/);
  const m = resolveMatrix({ levels: { PRAESIDENT: { ledger: "none" } }, flags: { PRAESIDENT: { boardDocuments: false } } });
  const hint = perms.roleHint("PRAESIDENT", m);
  assert.doesNotMatch(hint, /Kasse/);
  assert.match(hint, /Vorstandsnotizen/);
  assert.doesNotMatch(hint, /Nur Vorstand/);
  assert.equal(perms.roleHint("OWNER"), perms.ADMIN_ROLE_HINT.OWNER);
  const a = perms.describeAccess(["REVISOR"], resolveMatrix({ flags: { REVISOR: { boardDocuments: true } } }));
  assert.equal(a.boardDocuments, true);
  assert.equal(a.boardNotes, false);
  assert.ok(a.read.includes("ledger") && !a.write.includes("ledger") && a.none.includes("members"));
  assert.ok(!a.read.includes("self") && !a.write.includes("self"));
});

test("Dokumente: Publikum der Verwaltung hängt am Einzelrecht", () => {
  const board = docs.adminAudience(true);
  const staff = docs.adminAudience(false);
  assert.equal(docs.canView(board, "VORSTAND"), true);
  assert.equal(docs.canView(staff, "VORSTAND"), false, "Revisor ohne Recht sieht «Nur Vorstand» nicht");
  assert.equal(docs.canView(staff, "MITGLIEDER"), true);
  assert.equal(docs.canView(staff, "OEFFENTLICH"), true);
  assert.equal(docs.canView(staff, "MITGLIEDER", new Date()), true, "Verwaltung sieht archivierte Dokumente");
  assert.equal(docs.canView("MEMBER", "MITGLIEDER", new Date()), false);
  assert.equal(docs.isStaffAudience(staff) && docs.isStaffAudience(board), true);
  assert.equal(docs.isStaffAudience("PUBLIC") || docs.isStaffAudience("MEMBER"), false);
  assert.deepEqual([...docs.visibilitiesFor("STAFF")], ["OEFFENTLICH", "MITGLIEDER"]);
});

// ---- Einzelrecht «Geschäftsjahr abschliessen und wieder öffnen» (fiscalYearClose) ------------------------------------------

test("fiscalYearClose: Voreinstellung an für Inhaber, Administration, Präsident, Kassier; sonst aus", () => {
  assert.ok((perms.ROLE_FLAGS as readonly string[]).includes("fiscalYearClose"));
  for (const r of ["OWNER", "ADMIN", "PRAESIDENT", "KASSIER"]) assert.equal(perms.canCloseFiscalYear([r]), true, r);
  for (const r of ["VIZEPRAESIDENT", "AKTUAR", "REVISOR", "EDITOR"]) assert.equal(perms.canCloseFiscalYear([r]), false, r);
  assert.equal(perms.canCloseFiscalYear([]), false);
  assert.equal(perms.canCloseFiscalYear(["HACKER"]), false);
  assert.equal(perms.canCloseFiscalYear(["VIZEPRAESIDENT", "KASSIER"]), true, "mehrere Rollen: eine mit Recht genügt");
});

test("fiscalYearClose: alte gespeicherte Konfiguration ohne das Feld bleibt gültig und bekommt die Voreinstellung", () => {
  const old = '{"levels":{"KASSIER":{"ledger":"read"}},"flags":{"REVISOR":{"boardDocuments":true},"AKTUAR":{"boardNotes":false}}}';
  const m = cfg.matrixFromStored(old);
  assert.equal(levelFor(["KASSIER"], "ledger", m), "read");
  assert.equal(perms.canSeeBoardDocuments(["REVISOR"], m), true);
  assert.equal(perms.canSeeBoardNotes(["AKTUAR"], m), false);
  for (const r of CONFIGURABLE_ROLES) assert.equal(m.flags[r].fiscalYearClose, DEFAULT_MATRIX.flags[r].fiscalYearClose, r);
  // Kassier hat «Lesen» auf die Kasse, das Recht ist an: Abschluss bleibt möglich
  assert.equal(perms.canCloseFiscalYear(["KASSIER"], m), true);
  // Beim erneuten Speichern kommt das Feld nicht in die Abweichungen (nur echte Abweichungen)
  assert.deepEqual(perms.diffFromDefault(m), { levels: { KASSIER: { ledger: "read" } }, flags: { REVISOR: { boardDocuments: true }, AKTUAR: { boardNotes: false } } });
});

test("fiscalYearClose: Auflösung, Rundreise im Speicherformat und in der Eingabe", () => {
  const m = resolveMatrix({ flags: { PRAESIDENT: { fiscalYearClose: false }, REVISOR: { fiscalYearClose: true }, OWNER: { fiscalYearClose: false }, ADMIN: { fiscalYearClose: false } } });
  assert.equal(m.flags.PRAESIDENT.fiscalYearClose, false);
  assert.equal(m.flags.REVISOR.fiscalYearClose, true);
  assert.equal(m.flags.OWNER.fiscalYearClose, true, "Inhaber fest");
  assert.equal(m.flags.ADMIN.fiscalYearClose, true, "Administration fest");
  const diff = perms.diffFromDefault(m);
  assert.deepEqual(diff, { flags: { PRAESIDENT: { fiscalYearClose: false }, REVISOR: { fiscalYearClose: true } } });
  const text = cfg.serializeOverrides(diff);
  assert.ok(text);
  assert.deepEqual(JSON.parse(JSON.stringify(cfg.matrixFromStored(text))), JSON.parse(JSON.stringify(m)));
  // Nicht-Booleans werden verworfen
  const bad = resolveMatrix({ flags: { KASSIER: { fiscalYearClose: "nein" } } });
  assert.equal(bad.flags.KASSIER.fiscalYearClose, true);
  // Eingabe der Oberfläche: Feld ist erlaubt, für Inhaber/Administration nicht
  const ok = cfg.rolePermissionsInputSchema.parse({ flags: { KASSIER: { fiscalYearClose: false } } });
  assert.equal(cfg.matrixFromInput(ok).flags.KASSIER.fiscalYearClose, false);
  assert.equal(cfg.rolePermissionsInputSchema.safeParse({ flags: { OWNER: { fiscalYearClose: false } } }).success, false);
  assert.equal(cfg.rolePermissionsInputSchema.safeParse({ flags: { KASSIER: { fiscalYearClose: "ja" } } }).success, false);
  const ui = cfg.matrixToInput(cfg.matrixFromInput(ok));
  assert.equal(ui.flags.KASSIER.fiscalYearClose, false);
  assert.equal(ui.flags.PRAESIDENT.fiscalYearClose, true);
  assert.deepEqual(JSON.parse(JSON.stringify(cfg.matrixFromInput(cfg.rolePermissionsInputSchema.parse(cfg.matrixToInput(DEFAULT_MATRIX))))), JSON.parse(JSON.stringify(DEFAULT_MATRIX)));
});

test("fiscalYearClose: Präsident mit Recht aus kann nicht abschliessen, Kassier ohne Recht ebenfalls, Revisor nie", () => {
  const m = resolveMatrix({ flags: { PRAESIDENT: { fiscalYearClose: false }, KASSIER: { fiscalYearClose: false } } });
  const praes = perms.withMatrix(["PRAESIDENT"], m);
  const kassier = perms.withMatrix(["KASSIER"], m);
  const revisor = perms.withMatrix(["REVISOR"], m);
  assert.equal(perms.canCloseFiscalYear(praes), false);
  assert.equal(perms.canCloseFiscalYear(kassier), false);
  assert.equal(perms.canCloseFiscalYear(revisor), false);
  // Das normale Buchen hängt weiter am Schreibrecht, nicht am neuen Recht
  assert.equal(canAccess(praes, "ledger", "write"), true);
  assert.equal(canAccess(kassier, "ledger", "write"), true);
  // Revisor: auch ohne Matrix-Anhang (Voreinstellung) nie
  assert.equal(perms.canCloseFiscalYear(["REVISOR"]), false);
  // Inhaber und Administration behalten das Recht immer
  assert.equal(perms.canCloseFiscalYear(perms.withMatrix(["OWNER"], m)), true);
  assert.equal(perms.canCloseFiscalYear(perms.withMatrix(["ADMIN"], m)), true);
});

test("fiscalYearClose: wirkt nur mit mindestens Leserecht auf die Kasse; Schreibrecht allein genügt nicht", () => {
  // Recht an, aber kein Zugriff auf die Kasse: kein Abschluss
  const noLedger = resolveMatrix({ levels: { KASSIER: { ledger: "none" }, PRAESIDENT: { ledger: "none" } }, flags: { VIZEPRAESIDENT: { fiscalYearClose: true }, AKTUAR: { fiscalYearClose: true } } });
  assert.equal(perms.canCloseFiscalYear(["KASSIER"], noLedger), false);
  assert.equal(perms.canCloseFiscalYear(["PRAESIDENT"], noLedger), false);
  assert.equal(perms.canCloseFiscalYear(["AKTUAR"], noLedger), false, "Aktuar hat keinen Zugriff auf die Kasse");
  // Nur Lesen reicht zusammen mit dem Recht (Vize hat «Lesen»)
  assert.equal(perms.canCloseFiscalYear(["VIZEPRAESIDENT"], noLedger), true);
  const readOnly = resolveMatrix({ levels: { KASSIER: { ledger: "read" } } });
  assert.equal(perms.canCloseFiscalYear(["KASSIER"], readOnly), true);
  // Schreibrecht ohne das Einzelrecht genügt nicht
  const noFlag = resolveMatrix({ levels: { AKTUAR: { ledger: "write" } } });
  assert.equal(canAccess(["AKTUAR"], "ledger", "write", noFlag), true);
  assert.equal(perms.canCloseFiscalYear(["AKTUAR"], noFlag), false);
  // Zwei Rollen: Recht aus der einen, Kasse aus der anderen
  assert.equal(perms.canCloseFiscalYear(["AKTUAR", "REVISOR"], resolveMatrix({ flags: { AKTUAR: { fiscalYearClose: true } } })), true);
});

test("fiscalYearClose: Vorschau und Rollenerklärung folgen dem Recht", () => {
  assert.equal(perms.describeAccess(["KASSIER"]).fiscalYearClose, true);
  assert.equal(perms.describeAccess(["REVISOR"]).fiscalYearClose, false);
  assert.match(perms.roleHint("KASSIER"), /Geschäftsjahr abschliessen und wieder öffnen/);
  assert.doesNotMatch(perms.roleHint("REVISOR"), /Geschäftsjahr abschliessen/);
  const m = resolveMatrix({ flags: { KASSIER: { fiscalYearClose: false } }, levels: { VIZEPRAESIDENT: { ledger: "none" } } });
  assert.doesNotMatch(perms.roleHint("KASSIER", m), /Geschäftsjahr abschliessen/);
  assert.equal(perms.describeAccess(["KASSIER"], m).fiscalYearClose, false);
  // Recht an, aber keine Kasse: in Vorschau und Erklärung nicht als erlaubt gezeigt
  const m2 = resolveMatrix({ levels: { KASSIER: { ledger: "none" } } });
  assert.equal(perms.describeAccess(["KASSIER"], m2).fiscalYearClose, false);
  assert.doesNotMatch(perms.roleHint("KASSIER", m2), /Geschäftsjahr abschliessen/);
  assert.ok(perms.ROLE_FLAG_LABEL.fiscalYearClose && perms.ROLE_FLAG_HINT.fiscalYearClose);
});
