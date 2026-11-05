// Prüft, ob alle deutschen API-Meldungen eine englische Übersetzung haben (src/i18n/server-messages.ts).
// Aufruf:  npx tsx scripts/check-api-messages.mts      (Exit-Code 1, wenn Meldungen ohne Übersetzung bleiben)
//
// Quellen:
//  - statische Meldungen in den öffentlichen Routen, src/app/api/_lib und den genannten Hilfsdateien in src/lib
//    (ApiError-/fail()-Aufrufe, benannte Konstanten, notFound("…"), Standardwerte, Texte in validation.ts und mailer.ts),
//  - die tatsächlich entstehenden Zod-Meldungen (eigene und deutsche Standardtexte): alle Schemas aus validation.ts
//    werden mit ungültigen Werten gefüttert.
// Dynamische Meldungen (mit eingesetzten Werten) werden mit Beispielwerten geprüft und müssen über ein Muster treffen.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { translateApiMessage } from "../src/i18n/server-messages.ts";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));

/** Öffentliche Routen und Hilfsordner unter src/app/api (der Admin-Bereich bleibt deutsch und ist ausgenommen). */
const API_DIRS = ["auth", "account", "contact", "newsletter", "avatar", "blog", "services", "status", "health", "_lib"];
const LIB_FILES = ["validation", "validation-licenses", "licenses", "api", "account", "mailer", "rate-limit", "tokens", "auth", "team"].map((n) => `src/lib/${n}.ts`);
const EXTRA_FILES = ["src/middleware.ts"];

function walk(dir: string): string[] {
  let out: string[] = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out = out.concat(walk(p));
    else if (/\.(ts|tsx)$/.test(name)) out.push(p);
  }
  return out;
}

const files = [
  ...API_DIRS.flatMap((d) => {
    try {
      return walk(join(root, "src/app/api", d));
    } catch {
      return [];
    }
  }),
  ...[...LIB_FILES, ...EXTRA_FILES].map((f) => join(root, f)),
];

type Found = { text: string; where: string };
const found: Found[] = [];
const add = (text: string, file: string) => {
  if (isMessage(text)) found.push({ text, where: relative(root, file) });
};

/** Meldung = Satz mit Großbuchstaben am Anfang und Satzzeichen am Ende; Codes, Header-Werte und Schlüssel fallen heraus. */
function isMessage(s: string): boolean {
  return /^[A-ZÄÖÜ]/.test(s) && /[.!?]$/.test(s) && /[a-zäöüß]/.test(s);
}

