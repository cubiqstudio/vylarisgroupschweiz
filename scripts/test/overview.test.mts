// Tests für die Fachlogik von Übersicht, Vereinseinstellungen, Zugängen, Änderungsprotokoll, Mitgliederausweis und Newsletter-Segmenten.
// Aufruf:  npx tsx scripts/test/overview.test.mts
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { test } from "node:test";

const require = createRequire(import.meta.url);
const serverOnlyPath = require.resolve("server-only");
require.cache[serverOnlyPath] = { id: serverOnlyPath, filename: serverOnlyPath, loaded: true, exports: {}, children: [], paths: [] } as unknown as NodeJS.Module;

const dates = await import("../../src/lib/verein/dates.ts");
const overview = await import("../../src/lib/verein/overview-lib.ts");
const settings = await import("../../src/lib/verein/settings-schema.ts");
const forms = await import("../../src/lib/verein/settings-forms.ts");
const profile = await import("../../src/lib/verein/profile-schema.ts");
const auditView = await import("../../src/lib/verein/audit-view.ts");
const access = await import("../../src/lib/verein/access-lib.ts");
const accessSchemas = await import("../../src/lib/verein/access-schemas.ts");
const card = await import("../../src/lib/verein/membership-card.ts");
const segment = await import("../../src/lib/verein/newsletter-segment.ts");
const validation = await import("../../src/lib/validation.ts");

const d = dates.dateOnly;

// ---- Übersicht -----------------------------------------------------------------------------------------------------------

test("Übersicht: Bereiche richten sich nach der Rechtematrix", () => {
  const revisor = overview.dashboardSections(["REVISOR"]);
  assert.deepEqual([revisor.fees, revisor.ledger, revisor.meetings], [true, true, true]);
  assert.deepEqual([revisor.members, revisor.events, revisor.tasks, revisor.website, revisor.setup], [false, false, false, false, false]);

  const kassier = overview.dashboardSections(["KASSIER"]);
  assert.equal(kassier.ledger, true);
  assert.equal(kassier.website, false, "Kassier sieht keine Website-Kennzahlen");
  assert.equal(kassier.finance, true);

  const editor = overview.dashboardSections(["EDITOR"]);
  assert.equal(editor.website, true);
  assert.equal(editor.members, false);

  const admin = overview.dashboardSections(["ADMIN"]);
  assert.ok(Object.values(admin).every(Boolean));

  // Mehrfachrolle: Vereinigung der Rechte
  const multi = overview.dashboardSections(["VIZEPRAESIDENT", "KASSIER"]);
  assert.equal(multi.fees, true);
  assert.equal(multi.website, true);
});

test("Übersicht: offene und überfällige Rechnungen", () => {
  const now = d(2026, 11, 5);
  const rows = [
    { status: "OFFEN", totalRappen: 5000, paidRappen: 0, dueDate: d(2026, 11, 5) }, // fällig heute: noch rechtzeitig
    { status: "OFFEN", totalRappen: 5000, paidRappen: 2000, dueDate: d(2026, 11, 4) }, // gestern fällig: überfällig, Rest 3000
    { status: "OFFEN", totalRappen: 1000, paidRappen: 1000, dueDate: d(2026, 1, 1) }, // vollständig bezahlt: zählt nicht
    { status: "BEZAHLT", totalRappen: 9999, paidRappen: 9999, dueDate: d(2026, 1, 1) },
    { status: "STORNIERT", totalRappen: 9999, paidRappen: 0, dueDate: d(2026, 1, 1) },
    { status: "ENTWURF", totalRappen: 9999, paidRappen: 0, dueDate: d(2026, 1, 1) },
  ];
  assert.deepEqual(overview.summarizeInvoices(rows, now), { openCount: 2, openRappen: 8000, overdueCount: 1, overdueRappen: 3000 });
  assert.deepEqual(overview.summarizeInvoices([], now), { openCount: 0, openRappen: 0, overdueCount: 0, overdueRappen: 0 });
});

