// Tests für die Anzeige-Schalter von Impressum und Datenschutzerklärung (reine Logik, ohne Server und Datenbank).
// Aufruf:  npx tsx scripts/test/legal-settings.test.mts
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

const t = await import("../../src/lib/legal-toggles.ts");
const { legalSettingsSchema } = await import("../../src/lib/validation.ts");

const EMPTY: import("../../src/lib/legal-toggles.ts").LegalContent = {
  street: "",
  zipCity: "",
  country: "",
  phone: "",
  register: "",
  vatId: "",
  email: "",
  smallBusiness: false,
  noRegister: false,
  boardCount: 3,
};
const FILLED = { ...EMPTY, street: "Schützengasse 13", zipCity: "9410 Heiden (AR)", country: "Schweiz", phone: "+41 78 322 21 39", email: "support@vylaris.ch" };

// ---- Definitionen -------------------------------------------------------------------------------------------------------
test("Schalter: Schlüssel sind eindeutig und vollständig", () => {
  assert.equal(new Set(t.IMPRINT_KEYS).size, t.IMPRINT_KEYS.length);
  assert.equal(new Set(t.PRIVACY_KEYS).size, t.PRIVACY_KEYS.length);
  for (const k of ["name", "address", "board", "email", "phone", "contactForm", "register", "vat", "liabilityContent", "liabilityLinks", "copyright", "privacyLink"]) {
    assert.ok((t.IMPRINT_KEYS as string[]).includes(k), `Impressum-Schalter ${k}`);
  }
  for (const k of ["konto", "kontakt", "newsletter", "lizenzen", "links", "tunnel", "cookies", "mitglieder", "beitraege", "versammlungen", "anlaesse", "dokumente", "ausweis", "tuerkontrolle", "audit"]) {
    assert.ok((t.PRIVACY_KEYS as string[]).includes(k), `Datenschutz-Schalter ${k}`);
  }
  // Grundabschnitte sind nicht schaltbar
  for (const k of ["verantwortlicher", "rechte", "aufbewahrung", "empfaenger"]) assert.ok(!(t.PRIVACY_KEYS as string[]).includes(k));
  assert.ok(t.PRIVACY_ALWAYS.includes("Deine Rechte"));
  // Jeder Impressum-Schalter gehört genau einem Abschnitt an
  const inSections = t.IMPRINT_SECTIONS.flatMap((s) => [...s.keys]);
  assert.deepEqual([...inSections].sort(), [...t.IMPRINT_KEYS].sort());
});

test("Schalter: Speicherschlüssel", () => {
  assert.equal(t.imprintSettingKey("email"), "legal.show.email");
  assert.equal(t.privacySettingKey("newsletter"), "legal.show.privacy.newsletter");
});

// ---- Auflösung der Schalter ------------------------------------------------------------------------------------------------
test("resolveShow: Vorgabe = angezeigt, ausser das Feld ist leer", () => {
  const { imprint, privacy } = t.resolveShow({}, EMPTY);
  assert.equal(imprint.name, true);
  assert.equal(imprint.legalForm, true);
  assert.equal(imprint.liabilityContent, true);
  assert.equal(imprint.contactForm, true);
  for (const k of ["address", "email", "phone", "register", "vat"] as const) assert.equal(imprint[k], false, `${k} ohne Inhalt`);
  for (const k of t.PRIVACY_KEYS) assert.equal(privacy[k], true, `Datenschutz ${k}`);

  const filled = t.resolveShow({}, FILLED).imprint;
  for (const k of ["address", "email", "phone"] as const) assert.equal(filled[k], true, `${k} mit Inhalt`);
  assert.equal(filled.register, false, "Register weiterhin leer");
});

test("resolveShow: Hinweise «nicht eingetragen» / «nicht mehrwertsteuerpflichtig» zählen als Inhalt", () => {
  const { imprint } = t.resolveShow({}, { ...EMPTY, noRegister: true, smallBusiness: true });
  assert.equal(imprint.register, true);
  assert.equal(imprint.vat, true);
});

test("resolveShow: gespeicherte Schalter haben Vorrang", () => {
  const stored = { "legal.show.name": "false", "legal.show.email": "true", "legal.show.privacy.newsletter": "false", "legal.show.privacy.audit": "true" };
  const { imprint, privacy } = t.resolveShow(stored, EMPTY);
  assert.equal(imprint.name, false);
  assert.equal(imprint.email, true, "angehakt, obwohl leer (Warnung im Admin, nichts im Impressum)");
  assert.equal(privacy.newsletter, false);
  assert.equal(privacy.audit, true);
  assert.equal(privacy.konto, true);
});

