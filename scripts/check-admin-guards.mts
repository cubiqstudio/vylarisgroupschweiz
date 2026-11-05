// Prüft, dass jede Admin-Route und jede Admin-Seite die Berechtigung serverseitig prüft.
// Aufruf:  npx tsx scripts/check-admin-guards.mts      (Exit-Code 1, wenn ein Handler oder eine Seite keinen Wächter enthält)
//
//  - src/app/api/admin/**/route.ts  muss  requireAdmin(  oder  requireAdminModule(  aufrufen
//  - src/app/admin/(panel)/**/page.tsx  muss  requireModulePage(  (oder requireAdminPage( für die Seite «Keine Berechtigung») aufrufen
//  - src/app/(site)/account/verein/**/page.tsx  (Mitgliederportal)  muss  requireMemberPage(  aufrufen, ausgenommen die Übersicht und
//    Platzhalter ohne Datenzugriff (Kennzeichnung im Kopf der Datei: «Platzhalter»)
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));

function walk(dir: string): string[] {
  let out: string[] = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out = out.concat(walk(p));
    else out.push(p);
  }
  return out;
}

const problems: string[] = [];
const rel = (p: string) => relative(root, p);

for (const f of walk(join(root, "src/app/api/admin")).filter((p) => p.endsWith("/route.ts"))) {
  const src = readFileSync(f, "utf8");
  if (!/\brequireAdmin(Module)?\(/.test(src)) problems.push(`${rel(f)}: kein requireAdmin()/requireAdminModule()`);
}

for (const f of walk(join(root, "src/app/admin/(panel)")).filter((p) => p.endsWith("/page.tsx"))) {
  const src = readFileSync(f, "utf8");
  if (!/\brequireModulePage\(/.test(src) && !/\brequireAdminPage\(/.test(src)) problems.push(`${rel(f)}: kein requireModulePage()`);
}

const portal = join(root, "src/app/(site)/account/verein");
for (const f of walk(portal).filter((p) => p.endsWith("/page.tsx"))) {
  if (f === join(portal, "page.tsx")) continue; // Übersicht: zeigt auch Nicht-Mitgliedern, wie man beitritt
  const src = readFileSync(f, "utf8");
  if (/Platzhalter \(Besitzer/.test(src)) continue;
  if (!/\brequireMemberPage\(/.test(src)) problems.push(`${rel(f)}: kein requireMemberPage()`);
}

if (problems.length > 0) {
  console.error("Fehlende Rechteprüfung:");
  for (const p of problems) console.error(`  - ${p}`);
  process.exit(1);
}
console.log("Rechteprüfung: alle Admin-Routen und -Seiten haben einen Wächter.");
