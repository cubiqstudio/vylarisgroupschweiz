// Tests der Geräteverwaltung für die Scanner-App gegen eine eigene, leere SQLite-Datenbank (Datei im Temp-Ordner): Token einmalig,
// Hash statt Klartext, Kopplungs-Link, sperren/aktivieren/löschen, Rechte (nur «System ändern») und Änderungsprotokoll ohne Token.
// Die Entwicklungsdatenbank bleibt unberührt.
// Aufruf:  npx tsx scripts/test/scanner-admin.test.mts
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, test } from "node:test";

const dir = mkdtempSync(join(tmpdir(), "vgs-scanner-admin-"));
process.env.DATABASE_URL = `file:${join(dir, "test.db")}`;
process.env.AUTH_SECRET = "ein-geheimnis-fuer-den-test-mindestens-32-zeichen";
process.env.SITE_URL = "https://verein.example.test/";

// "server-only" wirft ausserhalb von Next.js; für den Test durch ein leeres Modul ersetzen.
const require = createRequire(import.meta.url);
const serverOnlyPath = require.resolve("server-only");
require.cache[serverOnlyPath] = { id: serverOnlyPath, filename: serverOnlyPath, loaded: true, exports: {}, children: [], paths: [] } as unknown as NodeJS.Module;

execFileSync("npx", ["prisma", "db", "push", "--skip-generate", "--accept-data-loss"], { env: process.env, stdio: "pipe" });

const { db } = await import("../../src/lib/db.ts");
const devices = await import("../../src/lib/verein/scanner-devices.ts");
const tokens = await import("../../src/lib/scanner-token.ts");
const perms = await import("../../src/lib/verein/permissions.ts");
const view = await import("../../src/lib/verein/audit-view.ts");
const { site } = await import("../../src/lib/site.ts");

after(async () => {
  await db.$disconnect();
  rmSync(dir, { recursive: true, force: true });
});

const admin = (roles: string[]) => ({ id: `adm-${roles.join("-")}`, name: `Test ${roles.join("+")}`, roles: roles as never });
const owner = admin(["OWNER"]);
const rejects403 = (p: Promise<unknown>) => assert.rejects(p, (e: { status?: number }) => e.status === 403);
const audit = (action: string) => db.auditLog.findMany({ where: { action }, orderBy: { createdAt: "asc" } });

/** Alles, was die Datenbank an Geräten und Protokoll enthält, als Text (zum Suchen nach dem Klartext-Token). */
async function dump(): Promise<string> {
  return JSON.stringify([await db.scannerDevice.findMany(), await db.auditLog.findMany()]);
}

test("Anlegen: Token gibt es einmal, in der Datenbank liegen nur Hash und Hinweis", async () => {
  const res = await devices.createScannerDevice(owner, { label: "Eingang links", canCheckIn: true });
  assert.match(res.token, tokens.SCANNER_TOKEN_PATTERN);
  const row = await db.scannerDevice.findUniqueOrThrow({ where: { id: res.device.id } });
  assert.equal(row.tokenHash, tokens.hashScannerToken(res.token));
  assert.equal(row.tokenHint, res.token.slice(0, 8));
  assert.notEqual(row.tokenHash, res.token);
  assert.equal(row.label, "Eingang links");
  assert.equal(row.canCheckIn, true);
  assert.equal(row.active, true);
  assert.equal(row.revokedAt, null);
  assert.equal(row.lastUsedAt, null);
  assert.ok(!(await dump()).includes(res.token), "Klartext-Token darf nirgends in der Datenbank stehen");

  // Spätere Abfragen liefern nur den Hinweis
  const list = await devices.listScannerDevices();
  const listed = list.find((d) => d.id === res.device.id)!;
  assert.equal(listed.tokenHint, res.token.slice(0, 8));
  assert.ok(!JSON.stringify(list).includes(res.token));
  assert.ok(!("token" in listed) && !("tokenHash" in listed));
  assert.ok(!JSON.stringify(res.device).includes(res.token));

  // Zwei Geräte bekommen verschiedene Token
  const other = await devices.createScannerDevice(owner, { label: "Eingang rechts", canCheckIn: false });
  assert.notEqual(other.token, res.token);
  assert.equal(other.device.canCheckIn, false);
});

test("Kopplungs-Link: Basis-URL aus site.url, URL-kodiert, nie aus einer Anfrage", async () => {
  assert.equal(site.url, "https://verein.example.test/", "Test geht von SITE_URL mit Schrägstrich am Ende aus");
  const res = await devices.createScannerDevice(owner, { label: "Kasse", canCheckIn: true });
  assert.equal(res.pairingUrl, `vylarisscanner://pair?server=${encodeURIComponent("https://verein.example.test")}&token=${res.token}`);
  assert.ok(res.pairingUrl.startsWith("vylarisscanner://pair?server=https%3A%2F%2Fverein.example.test&token=vgst_"));
  const u = new URL(res.pairingUrl);
  assert.equal(u.protocol, "vylarisscanner:");
  assert.equal(u.searchParams.get("server"), "https://verein.example.test");
  assert.equal(u.searchParams.get("token"), res.token);
  // QR-Code als Vektorpfad
  assert.ok(res.qr.modules >= 21 && res.qr.pathD.startsWith("M"));

  // Reine Funktion: Pfad und Port werden kodiert, Schrägstriche am Ende entfallen, Sonderzeichen im Token bleiben heil
  assert.equal(devices.scannerPairingUrl("vgst_abc-_", "http://localhost:3000///"), "vylarisscanner://pair?server=http%3A%2F%2Flocalhost%3A3000&token=vgst_abc-_");
  assert.equal(new URL(devices.scannerPairingUrl("t", "https://a.example/b?c=1&d=2")).searchParams.get("server"), "https://a.example/b?c=1&d=2");
});