test("Migration: frühere Häkchen hideRegister / hideVat gehen nicht verloren", () => {
  const filled = { ...FILLED, register: "CHE-000.000.000", vatId: "CHE-000.000.000 MWST" };
  // ohne Altwerte: beides angezeigt
  assert.equal(t.resolveShow({}, filled).imprint.register, true);
  // Altwert «ausblenden» → Schalter aus
  const hidden = t.resolveShow({ "legal.hideRegister": "true", "legal.hideVat": "true" }, filled).imprint;
  assert.equal(hidden.register, false);
  assert.equal(hidden.vat, false);
  // Altwert «false» → Vorgabe
  const shown = t.resolveShow({ "legal.hideRegister": "false", "legal.hideVat": "false" }, filled).imprint;
  assert.equal(shown.register, true);
  assert.equal(shown.vat, true);
  // ein ausdrücklich gespeicherter neuer Schalter schlägt den Altwert
  const explicit = t.resolveShow({ "legal.hideRegister": "true", "legal.show.register": "true" }, filled).imprint;
  assert.equal(explicit.register, true);
  assert.deepEqual(t.LEGACY_SETTING_KEYS.sort(), ["legal.hideRegister", "legal.hideVat"]);
  // Aussagen zum Verein bleiben unabhängig davon (noRegister mit Altwert hideRegister = ausgeblendet)
  const both = t.resolveShow({ "legal.hideRegister": "true" }, { ...FILLED, noRegister: true }).imprint;
  assert.equal(both.register, false);
});

// ---- Sichtbarkeit ----------------------------------------------------------------------------------------------------------
test("visibleImprint: leere Felder erscheinen nie, auch wenn angehakt", () => {
  const show = t.resolveShow({ "legal.show.email": "true", "legal.show.phone": "true", "legal.show.address": "true" }, EMPTY).imprint;
  const visible = t.visibleImprint(show, EMPTY);
  assert.equal(visible.email, false);
  assert.equal(visible.phone, false);
  assert.equal(visible.address, false);
  assert.equal(visible.name, true);
  assert.deepEqual(new Set(t.emptyShownKeys(show, EMPTY)), new Set(["email", "phone", "address"]));
  // mit Inhalt: sichtbar, keine Warnung
  const v2 = t.visibleImprint(show, FILLED);
  assert.equal(v2.email, true);
  assert.deepEqual(t.emptyShownKeys(show, FILLED), []);
  // ausgeschaltet bleibt aus
  const off = t.visibleImprint({ ...show, email: false }, FILLED);
  assert.equal(off.email, false);
});

test("visibleImprint: Vorstand ohne Stammdaten wird nicht angezeigt", () => {
  const show = t.resolveShow({}, { ...FILLED, boardCount: 0 }).imprint;
  assert.equal(show.board, false);
  const unknown = t.resolveShow({}, { ...FILLED, boardCount: undefined }).imprint;
  assert.equal(unknown.board, true);
});

test("imprintSections: Nummerierung und Titel folgen den sichtbaren Elementen", () => {
  const all = t.visibleImprint(t.resolveShow({ "legal.hideRegister": "true" }, { ...FILLED, register: "X", vatId: "Y" }).imprint, { ...FILLED, register: "X", vatId: "Y" });
  const s = t.imprintSections(all);
  assert.deepEqual(
    s.map((x) => x.id),
    ["anbieter", "kontakt", "register", "haftung-inhalte", "haftung-links", "urheberrecht", "datenschutz"],
  );
  assert.deepEqual(
    s.map((x) => x.number),
    [1, 2, 3, 4, 5, 6, 7],
  );
  assert.equal(s[2].title, "Mehrwertsteuer", "Register ausgeblendet → nur Mehrwertsteuer");

  const none = Object.fromEntries(t.IMPRINT_KEYS.map((k) => [k, false])) as import("../../src/lib/legal-toggles.ts").ImprintShow;
  assert.deepEqual(t.imprintSections(none), []);

  const onlyLiability = { ...none, liabilityLinks: true, copyright: true };
  assert.deepEqual(
    t.imprintSections(onlyLiability).map((x) => [x.id, x.number]),
    [
      ["haftung-links", 1],
      ["urheberrecht", 2],
    ],
  );
  const reg = t.imprintSections({ ...none, register: true, vat: true });
  assert.equal(reg[0].title, "Handelsregister und Mehrwertsteuer");
  assert.equal(t.imprintSections({ ...none, register: true })[0].title, "Handelsregister");
});

