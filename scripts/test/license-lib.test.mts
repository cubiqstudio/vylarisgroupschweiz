// Tests für die reinen Funktionen aus src/lib/licenses.ts (ohne Server, ohne Datenbank).
// Aufruf:  npx tsx scripts/test/license-lib.test.mts
// "server-only" wirft beim Import außerhalb von Next.js; es wird deshalb vor dem Import durch ein leeres Modul ersetzt.
// Der Prisma-Client wird beim Import nur angelegt, aber nie verbunden – es findet kein Datenbankzugriff statt.
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { test } from "node:test";

const require = createRequire(import.meta.url);
const serverOnlyPath = require.resolve("server-only");
require.cache[serverOnlyPath] = {
  id: serverOnlyPath,
  filename: serverOnlyPath,
  loaded: true,
  exports: {},
  children: [],
  paths: [],
} as unknown as NodeJS.Module;

process.env.AUTH_SECRET = "test-secret-test-secret-test-secret-0001";

const {
  generateKey,
  normalizeKey,
  hashKey,
  keyHint,
  signVerifyResponse,
  signingKeyFor,
  eligibilityFor,
} = await import("../../src/lib/licenses.ts");

const FORMAT = /^VG-[A-Z]{3,4}-[A-HJ-NP-Z2-9]{5}(-[A-HJ-NP-Z2-9]{5}){3}$/;

/** Führt fn mit einem anderen AUTH_SECRET aus und stellt den alten Wert wieder her. */
function withSecret<T>(secret: string, fn: () => T): T {
  const old = process.env.AUTH_SECRET;
  process.env.AUTH_SECRET = secret;
  try {
    return fn();
  } finally {
    process.env.AUTH_SECRET = old;
  }
}

test("generateKey: Format und Produktcode", () => {
  for (const code of ["WEB", "AIN", "abcd"]) {
    const k = generateKey(code);
    assert.match(k, FORMAT);
    assert.ok(k.startsWith(`VG-${code.toUpperCase()}-`));
  }
  // VG- + Code + 4 Gruppen à 5 Zeichen = 20 Zeichen Zufall (je 5 Bit = 100 Bit)
  assert.equal(
    generateKey("WEB")
      .replace(/^VG-WEB-/, "")
      .replace(/-/g, "").length,
    20,
  );
});

test("generateKey: 10 000 Schlüssel ohne Duplikate, keine verwechselbaren Zeichen", () => {
  const seen = new Set<string>();
  for (let i = 0; i < 10_000; i++) {
    const k = generateKey("WEB");
    assert.ok(!seen.has(k), `Duplikat: ${k}`);
    seen.add(k);
    assert.ok(!/[IO01]/.test(k.slice(7)), `verwechselbares Zeichen in ${k}`);
  }
  assert.equal(seen.size, 10_000);
});

test("normalizeKey: Leerzeichen und Kleinbuchstaben werden vereinheitlicht", () => {
  const k = generateKey("AIN");
  assert.equal(normalizeKey(k), k);
  assert.equal(normalizeKey(k.toLowerCase()), k);
  assert.equal(normalizeKey(`  ${k.replace(/-/g, " - ")}  `), k);
  assert.equal(normalizeKey(`\t${k}\n`), k);
});

test("normalizeKey: ungültige Formate werden abgelehnt", () => {
  const k = generateKey("WEB");
  const bad: unknown[] = [
    "",
    "   ",
    "VG-WEB",
    "XX-WEB-AAAAA-AAAAA-AAAAA-AAAAA",
    "VG-WE-AAAAA-AAAAA-AAAAA-AAAAA", // Code zu kurz
    "VG-WEBSP-AAAAA-AAAAA-AAAAA-AAAAA", // Code zu lang
    "VG-WEB-AAAAA-AAAAA-AAAAA", // Gruppe fehlt
    "VG-WEB-AAAAA-AAAAA-AAAAA-AAAAA-AAAAA", // Gruppe zu viel
    "VG-WEB-AAAAA-AAAAA-AAAAA-AAAA", // Gruppe zu kurz
    "VG-WEB-AAAAA-AAAAA-AAAAA-AAAAAA", // Gruppe zu lang
    "VG-WEB-AAAAI-AAAAA-AAAAA-AAAAA", // I nicht im Alphabet
    "VG-WEB-AAAAO-AAAAA-AAAAA-AAAAA", // O nicht im Alphabet
    "VG-WEB-AAAA0-AAAAA-AAAAA-AAAAA", // 0 nicht im Alphabet
    "VG-WEB-AAAA1-AAAAA-AAAAA-AAAAA", // 1 nicht im Alphabet
    `${k}${"A".repeat(60)}`, // zu lang
    `${k}'; DROP TABLE users;--`,
    null,
    undefined,
    42,
    {},
    [k],
  ];
  for (const b of bad)
    assert.equal(
      normalizeKey(b),
      null,
      `sollte abgelehnt werden: ${JSON.stringify(b)}`,
    );
});