test("Übersicht: Einrichtungshilfe gruppiert fehlende Einstellungen mit Link", () => {
  const empty = settings.DEFAULT_VEREIN_SETTINGS;
  const groups = overview.groupMissingSettings(settings.missingForInvoicing(empty), settings.missingForReminders(empty), settings.missingForInvitations(empty));
  assert.deepEqual(groups.map((g) => g.key), ["invoicing", "reminders", "invitations"]);
  assert.equal(groups[0]!.href, "/admin/verein/finanzen");
  assert.equal(groups[1]!.href, "/admin/verein/finanzen");
  assert.equal(groups[2]!.href, "/admin/verein");
  assert.ok(groups[0]!.items.length >= 3);

  const complete = { ...empty, accountHolder: "Verein", iban: "CH9300762011623852957", paymentDays: 30 };
  const g2 = overview.groupMissingSettings(settings.missingForInvoicing(complete), [], []);
  assert.equal(g2.length, 0, "Gruppen ohne fehlende Angaben entfallen");

  assert.equal(overview.settingsHrefFor("invitationDays"), "/admin/verein");
  assert.equal(overview.settingsHrefFor("reminderFee2Rappen"), "/admin/verein/finanzen");
  assert.equal(overview.setupPercent(10, 4), 60);
  assert.equal(overview.setupPercent(0, 0), 100);
  assert.equal(overview.countLabel(1, "Antrag", "Anträge"), "1 Antrag");
  assert.equal(overview.countLabel(3, "Antrag", "Anträge"), "3 Anträge");
});

// ---- Einstellungsseiten ------------------------------------------------------------------------------------------------------

test("Einstellungen: Allgemein und Finanzen sind getrennt und strikt", () => {
  const overlap = forms.GENERAL_SETTING_FIELDS.filter((f) => (forms.FINANCE_SETTING_FIELDS as readonly string[]).includes(f));
  assert.deepEqual(overlap, []);
  assert.equal(forms.GENERAL_SETTING_FIELDS.length + forms.FINANCE_SETTING_FIELDS.length, Object.keys(settings.VEREIN_SETTING_KEYS).length, "kein Feld geht verloren");

  // Finanzfelder auf der Allgemein-Seite werden abgelehnt
  assert.equal(forms.generalSettingsInputSchema.safeParse({ settings: { iban: "CH9300762011623852957" } }).success, false);
  assert.equal(forms.generalSettingsInputSchema.safeParse({ settings: { invitationDays: 14, exitNoticeMonths: 6 } }).success, true);
  // und umgekehrt
  assert.equal(forms.financeSettingsInputSchema.safeParse({ settings: { invitationDays: 14 } }).success, false);
  const ok = forms.financeSettingsInputSchema.safeParse({ settings: { iban: "CH93 0076 2011 6238 5295 7", paymentDays: 30, reminderFee1Rappen: null } });
  assert.equal(ok.success, true);
  if (ok.success) assert.equal(ok.data.settings.iban, "CH9300762011623852957", "IBAN wird normalisiert");
  // falsche Prüfziffer
  assert.equal(forms.financeSettingsInputSchema.safeParse({ settings: { iban: "CH9400762011623852957" } }).success, false);
  // Tage nur ganzzahlig im erlaubten Bereich
  assert.equal(forms.financeSettingsInputSchema.safeParse({ settings: { paymentDays: 400 } }).success, false);
  assert.equal(forms.generalSettingsInputSchema.safeParse({ settings: { fiscalStartDay: 29 } }).success, false);
  // unbekannte oberste Schlüssel
  assert.equal(forms.generalSettingsInputSchema.safeParse({ extra: 1 }).success, false);
});