test("Eingabe: Bezeichnung 1 bis 60 Zeichen, getrimmt; «darf einchecken» ist standardmässig an", () => {
  const ok = devices.scannerDeviceCreateSchema.parse({ label: "  Tür  " });
  assert.deepEqual(ok, { label: "Tür", canCheckIn: true });
  assert.equal(devices.scannerDeviceCreateSchema.safeParse({ label: "" }).success, false);
  assert.equal(devices.scannerDeviceCreateSchema.safeParse({ label: "   " }).success, false);
  assert.equal(devices.scannerDeviceCreateSchema.safeParse({ label: "x".repeat(61) }).success, false);
  assert.equal(devices.scannerDeviceCreateSchema.safeParse({ label: "x".repeat(60) }).success, true);
  assert.equal(devices.scannerDeviceCreateSchema.safeParse({}).success, false);
  assert.equal(devices.scannerDeviceCreateSchema.safeParse({ label: "a", canCheckIn: "ja" }).success, false);
  // Änderung: mindestens ein bekanntes Feld, nichts Fremdes
  assert.equal(devices.scannerDevicePatchSchema.safeParse({}).success, false);
  assert.equal(devices.scannerDevicePatchSchema.safeParse({ label: "neu" }).success, false);
  assert.equal(devices.scannerDevicePatchSchema.safeParse({ active: false }).success, true);
  assert.equal(devices.scannerDevicePatchSchema.safeParse({ canCheckIn: false, active: true }).success, true);
});

test("Sperren, aktivieren, «darf einchecken» ändern, löschen", async () => {
  const { device, token } = await devices.createScannerDevice(owner, { label: "Garderobe", canCheckIn: true });
  const id = device.id;

  const revoked = await devices.updateScannerDevice(owner, id, { active: false });
  assert.equal(revoked.active, false);
  assert.ok(revoked.revokedAt instanceof Date);
  let row = await db.scannerDevice.findUniqueOrThrow({ where: { id } });
  assert.equal(row.active, false);
  assert.ok(row.revokedAt);
  assert.equal(row.tokenHash, tokens.hashScannerToken(token), "Token bleibt unverändert");

  // Nochmals sperren ändert nichts und schreibt nichts
  const before = (await audit("scanner.device.revoke")).length;
  await devices.updateScannerDevice(owner, id, { active: false });
  assert.equal((await audit("scanner.device.revoke")).length, before);

  const activated = await devices.updateScannerDevice(owner, id, { active: true });
  assert.equal(activated.active, true);
  assert.equal(activated.revokedAt, null);
  row = await db.scannerDevice.findUniqueOrThrow({ where: { id } });
  assert.equal(row.active, true);
  assert.equal(row.revokedAt, null);

  const nocheck = await devices.updateScannerDevice(owner, id, { canCheckIn: false });
  assert.equal(nocheck.canCheckIn, false);
  assert.equal(nocheck.active, true);
  assert.equal((await db.scannerDevice.findUniqueOrThrow({ where: { id } })).canCheckIn, false);

  // Beides in einer Anfrage: zwei Einträge
  await devices.updateScannerDevice(owner, id, { active: false, canCheckIn: true });
  row = await db.scannerDevice.findUniqueOrThrow({ where: { id } });
  assert.equal(row.active, false);
  assert.equal(row.canCheckIn, true);

  await devices.deleteScannerDevice(owner, id);
  assert.equal(await db.scannerDevice.findUnique({ where: { id } }), null);
  await assert.rejects(devices.deleteScannerDevice(owner, id), (e: { status?: number }) => e.status === 404);
  await assert.rejects(devices.updateScannerDevice(owner, id, { active: true }), (e: { status?: number }) => e.status === 404);
});