const STRING_RE = /"((?:[^"\\\n]|\\.)*)"|'((?:[^'\\\n]|\\.)*)'|`((?:[^`\\]|\\.)*)`/g;
const unescape = (s: string) => s.replace(/\\(["'`\\])/g, "$1").replace(/\\n/g, "\n");

/** Template-Platzhalter durch Beispielwerte ersetzen ("Mindestens ${min} Zeichen." -> "Mindestens 5 Zeichen."). */
const sample = (s: string) => s.replace(/\$\{[^}]*\}/g, "5");

/** Argumentliste eines Aufrufs ab der öffnenden Klammer (ausgewogen, Strings werden übersprungen). */
function callArgs(src: string, openIdx: number): string {
  let depth = 0;
  for (let i = openIdx; i < src.length; i++) {
    const c = src[i];
    if (c === '"' || c === "'" || c === "`") {
      const q = c;
      for (i++; i < src.length && src[i] !== q; i++) if (src[i] === "\\") i++;
      continue;
    }
    if (c === "(") depth++;
    else if (c === ")" && --depth === 0) return src.slice(openIdx + 1, i);
  }
  return "";
}

function literals(chunk: string): string[] {
  const out: string[] = [];
  for (const m of chunk.matchAll(STRING_RE)) out.push(unescape(m[1] ?? m[2] ?? m[3] ?? ""));
  return out;
}

for (const file of files) {
  const src = readFileSync(file, "utf8");
  const isValidation = /src\/lib\/validation(-licenses)?\.ts$/.test(file);
  const isMailer = file.endsWith("src/lib/mailer.ts");

  // Benannte Konstanten: const INVALID = "…";
  const consts = new Map<string, string>();
  for (const m of src.matchAll(/const ([A-Z_]+)\s*(?::[^=]+)?=\s*"((?:[^"\\\n]|\\.)*)"/g)) consts.set(m[1]!, unescape(m[2]!));

  // 1) new ApiError(status, "CODE", message, fields?) und fail(status, "CODE", message, fields?, headers?)
  for (const m of src.matchAll(/(?:new ApiError|\bfail)\(/g)) {
    const open = m.index! + m[0].length - 1;
    const args = callArgs(src, open);
    if (!/^\s*\d+\s*,\s*"[A-Z_]+"/.test(args)) continue; // Definition (z. B. "status: number")
    const body = args.replace(/^\s*\d+\s*,\s*"[A-Z_]+"\s*,?/, "");
    for (const t of literals(body)) add(sample(t), file);
    for (const id of body.matchAll(/\b([A-Z][A-Z_]{2,})\b/g)) if (consts.has(id[1]!)) add(consts.get(id[1]!)!, file);
  }

  // 2) benannte Meldungskonstanten (INVALID, UNKNOWN, …), auch wenn sie indirekt verwendet werden
  for (const text of consts.values()) add(text, file);

  // 3) Standardwerte: message = "…"
  for (const m of src.matchAll(/\bmessage\s*=\s*"((?:[^"\\\n]|\\.)*)"/g)) add(unescape(m[1]!), file);

  // 4) notFound("Beitrag") und notFound(what = "Eintrag") -> "<Nomen> nicht gefunden."
  for (const m of src.matchAll(/\bnotFound\(\s*(?:what\s*=\s*)?"([^"]+)"/g)) add(`${m[1]} nicht gefunden.`, file);

  // 5) validation.ts: alle Strings (Meldungen, mit Beispielwerten für ${…})
  if (isValidation) {
    const body = src.replace(/^import[\s\S]*?;\n/gm, "").replace(/\/\/.*$/gm, "");
    for (const t of literals(body)) {
      if (/nicht gefunden/.test(t)) continue;
      add(sample(t), file);
    }
  }

  // 6) mailer.ts: Rückgabetexte der Fehlererklärung
  if (isMailer) {
    for (const m of src.matchAll(/(?:return|error:)\s*"((?:[^"\\\n]|\\.)*)"/g)) add(unescape(m[1]!), file);
    add("Versand fehlgeschlagen.", file);
    add("Versand fehlgeschlagen (SMTP 550).", file);
  }
}

// 7) Zod: tatsächlich entstehende Meldungen (eigene und deutsche Standardtexte) aller Schemas aus validation.ts
const validation = {
  ...((await import("../src/lib/validation.ts")) as Record<string, unknown>),
  ...((await import("../src/lib/validation-licenses.ts")) as Record<string, unknown>),
};
const probes: unknown[] = [
  undefined,
  null,
  "",
  " ",
  "a",
  "x".repeat(300),
  "x".repeat(6000),
  "kein-mail",
  "a@b",
  0,
  -1,
  5,
  101,
  99999,
  1.5,
  true,
  false,
  [],
  {},
  "NOPE",
];
const zodFound: Found[] = [];
const collect = (
  schema: {
    safeParse: (v: unknown) => {
      success: boolean;
      error?: { issues: { message: string }[] };
    };
  },
  value: unknown,
  name: string,
) => {
  const r = schema.safeParse(value);
  if (!r.success) for (const i of r.error!.issues) zodFound.push({ text: i.message, where: `validation.ts (${name})` });
};
for (const [name, schema] of Object.entries(validation)) {
  if (!name.endsWith("Schema") || !schema || typeof (schema as { safeParse?: unknown }).safeParse !== "function") continue;
  const s = schema as Parameters<typeof collect>[0] & {
    shape?: Record<string, unknown>;
  };
  for (const v of probes) collect(s, v, name);
  collect(s, {}, name);
  for (const key of Object.keys(s.shape ?? {})) for (const v of probes) collect(s, { [key]: v }, name);
}

// Zusammenführen und prüfen
const all = [...found, ...zodFound];
const unique = new Map<string, string[]>();
for (const f of all) {
  const arr = unique.get(f.text) ?? [];
  if (!arr.includes(f.where)) arr.push(f.where);
  unique.set(f.text, arr);
}

const missing = [...unique].filter(([text]) => translateApiMessage(text, "en") === text);
const total = unique.size;
const covered = total - missing.length;

console.log(`Dateien geprüft: ${files.length}`);
console.log(`Meldungen: ${total} (davon aus Zod-Prüfung: ${new Set(zodFound.map((z) => z.text)).size})`);
console.log(`Mit englischer Übersetzung: ${covered}/${total} (${((covered / total) * 100).toFixed(1)} %)`);
if (missing.length > 0) {
  console.log("\nOhne Übersetzung:");
  for (const [text, where] of missing) console.log(`  - ${JSON.stringify(text)}  [${where.join(", ")}]`);
  process.exit(1);
}
// Deutsch bleibt unverändert, unbekannte Texte ebenfalls.
if (translateApiMessage("Ungültige Eingabe.", "de") !== "Ungültige Eingabe." || translateApiMessage("Irgendein neuer Text", "en") !== "Irgendein neuer Text") {
  console.error("translateApiMessage verändert Deutsch oder unbekannte Texte.");
  process.exit(1);
}
console.log("OK: alle bekannten Meldungen sind übersetzt.");