test("hashKey: deterministisch, hex, ohne Klartext", () => {
  const k = generateKey("WEB");
  const h = hashKey(k);
  assert.match(h, /^[0-9a-f]{64}$/);
  assert.equal(hashKey(k), h);
  assert.notEqual(hashKey(generateKey("WEB")), h);
  assert.ok(!h.includes(k));
});

test("hashKey und signingKeyFor hängen von AUTH_SECRET ab", () => {
  const k = generateKey("WEB");
  const h1 = hashKey(k);
  const s1 = signingKeyFor("client-1");
  const h2 = withSecret("ein-ganz-anderes-secret-ein-ganz-anderes-0002", () =>
    hashKey(k),
  );
  const s2 = withSecret("ein-ganz-anderes-secret-ein-ganz-anderes-0002", () =>
    signingKeyFor("client-1"),
  );
  assert.notEqual(h1, h2);
  assert.notEqual(s1, s2);
  // Zurück beim ursprünglichen Secret ergibt sich wieder derselbe Wert.
  assert.equal(hashKey(k), h1);
  assert.equal(signingKeyFor("client-1"), s1);
});

test("signingKeyFor: je Zugang verschieden, deterministisch, hex", () => {
  assert.match(signingKeyFor("a"), /^[0-9a-f]{64}$/);
  assert.equal(signingKeyFor("a"), signingKeyFor("a"));
  assert.notEqual(signingKeyFor("a"), signingKeyFor("b"));
});

test("keyHint: letzte vier Zeichen ohne Bindestriche", () => {
  assert.equal(keyHint("VG-WEB-ABCDE-FGHJK-LMNPQ-RSTUV"), "STUV");
  const k = generateKey("AIN");
  const hint = keyHint(k);
  assert.equal(hint.length, 4);
  assert.ok(k.endsWith(hint));
});

const base = {
  valid: true,
  reason: null as string | null,
  product: "webspace",
  status: "ACTIVE" as string | null,
  instance: "example.org" as string | null,
  nonce: "abcdefgh12345678",
  ts: 1_700_000_000,
};

test("signVerifyResponse: Signatur ist deterministisch und entspricht der dokumentierten Formel", async () => {
  const { createHmac } = await import("node:crypto");
  const sig = signVerifyResponse("client-1", base);
  assert.match(sig, /^[0-9a-f]{64}$/);
  assert.equal(signVerifyResponse("client-1", base), sig);
  const payload = [
    "1",
    "",
    "webspace",
    "ACTIVE",
    "example.org",
    "abcdefgh12345678",
    "1700000000",
  ].join("|");
  assert.equal(
    sig,
    createHmac("sha256", signingKeyFor("client-1"))
      .update(payload)
      .digest("hex"),
  );
  // Ungültige Antwort mit Grund und ohne Installation/Status
  const inv = {
    ...base,
    valid: false,
    reason: "invalid",
    status: null,
    instance: null,
  };
  const payload2 = [
    "0",
    "invalid",
    "webspace",
    "",
    "",
    "abcdefgh12345678",
    "1700000000",
  ].join("|");
  assert.equal(
    signVerifyResponse("client-1", inv),
    createHmac("sha256", signingKeyFor("client-1"))
      .update(payload2)
      .digest("hex"),
  );
});