// ---- Datenschutz: Plan, Verweise, Anker ------------------------------------------------------------------------------------------
test("privacyPlan: Nummern passen sich an, Grundabschnitte bleiben", () => {
  const all = t.resolveShow({}, EMPTY).privacy;
  const full = t.privacyPlan(all);
  assert.equal(full.sections[0].id, "verantwortlicher");
  assert.equal(full.sections.at(-1)?.id, "aenderungen");
  assert.equal(full.disabledAnchors.length, 0);
  assert.equal(full.sections.some((s) => s.id === "tunnel"), false, "tunnel ist ein Absatz, kein Abschnitt");
  assert.deepEqual(
    full.sections.map((s) => s.number),
    full.sections.map((_, i) => i + 1),
  );

  const off = t.privacyPlan({ ...all, newsletter: false, cookies: false, tunnel: false });
  assert.equal(off.numberOf("newsletter"), undefined);
  assert.equal(off.numberOf("cookies"), undefined);
  assert.deepEqual(new Set(off.disabledAnchors), new Set(["newsletter", "cookies"]));
  assert.equal(off.has("tunnel"), false);
  assert.equal(off.has("konto"), true);
  assert.equal(off.sections.length, full.sections.length - 2);
  assert.equal(off.numberOf("rechte"), (full.numberOf("rechte") ?? 0) - 2);
  for (const id of ["verantwortlicher", "rechte", "aufbewahrung", "empfaenger", "ausland", "sicherheit", "aenderungen"]) {
    assert.notEqual(off.numberOf(id), undefined, `${id} bleibt`);
  }

  const allOff = t.privacyPlan(Object.fromEntries(t.PRIVACY_KEYS.map((k) => [k, false])) as import("../../src/lib/legal-toggles.ts").PrivacyShow);
  assert.equal(allOff.sections.length, t.PRIVACY_ALWAYS.length);
});

test("Türkontrolle: eigener Abschnitt, unabhängig vom Ausweis, bei bestehender Konfiguration angezeigt", () => {
  // Bestehende gespeicherte Schalter ohne den neuen Schlüssel bleiben gültig; der neue Abschnitt gilt als angezeigt.
  const stored = { "legal.show.privacy.ausweis": "false", "legal.show.privacy.newsletter": "false" };
  const { privacy } = t.resolveShow(stored, EMPTY);
  assert.equal(privacy.ausweis, false);
  assert.equal(privacy.tuerkontrolle, true);
  const plan = t.privacyPlan(privacy);
  assert.equal(plan.numberOf("ausweis"), undefined);
  assert.notEqual(plan.numberOf("tuerkontrolle"), undefined, "Abschnitt bleibt trotz abgeschaltetem Ausweis");
  assert.equal(plan.sections.find((x) => x.id === "tuerkontrolle")?.title, "Türkontrolle mit der App");
  assert.equal(t.privacyHref(privacy, "tuerkontrolle"), "/datenschutz#tuerkontrolle");
  // Eigener Schalter: ausgeschaltet entfällt nur dieser Abschnitt, ein Hinweis nennt ihn.
  const off = t.resolveShow({ "legal.show.privacy.tuerkontrolle": "false" }, EMPTY).privacy;
  assert.equal(t.privacyPlan(off).numberOf("tuerkontrolle"), undefined);
  assert.notEqual(t.privacyPlan(off).numberOf("ausweis"), undefined);
  assert.equal(t.privacyHref(off, "tuerkontrolle"), "/datenschutz");
  assert.match(t.privacyWarnings(off)[0], /Türkontrolle mit der App/);
  // Er erscheint im Admin (Gruppe «verein») und wird gespeichert und zurückgelesen.
  assert.equal(t.PRIVACY_ITEMS.find((i) => i.key === "tuerkontrolle")?.group, "verein");
  assert.equal(t.privacySettingKey("tuerkontrolle"), "legal.show.privacy.tuerkontrolle");
  assert.equal(t.resolveShow(t.showToSettings({}, { tuerkontrolle: false }), EMPTY).privacy.tuerkontrolle, false);
  assert.deepEqual(legalSettingsSchema.parse({ privacyShow: { tuerkontrolle: false } }).privacyShow, { tuerkontrolle: false });
  // Eine Änderung am Schalter erneuert den Stand der Erklärung.
  const snap = { street: "A", zipCity: "B", country: "Schweiz", email: "x@y.ch", phone: "1", showPhone: true, privacy };
  assert.equal(t.privacyChanged(snap, { ...snap, privacy: off }), true);
});