test("Vereinsstammdaten: UID mit Prüfziffer, Normalisierung, Schema", () => {
  assert.equal(profile.normalizeUid("che109322551"), "CHE-109.322.551");
  assert.equal(profile.normalizeUid("CHE-109.322.551"), "CHE-109.322.551");
  assert.equal(profile.normalizeUid("109.322.551"), null);
  assert.equal(profile.isValidUid("CHE-109.322.551"), true);
  assert.equal(profile.isValidUid("CHE-109.322.552"), false);
  assert.equal(profile.isValidUid("CHE-123"), false);

  const ok = profile.vereinProfileSchema.safeParse({ name: " Verein ", seat: "", foundedOn: "2026-09-05", purpose: "", uid: "che109322551", register: "" });
  assert.equal(ok.success, true);
  if (ok.success) {
    assert.equal(ok.data.name, "Verein");
    assert.equal(ok.data.uid, "CHE-109.322.551");
  }
  assert.equal(profile.vereinProfileSchema.safeParse({ ...profile.DEFAULT_PROFILE, foundedOn: "2026-02-31" }).success, false);
  assert.equal(profile.vereinProfileSchema.safeParse({ ...profile.DEFAULT_PROFILE, uid: "CHE-109.322.552" }).success, false);

  // Lesen/Schreiben
  const raw = { "verein.profile.seat": "Heiden", "verein.profile.uid": "ungültig", "verein.other": "x" };
  const parsed = profile.parseVereinProfile(raw);
  assert.equal(parsed.seat, "Heiden");
  assert.equal(parsed.uid, "", "ungültige Werte fallen auf die Voreinstellung zurück");
  assert.deepEqual(profile.serializeVereinProfile({ seat: "Heiden", purpose: "" }), { "verein.profile.seat": "Heiden", "verein.profile.purpose": null });
  assert.equal(profile.profileDisplayName({ name: "  " }, "VylarisGroup"), "VylarisGroup");
  assert.equal(profile.profileDisplayName({ name: "Mein Verein" }, "VylarisGroup"), "Mein Verein");
});

// ---- Änderungsprotokoll --------------------------------------------------------------------------------------------------------

test("Protokoll: Bezeichnungen der Aktionen und Objekte", () => {
  assert.equal(auditView.auditActionLabel("settings.update"), "Einstellungen geändert");
  assert.equal(auditView.auditActionLabel("role.change"), "Rolle geändert");
  assert.equal(auditView.auditActionLabel("member.update"), "Mitglied: geändert");
  assert.equal(auditView.auditActionLabel("invoice.cancel"), "Rechnung: storniert");
  assert.equal(auditView.auditActionLabel("export.members"), "Mitgliederliste exportiert");
  assert.equal(auditView.auditActionLabel("unbekannt.etwas"), "unbekannt.etwas");
  assert.equal(auditView.auditActionLabel("ohnepunkt"), "ohnepunkt");
  assert.equal(auditView.auditObjectLabel("Invoice"), "Rechnung");
  assert.equal(auditView.auditObjectLabel("Neu"), "Neu");
});

test("Protokoll: Vorher/Nachher lesbar, Beträge und Daten in Schweizer Schreibweise", () => {
  const before = JSON.stringify({ paymentDays: 30, reminderFee1Rappen: 1000, applyEnabled: false, foundedOn: "", dueDate: "2026-11-05T12:00:00.000Z" });
  const after = JSON.stringify({ paymentDays: 20, reminderFee1Rappen: 123450, applyEnabled: true, foundedOn: "2026-09-05", dueDate: "2026-11-06T12:00:00.000Z" });
  const changes = auditView.auditChanges(before, after);
  const by = Object.fromEntries(changes.map((c) => [c.field, c]));
  assert.equal(by.paymentDays!.label, "Zahlungsfrist (Tage)");
  assert.equal(by.paymentDays!.before, "30");
  assert.equal(by.paymentDays!.after, "20");
  assert.equal(by.reminderFee1Rappen!.before, "CHF 10.00");
  assert.equal(by.reminderFee1Rappen!.after, "CHF 1’234.50");
  assert.equal(by.applyEnabled!.before, "nein");
  assert.equal(by.applyEnabled!.after, "ja");
  assert.equal(by.foundedOn!.before, "–");
  assert.equal(by.dueDate!.before, "5.11.2026");
  assert.deepEqual(auditView.auditChanges(null, null), []);
  assert.deepEqual(auditView.auditChanges("kein json", "[1,2]"), [], "ungültige oder keine Objekte ergeben keine Felder");
  assert.equal(auditView.formatAuditValue("x", { a: 1 }), '{"a":1}');
  assert.equal(auditView.formatAuditValue("x", null), "–");
});