test("signVerifyResponse: jede Änderung eines Feldes ändert die Signatur", () => {
  const sig = signVerifyResponse("client-1", base);
  const variants: Array<[string, typeof base]> = [
    ["valid", { ...base, valid: false }],
    ["reason", { ...base, reason: "revoked" }],
    ["product", { ...base, product: "autoinstaller" }],
    ["status", { ...base, status: "REVOKED" }],
    ["status null", { ...base, status: null }],
    ["instance", { ...base, instance: "other.org" }],
    ["instance null", { ...base, instance: null }],
    ["nonce", { ...base, nonce: "abcdefgh12345679" }],
    ["ts", { ...base, ts: base.ts + 1 }],
  ];
  const all = new Set([sig]);
  for (const [name, v] of variants) {
    const s = signVerifyResponse("client-1", v);
    assert.notEqual(s, sig, `Feld ${name} geht nicht in die Signatur ein`);
    all.add(s);
  }
  assert.equal(
    all.size,
    variants.length + 1,
    "Signaturen sollten alle verschieden sein",
  );
  // Anderer Zugang und anderes AUTH_SECRET ergeben ebenfalls eine andere Signatur.
  assert.notEqual(signVerifyResponse("client-2", base), sig);
  assert.notEqual(
    withSecret("ein-ganz-anderes-secret-ein-ganz-anderes-0002", () =>
      signVerifyResponse("client-1", base),
    ),
    sig,
  );
});

test("eligibilityFor: Matrix aus active, businessOnly, allowAccountRequest, businessStatus", () => {
  type P = Parameters<typeof eligibilityFor>[0];
  const prod = (o: Partial<P>): P => ({
    active: true,
    businessOnly: false,
    allowAccountRequest: false,
    approvalMode: "AUTO",
    ...o,
  });

  // Inaktiv: nie möglich, unabhängig vom Rest
  for (const businessStatus of ["NONE", "PENDING", "APPROVED", "REJECTED"]) {
    for (const businessOnly of [false, true]) {
      for (const allowAccountRequest of [false, true]) {
        assert.deepEqual(
          eligibilityFor(
            prod({ active: false, businessOnly, allowAccountRequest }),
            { businessStatus },
          ),
          { mode: "none", reason: "inactive" },
        );
      }
    }
  }

  // Nicht nur für Firmenkunden: jeder bekommt einen Schlüssel, Modus folgt approvalMode
  for (const businessStatus of ["NONE", "PENDING", "APPROVED", "REJECTED"]) {
    assert.deepEqual(eligibilityFor(prod({}), { businessStatus }), {
      mode: "key",
      approval: "AUTO",
    });
    assert.deepEqual(
      eligibilityFor(prod({ approvalMode: "MANUAL" }), { businessStatus }),
      { mode: "key", approval: "MANUAL" },
    );
    assert.deepEqual(
      eligibilityFor(prod({ allowAccountRequest: true }), { businessStatus }),
      { mode: "key", approval: "AUTO" },
    );
  }

  // Nur Firmenkunden, freigegebener Firmenkunde: Schlüssel
  for (const allowAccountRequest of [false, true]) {
    assert.deepEqual(
      eligibilityFor(prod({ businessOnly: true, allowAccountRequest }), {
        businessStatus: "APPROVED",
      }),
      { mode: "key", approval: "AUTO" },
    );
    assert.deepEqual(
      eligibilityFor(
        prod({
          businessOnly: true,
          allowAccountRequest,
          approvalMode: "MANUAL",
        }),
        { businessStatus: "APPROVED" },
      ),
      { mode: "key", approval: "MANUAL" },
    );
  }

  // Nur Firmenkunden, kein Firmenkunde: Konto beantragen oder nichts
  for (const businessStatus of ["NONE", "PENDING", "REJECTED"]) {
    assert.deepEqual(
      eligibilityFor(prod({ businessOnly: true, allowAccountRequest: true }), {
        businessStatus,
      }),
      { mode: "account" },
    );
    assert.deepEqual(
      eligibilityFor(prod({ businessOnly: true, allowAccountRequest: false }), {
        businessStatus,
      }),
      { mode: "none", reason: "business_only" },
    );
  }

  // Unbekannter approvalMode wird wie AUTO behandelt (nur "MANUAL" ist manuell)
  assert.deepEqual(
    eligibilityFor(prod({ approvalMode: "irgendwas" }), {
      businessStatus: "NONE",
    }),
    { mode: "key", approval: "AUTO" },
  );
});