test("Rechte: nur mit Schreibrecht auf «system»; Kassier, Revisor und andere bekommen 403, nichts ändert sich", async () => {
  const { device } = await devices.createScannerDevice(owner, { label: "Rechte-Test", canCheckIn: true });
  const count = await db.scannerDevice.count();
  const audits = await db.auditLog.count();
  for (const roles of [["KASSIER"], ["REVISOR"], ["EDITOR"], ["AKTUAR"], ["PRAESIDENT"], ["VIZEPRAESIDENT"], ["KASSIER", "REVISOR"]]) {
    const a = admin(roles);
    await rejects403(devices.createScannerDevice(a, { label: "Nein", canCheckIn: true }));
    await rejects403(devices.updateScannerDevice(a, device.id, { active: false }));
    await rejects403(devices.deleteScannerDevice(a, device.id));
  }
  assert.equal(await db.scannerDevice.count(), count);
  assert.equal(await db.auditLog.count(), audits);
  assert.equal((await db.scannerDevice.findUniqueOrThrow({ where: { id: device.id } })).active, true);

  // Inhaber und Administration dürfen
  await devices.updateScannerDevice(admin(["ADMIN"]), device.id, { canCheckIn: false });
  assert.equal((await db.scannerDevice.findUniqueOrThrow({ where: { id: device.id } })).canCheckIn, false);
});

test("Pfade gehören zum Modul «system»; Kassier und Revisor kommen nicht einmal zum Lesen", () => {
  for (const p of ["/admin/scanner", "/api/admin/scanner-devices", "/api/admin/scanner-devices/abc"]) {
    assert.equal(perms.moduleForPath(p), "system", p);
  }
  for (const r of ["KASSIER", "REVISOR", "EDITOR", "AKTUAR"]) assert.equal(perms.canAccess([r], "system", "read"), false, r);
  for (const r of ["PRAESIDENT", "VIZEPRAESIDENT"]) assert.equal(perms.canAccess([r], "system", "write"), false, r);
  for (const r of ["OWNER", "ADMIN"]) assert.equal(perms.canAccess([r], "system", "write"), true, r);
  // Navigation: Eintrag «Scanner» nur mit Leserecht auf «system»
  const groups = [{ title: "System", items: [{ href: "/admin/scanner", label: "Scanner", module: "system" as const }] }];
  assert.equal(perms.filterNav(groups, ["KASSIER"]).length, 0);
  assert.equal(perms.filterNav(groups, ["ADMIN"]).length, 1);
});

test("Änderungsprotokoll: Admin als Akteur mit Bezeichnung und Geräte-ID, nie mit Token", async () => {
  const actor = admin(["ADMIN"]);
  const { device, token } = await devices.createScannerDevice(actor, { label: "Protokoll-Test", canCheckIn: true });
  await devices.updateScannerDevice(actor, device.id, { canCheckIn: false });
  await devices.updateScannerDevice(actor, device.id, { active: false });
  await devices.updateScannerDevice(actor, device.id, { active: true });
  await devices.deleteScannerDevice(actor, device.id);

  const mine = (await db.auditLog.findMany({ where: { objectId: device.id }, orderBy: { createdAt: "asc" } })).map((r) => r.action).sort();
  assert.deepEqual(mine, ["scanner.device.activate", "scanner.device.create", "scanner.device.delete", "scanner.device.revoke", "scanner.device.update"]);
  for (const r of await db.auditLog.findMany({ where: { objectId: device.id } })) {
    assert.equal(r.actorType, "ADMIN");
    assert.equal(r.actorId, actor.id);
    assert.equal(r.actorName, actor.name);
    assert.equal(r.objectType, "ScannerDevice");
    assert.ok(r.summary.includes("Protokoll-Test"), r.summary);
    assert.ok(!JSON.stringify(r).includes(token));
    assert.ok(!JSON.stringify(r).includes(tokens.hashScannerToken(token)));
    assert.ok(!/vgst_/.test(JSON.stringify(r)));
  }
  assert.ok(!(await dump()).includes(token));
});

test("Anzeige des Protokolls: alle Scanner-Aktionen sind lesbar (auch Check-in und Rücknahme)", () => {
  const expected: Record<string, string> = {
    "scanner.checkin": "Scanner: Check-in",
    "scanner.undo": "Scanner: Check-in zurückgenommen",
    "scanner.device.create": "Scanner-Gerät angelegt",
    "scanner.device.revoke": "Scanner-Gerät gesperrt",
    "scanner.device.activate": "Scanner-Gerät wieder aktiviert",
    "scanner.device.update": "Scanner-Gerät geändert",
    "scanner.device.delete": "Scanner-Gerät gelöscht",
  };
  for (const [action, label] of Object.entries(expected)) assert.equal(view.auditActionLabel(action), label, action);
  assert.equal(view.auditObjectLabel("ScannerDevice"), "Scanner-Gerät");
  assert.equal(view.auditFieldLabel("canCheckIn"), "Darf einchecken");
  assert.equal(view.auditFieldLabel("label"), "Bezeichnung");
  assert.equal(view.auditFieldLabel("personen"), "Personen");
  assert.equal(view.auditFieldLabel("memberNumber"), "Mitgliedernummer");
  // Nie geschriebene Bezeichnungen sind entfernt (der Code protokolliert weder attended noch attendedAt)
  assert.equal(view.auditFieldLabel("attendedAt"), "attendedAt");
  assert.equal(view.auditFieldLabel("attended"), "attended");
  const changes = view.auditChanges('{"canCheckIn":true}', '{"canCheckIn":false}');
  assert.deepEqual(changes, [{ field: "canCheckIn", label: "Darf einchecken", before: "ja", after: "nein" }]);
});