test("latestPrivacyDate: das spätere von gespeichertem Datum und Datum im Code", () => {
  assert.equal(t.latestPrivacyDate("", "2026-11-07"), "2026-11-07");
  assert.equal(t.latestPrivacyDate(undefined, "2026-11-07"), "2026-11-07");
  assert.equal(t.latestPrivacyDate("2026-11-05", "2026-11-07"), "2026-11-07", "älteres gespeichertes Datum: Code gilt");
  assert.equal(t.latestPrivacyDate("2026-12-01", "2026-11-07"), "2026-12-01", "jüngeres gespeichertes Datum bleibt");
  assert.equal(t.latestPrivacyDate("2026-11-07", "2026-11-07"), "2026-11-07");
  assert.equal(t.latestPrivacyDate("unsinn", "2026-11-07"), "2026-11-07");
  assert.equal(t.latestPrivacyDate("2026-02-30", "2026-11-07"), "2026-11-07");
});

test("formatSectionRefs", () => {
  assert.equal(t.formatSectionRefs([4]), "Abschnitt 4");
  assert.equal(t.formatSectionRefs([5, 6]), "Abschnitte 5 und 6");
  assert.equal(t.formatSectionRefs([5, 6, 7]), "Abschnitte 5 bis 7");
  assert.equal(t.formatSectionRefs([3, 5, 9]), "Abschnitte 3, 5 und 9");
  assert.equal(t.formatSectionRefs([7, undefined, 5, 7]), "Abschnitte 5 und 7");
  assert.equal(t.formatSectionRefs([undefined, undefined]), "");
  assert.equal(t.formatSectionRefs([]), "");
});

test("privacyHref: kein Anker auf abgeschaltete Abschnitte", () => {
  const all = t.resolveShow({}, EMPTY).privacy;
  assert.equal(t.privacyHref(all, "newsletter"), "/datenschutz#newsletter");
  assert.equal(t.privacyHref(all), "/datenschutz");
  const off = { ...all, newsletter: false, cookies: false };
  assert.equal(t.privacyHref(off, "newsletter"), "/datenschutz");
  assert.equal(t.privacyHref(off, "cookies"), "/datenschutz");
  assert.equal(t.privacyHref(off, "rechte"), "/datenschutz#rechte", "Grundabschnitte haben immer ihren Anker");
});

// ---- Speichern -------------------------------------------------------------------------------------------------------------------
test("showToSettings: nur bekannte Schlüssel und Booleans", () => {
  const rec = t.showToSettings({ email: false, name: true, unbekannt: true, phone: undefined }, { newsletter: false, konto: true, evil: false });
  assert.deepEqual(rec, { "legal.show.name": "true", "legal.show.email": "false", "legal.show.privacy.konto": "true", "legal.show.privacy.newsletter": "false" });
  assert.deepEqual(t.showToSettings(undefined, undefined), {});
  // Rundlauf: gespeichert → gelesen
  const all = t.resolveShow(t.showToSettings({ email: false, register: true }, { audit: false }), FILLED);
  assert.equal(all.imprint.email, false);
  assert.equal(all.imprint.register, true);
  assert.equal(all.privacy.audit, false);
});

test("Gruppen: «Alle an» / «Alle aus»", () => {
  const base = t.resolveShow({}, FILLED);
  const off = t.setImprintGroup(base.imprint, "hinweise", false);
  for (const i of t.IMPRINT_ITEMS) assert.equal(off[i.key], i.group === "hinweise" ? false : base.imprint[i.key]);
  const on = t.setImprintGroup(off, "hinweise", true);
  for (const i of t.IMPRINT_ITEMS.filter((x) => x.group === "hinweise")) assert.equal(on[i.key], true);
  const pOff = t.setPrivacyGroup(base.privacy, "verein", false);
  for (const i of t.PRIVACY_ITEMS) assert.equal(pOff[i.key], i.group === "verein" ? false : true);
  const pOn = t.setPrivacyGroup(pOff, "verein", true);
  assert.deepEqual(pOn, base.privacy);
});

// ---- Stand-Datum -----------------------------------------------------------------------------------------------------------------------
test("Stand: ISO-Datum prüfen, heutiges Datum in Zürcher Zeit", () => {
  assert.equal(t.parseIsoDate("2026-11-05"), "2026-11-05");
  assert.equal(t.parseIsoDate("2026-02-30"), "");
  assert.equal(t.parseIsoDate("5.11.2026"), "");
  assert.equal(t.parseIsoDate(""), "");
  assert.equal(t.parseIsoDate(undefined), "");
  assert.equal(t.todayZurich(new Date("2026-11-05T12:00:00Z")), "2026-11-05");
  assert.equal(t.todayZurich(new Date("2026-11-05T23:30:00Z")), "2026-11-06", "Winterzeit: 00:30 am Folgetag");
  assert.equal(t.todayZurich(new Date("2026-07-01T22:30:00Z")), "2026-07-02", "Sommerzeit: 00:30 am Folgetag");
});