// ---- Zugänge und Rollen ----------------------------------------------------------------------------------------------------------

const acc = (id: string, role: string, extraRoles = "") => ({ id, role, extraRoles });

test("Zugänge: letzter Zugang mit vollem Zugriff bleibt bestehen", () => {
  const owner = { id: "o", roles: ["OWNER"] as const };
  const accounts = [acc("o", "OWNER"), acc("k", "KASSIER")];
  // Den einzigen Inhaber löschen (durch einen anderen Inhaber nicht möglich, da es nur einen gibt): eigene Löschung wird zuerst abgefangen
  assert.match(access.checkAccessChange({ actor: owner, target: acc("o", "OWNER"), next: null, accounts })!, /eigenen Zugang/);

  // Ein Administrator will den letzten Inhaber herabstufen -> nicht erlaubt (nur Inhaber ändern Inhaber)
  const admin = { id: "a", roles: ["ADMIN"] as const };
  assert.match(access.checkAccessChange({ actor: admin, target: acc("o", "OWNER"), next: { role: "KASSIER", extraRoles: [] }, accounts: [...accounts, acc("a", "ADMIN")] })!, /Inhaber/);

  // Zweiter Administrator: den ersten herabstufen ist erlaubt, den letzten nicht
  const two = [acc("a", "ADMIN"), acc("b", "ADMIN"), acc("k", "KASSIER")];
  assert.equal(access.checkAccessChange({ actor: admin, target: acc("b", "ADMIN"), next: { role: "KASSIER", extraRoles: [] }, accounts: two }), null);
  const lastAdmin = { id: "k2", roles: ["OWNER"] as const };
  const onlyOne = [acc("b", "ADMIN"), acc("k", "KASSIER")];
  assert.match(access.checkAccessChange({ actor: lastAdmin, target: acc("b", "ADMIN"), next: { role: "KASSIER", extraRoles: [] }, accounts: onlyOne })!, /mindestens ein Zugang/);
  assert.match(access.checkAccessChange({ actor: lastAdmin, target: acc("b", "ADMIN"), next: null, accounts: onlyOne })!, /letzte/);
  // Zusatzrolle ADMIN genügt als Vollzugriff
  assert.equal(access.checkAccessChange({ actor: lastAdmin, target: acc("b", "ADMIN"), next: { role: "KASSIER", extraRoles: ["ADMIN"] }, accounts: onlyOne }), null);
});

test("Zugänge: eigene Rollen nicht änderbar, Inhaber nur durch Inhaber", () => {
  const admin = { id: "a", roles: ["ADMIN"] as const };
  const accounts = [acc("a", "ADMIN"), acc("b", "ADMIN"), acc("k", "KASSIER")];
  // eigene Rolle herabstufen
  assert.match(access.checkAccessChange({ actor: admin, target: acc("a", "ADMIN"), next: { role: "KASSIER", extraRoles: [] }, accounts })!, /eigenen Rollen/);
  // eigene Rollen unverändert lassen (z. B. nur Name ändern) ist erlaubt
  assert.equal(access.checkAccessChange({ actor: admin, target: acc("a", "ADMIN"), next: { role: "ADMIN", extraRoles: [] }, accounts }), null);
  // eigene Rolle unabhängig von der Reihenfolge der Zusatzrollen
  assert.equal(access.checkAccessChange({ actor: { id: "x", roles: ["ADMIN", "KASSIER"] }, target: acc("x", "ADMIN", "KASSIER"), next: { role: "KASSIER", extraRoles: ["ADMIN"] }, accounts: [acc("x", "ADMIN", "KASSIER"), acc("b", "ADMIN")] }), null);
  // Administrator vergibt keine Inhaber-Rolle
  assert.match(access.checkAccessChange({ actor: admin, target: null, next: { role: "OWNER", extraRoles: [] }, accounts })!, /Inhaber/);
  assert.match(access.checkAccessChange({ actor: admin, target: acc("k", "KASSIER"), next: { role: "KASSIER", extraRoles: ["OWNER"] }, accounts })!, /Inhaber/);
  // Inhaber darf
  assert.equal(access.checkAccessChange({ actor: { id: "o", roles: ["OWNER"] }, target: null, next: { role: "OWNER", extraRoles: [] }, accounts }), null);
  // neuer Zugang mit normaler Rolle
  assert.equal(access.checkAccessChange({ actor: admin, target: null, next: { role: "REVISOR", extraRoles: [] }, accounts }), null);
  // ungültige Rolle
  assert.match(access.checkAccessChange({ actor: admin, target: null, next: { role: "CHEF", extraRoles: [] }, accounts })!, /gültige Rolle/);
  // Passwort anderer: Inhaber nur durch Inhaber
  assert.equal(access.canTouchAccount(admin, acc("o", "OWNER")), false);
  assert.equal(access.canTouchAccount(admin, acc("k", "KASSIER")), true);
  assert.equal(access.canTouchAccount({ id: "o", roles: ["OWNER"] }, acc("o2", "OWNER")), true);
});

test("Zugänge: Rollen speichern und Amt-Vorschläge", () => {
  assert.deepEqual(access.storedRoles({ role: "vizepraesident", extraRoles: ["KASSIER", "VIZEPRAESIDENT", "KASSIER", "UNSINN"] }), { role: "VIZEPRAESIDENT", extraRoles: "KASSIER" });
  assert.equal(access.roleNames(["KASSIER", "ADMIN"]), "Kassier/in, Administrator");
  assert.deepEqual(access.suggestRolesFromOffices(["KASSIER", "BEISITZ", "AKTUAR"], ["PRAESIDENT"]), ["KASSIER", "AKTUAR"]);
  assert.deepEqual(access.suggestRolesFromOffices(["KASSIER"], ["KASSIER"]), []);
  assert.deepEqual(access.suggestRolesFromOffices(["KASSIER"], ["ADMIN"]), [], "wer vollen Zugriff hat, braucht keinen Vorschlag");
  assert.deepEqual(access.suggestRolesFromOffices(["BEISITZ", "SONSTIGES"], []), []);
});

test("Zugänge: Startpasswort hat Form und Zeichenklassen", () => {
  for (let i = 0; i < 50; i++) {
    const pw = access.generateTempPassword();
    assert.match(pw, /^[A-Za-z0-9]{4}(-[A-Za-z0-9]{4}){3}$/);
    const plain = pw.replace(/-/g, "");
    assert.match(plain, /[A-Z]/);
    assert.match(plain, /[a-z]/);
    assert.match(plain, /[0-9]/);
    assert.doesNotMatch(plain, /[0OolI1]/, "keine verwechselbaren Zeichen");
  }
  assert.notEqual(access.generateTempPassword(), access.generateTempPassword());
  // deterministische Zufallsquelle
  let n = 0;
  const fixed = access.generateTempPassword((max) => n++ % max);
  assert.equal(fixed.length, 19);
});