test("privacyChanged: Stand nur erneuern, wenn sich die Erklärung ändert", () => {
  const priv = t.resolveShow({}, FILLED).privacy;
  const snap = { street: "A", zipCity: "B", country: "Schweiz", email: "x@y.ch", phone: "1", showPhone: true, privacy: priv };
  assert.equal(t.privacyChanged(snap, { ...snap }), false);
  assert.equal(t.privacyChanged(snap, { ...snap, email: "z@y.ch" }), true);
  assert.equal(t.privacyChanged(snap, { ...snap, phone: "2" }), true);
  assert.equal(t.privacyChanged(snap, { ...snap, showPhone: false }), true);
  assert.equal(t.privacyChanged(snap, { ...snap, privacy: { ...priv, newsletter: false } }), true);
});

// ---- Hinweise im Admin -----------------------------------------------------------------------------------------------------------------
test("Warnungen: UWG Art. 3 Abs. 1 lit. s und Art. 19 revDSG, nicht blockierend", () => {
  const ok = t.visibleImprint(t.resolveShow({}, FILLED).imprint, FILLED);
  assert.deepEqual(t.imprintWarnings(ok), []);

  const noEmail = t.visibleImprint(t.resolveShow({ "legal.show.email": "false", "legal.show.name": "false" }, FILLED).imprint, FILLED);
  const w = t.imprintWarnings(noEmail);
  assert.equal(w.length, 1);
  assert.match(w[0], /Art\. 3 Abs\. 1 lit\. s UWG/);
  assert.match(w[0], /Vereinsname/);
  assert.match(w[0], /E-Mail-Adresse/);
  assert.doesNotMatch(w[0], /Anschrift/);

  // leere E-Mail zählt ebenfalls als fehlend
  const empty = t.visibleImprint(t.resolveShow({ "legal.show.email": "true" }, EMPTY).imprint, EMPTY);
  assert.match(t.imprintWarnings(empty)[0], /E-Mail-Adresse/);

  assert.deepEqual(t.privacyWarnings(t.resolveShow({}, FILLED).privacy), []);
  const pw = t.privacyWarnings(t.resolveShow({ "legal.show.privacy.newsletter": "false", "legal.show.privacy.cookies": "false" }, FILLED).privacy);
  assert.equal(pw.length, 1);
  assert.match(pw[0], /Art\. 19 revDSG/);
  assert.match(pw[0], /Newsletter/);
});

// ---- Validierung -------------------------------------------------------------------------------------------------------------------
test("legalSettingsSchema: Schalter, unbekannte Schlüssel und Altfelder", () => {
  const r = legalSettingsSchema.parse({
    street: " Schützengasse 13 ",
    email: "SUPPORT@vylaris.ch",
    show: { email: false, bogus: true },
    privacyShow: { newsletter: false },
    hideRegister: true,
  });
  assert.equal(r.street, "Schützengasse 13");
  assert.equal(r.email, "support@vylaris.ch");
  assert.deepEqual(r.show, { email: false });
  assert.deepEqual(r.privacyShow, { newsletter: false });
  assert.equal("hideRegister" in r, false);
  assert.deepEqual(legalSettingsSchema.parse({}).show, {});
  assert.equal(legalSettingsSchema.safeParse({ show: { email: "ja" } }).success, false);
});

// ---- Wortwahl in den Rechtstexten -----------------------------------------------------------------------------------------------------
test("Rechtstexte und Admin-Formular: keine verbotenen Wörter", () => {
  const root = new URL("../../", import.meta.url).pathname;
  const files = [
    ...readdirSync(join(root, "src/components/legal")).map((f) => join(root, "src/components/legal", f)),
    join(root, "src/lib/legal.ts"),
    join(root, "src/lib/legal-toggles.ts"),
    join(root, "src/i18n/legal.ts"),
    join(root, "src/components/admin/settings/legal-form.tsx"),
  ].filter((f) => statSync(f).isFile());
  assert.ok(files.length >= 7);
  // Die Wörter werden zusammengesetzt, damit sie nirgends im Repository ausgeschrieben stehen.
  const words = [["cla", "ude"], ["anthr", "opic"], ["generiert", " von"], ["Chat", "GPT"], ["künstliche", " Intelligenz"]].map((p) => p.join(""));
  const forbidden = new RegExp(`${words.join("|")}|\\bKI\\b`, "i");
  for (const f of files) assert.doesNotMatch(readFileSync(f, "utf8"), forbidden, f);
});