test("Zugänge: Eingaben werden geprüft", () => {
  const ok = accessSchemas.accessCreateSchema.safeParse({ email: " Neu@Beispiel.ch ", name: "Anna Muster", role: "KASSIER" });
  assert.equal(ok.success, true);
  if (ok.success) {
    assert.equal(ok.data.email, "neu@beispiel.ch");
    assert.deepEqual(ok.data.extraRoles, []);
    assert.equal(ok.data.memberId, null);
  }
  assert.equal(accessSchemas.accessCreateSchema.safeParse({ email: "kaputt", name: "Anna", role: "KASSIER" }).success, false);
  assert.equal(accessSchemas.accessCreateSchema.safeParse({ email: "a@b.ch", name: "Anna", role: "CHEF" }).success, false);
  assert.equal(accessSchemas.accessCreateSchema.safeParse({ email: "a@b.ch", name: "A", role: "KASSIER" }).success, false);
  assert.equal(accessSchemas.accessPatchSchema.partial().safeParse({ extraRoles: ["REVISOR", "X"] }).success, false);
});

// ---- Mitgliederausweis ---------------------------------------------------------------------------------------------------------

const SECRET = "ein-geheimnis-fuer-den-test-mindestens-32-zeichen";

test("Ausweis: Token signieren, prüfen, Fälschungen ablehnen", () => {
  const token = card.signCardToken(SECRET, "cm1abc2def");
  assert.match(token, /^cm1abc2def\.[A-Za-z0-9_-]{43}$/);
  assert.equal(card.verifyCardToken(SECRET, token), "cm1abc2def");
  assert.equal(card.verifyCardToken("anderes-geheimnis", token), null);
  assert.equal(card.verifyCardToken(SECRET, token.replace("cm1abc2def", "cm1abc2deg")), null, "fremde Mitglieds-ID mit alter Signatur");
  assert.equal(card.verifyCardToken(SECRET, token.slice(0, -1) + (token.endsWith("A") ? "B" : "A")), null);
  assert.equal(card.verifyCardToken(SECRET, "nur-eine-id"), null);
  assert.equal(card.verifyCardToken(SECRET, `${token}.zusatz`), null);
  assert.equal(card.verifyCardToken(SECRET, ""), null);
  assert.equal(card.verifyCardToken(SECRET, "x".repeat(500)), null);
  assert.throws(() => card.signCardToken(SECRET, "ungültige id!"));
  // enthält keine Personendaten ausser der internen ID
  assert.doesNotMatch(token, /@|\s/);
});

test("Ausweis: Anzeigename auf der Prüfseite", () => {
  assert.equal(card.shortDisplayName("Anna", "Müller"), "Anna M.");
  assert.equal(card.shortDisplayName("  Anna ", " öztürk"), "Anna Ö.");
  assert.equal(card.shortDisplayName("Anna", ""), "Anna");
  assert.equal(card.shortDisplayName("", "Meier"), "M.");
});

test("Ausweis: Gültigkeit nur für aktive, nicht anonymisierte Mitglieder", () => {
  const now = d(2026, 11, 5);
  const base = { status: "AKTIV", joinedAt: d(2025, 3, 1), leftAt: null, exitNoticeAt: null, anonymizedAt: null };
  assert.deepEqual(card.cardValidity(base, now), { valid: true, text: "Gültig, solange die Mitgliedschaft besteht" });
  assert.deepEqual(card.cardValidity({ ...base, exitNoticeAt: d(2026, 5, 1), leftAt: d(2026, 12, 31) }, now), { valid: true, text: "Gültig bis 31.12.2026" });
  assert.equal(card.cardValidity({ ...base, exitNoticeAt: d(2026, 5, 1), leftAt: d(2026, 11, 5) }, now).valid, true, "am Austrittstag noch gültig");
  assert.equal(card.cardValidity({ ...base, exitNoticeAt: d(2025, 5, 1), leftAt: d(2025, 12, 31) }, now).valid, false, "Austrittstag überschritten");
  for (const status of ["ANTRAG", "ABGELEHNT", "AUSGETRETEN", "AUSGESCHLOSSEN", "VERSTORBEN"]) assert.equal(card.cardValidity({ ...base, status }, now).valid, false, status);
  assert.equal(card.cardValidity({ ...base, anonymizedAt: now }, now).valid, false);
  assert.equal(card.memberSinceText(d(2025, 3, 1)), "Mitglied seit 1.3.2025");
  assert.equal(card.memberSinceText(null), "");
});

test("Ausweis: QR-Code als Pfad", () => {
  const shape = card.qrShape("https://vylaris.ch/verein/pruefen/abc.def");
  assert.ok(shape.modules >= 21);
  assert.match(shape.pathD, /^M\d+ \d+h\d+v1h-\d+z/);
  assert.doesNotMatch(shape.pathD, /[<>"]/);
});

// ---- Newsletter-Segmente -----------------------------------------------------------------------------------------------------------

test("Newsletter-Segmente: Auswahl bereinigen", () => {
  assert.deepEqual(segment.normalizeSegment(undefined, undefined), { segment: "ALL", segmentTypeId: null });
  assert.deepEqual(segment.normalizeSegment("unsinn", "x"), { segment: "ALL", segmentTypeId: null });
  assert.deepEqual(segment.normalizeSegment("MEMBERS", "typ1"), { segment: "MEMBERS", segmentTypeId: null }, "die Art gilt nur beim passenden Segment");
  assert.deepEqual(segment.normalizeSegment("MEMBERSHIP_TYPE", " typ1 "), { segment: "MEMBERSHIP_TYPE", segmentTypeId: "typ1" });
  const missing = segment.normalizeSegment("MEMBERSHIP_TYPE", "");
  assert.equal(missing.segment, "MEMBERSHIP_TYPE");
  assert.match(missing.error ?? "", /Mitgliedschaftsart/);
  assert.equal(segment.segmentLabel("ALL"), "Alle Abonnenten");
  assert.equal(segment.segmentLabel("MEMBERS"), "Aktive Mitglieder");
  assert.equal(segment.segmentLabel("MEMBERSHIP_TYPE", "Aktivmitglied"), "Mitglieder: Aktivmitglied");
  assert.equal(segment.segmentLabel("MEMBERSHIP_TYPE"), "Mitglieder einer Mitgliedschaftsart");
  assert.equal(segment.segmentLabel("kaputt"), "Alle Abonnenten");
});

test("Newsletter-Segmente: Abgleich Abonnent und Mitglied über die E-Mail", () => {
  const subs = [
    { id: "1", email: "anna@beispiel.ch" },
    { id: "2", email: "bruno@beispiel.ch" },
    { id: "3", email: "claire@beispiel.ch" },
  ];
  const matched = segment.matchSubscribersToMembers(subs, [" Anna@Beispiel.ch ", "CLAIRE@beispiel.ch", "", "fremd@beispiel.ch"]);
  assert.deepEqual(matched.map((s) => s.id), ["1", "3"]);
  assert.deepEqual(segment.matchSubscribersToMembers(subs, []), []);
  assert.deepEqual(segment.matchSubscribersToMembers([], ["a@b.ch"]), []);
  assert.deepEqual(segment.chunk([1, 2, 3, 4, 5], 2), [[1, 2], [3, 4], [5]]);
  assert.deepEqual(segment.chunk([], 3), []);
});

test("Kampagne: Empfängerkreis im Schema, Vorgabe alle Abonnenten", () => {
  const base = { subject: "Neuigkeiten", content: "Hallo zusammen, das ist der Inhalt." };
  const r = validation.campaignSchema.safeParse(base);
  assert.equal(r.success, true);
  if (r.success) {
    assert.equal(r.data.segment, "ALL");
    assert.equal(r.data.segmentTypeId, null);
  }
  assert.equal(validation.campaignSchema.safeParse({ ...base, segment: "MEMBERS" }).success, true);
  assert.equal(validation.campaignSchema.safeParse({ ...base, segment: "MEMBERSHIP_TYPE", segmentTypeId: "abc123" }).success, true);
  assert.equal(validation.campaignSchema.safeParse({ ...base, segment: "ALLE" }).success, false);
  assert.equal(validation.campaignSchema.safeParse({ ...base, segmentTypeId: "../x" }).success, false);
});
