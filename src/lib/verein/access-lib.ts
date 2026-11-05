// Zugänge und Rollen: Schutzregeln beim Ändern von Admin-Konten, Vorschläge aus den Ämtern und Startpasswörter.
// Reine Funktionen (Tests: scripts/test/overview.test.mts); Datenzugriff: ./access-data.ts.
//
// Grundsätze:
//  - Es muss immer mindestens ein Zugang mit vollem Zugriff (Inhaber oder Administrator) bestehen.
//  - Die eigenen Rollen lassen sich nicht ändern und der eigene Zugang nicht löschen (auch nicht versehentlich).
//  - Die Rolle «Inhaber» vergibt und entzieht nur ein Inhaber; Zugänge von Inhabern ändert nur ein Inhaber.
//  - Amt (Office) und Rolle sind getrennt: Ein Amt gibt keinen Zugriff. Die Software schlägt höchstens die passende Rolle vor.
import { ADMIN_ROLE_LABEL, effectiveRoles, serializeExtraRoles, type AdminRoleValue } from "./permissions";

export type AccessAccount = { id: string; role: string; extraRoles: string };
export type AccessActor = { id: string; roles: readonly string[] };
export type RoleSelection = { role: string; extraRoles: readonly string[] };

const FULL_ROLES: readonly AdminRoleValue[] = ["OWNER", "ADMIN"];

/** Hat die Person vollen Zugriff (Inhaber oder Administrator)? */
export const hasFullAccess = (roles: readonly string[]): boolean => roles.some((r) => (FULL_ROLES as readonly string[]).includes(r));

/** Alle wirksamen Rollen einer Auswahl (Hauptrolle zuerst). */
export const rolesOf = (sel: RoleSelection): AdminRoleValue[] => effectiveRoles(sel.role, sel.extraRoles.join(","));

/** Gleiche Rollenmenge (Reihenfolge egal)? */
export function sameRoleSet(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((r) => b.includes(r));
}

/** Rollen für die Speicherung: Hauptrolle und bereinigte Zusatzrollen (kommagetrennt). */
export function storedRoles(sel: RoleSelection): { role: string; extraRoles: string } {
  const role = sel.role.trim().toUpperCase();
  return { role, extraRoles: serializeExtraRoles(role, sel.extraRoles) };
}

/** Lesbare Aufzählung der Rollen, z. B. «Kassier/in, Administrator». */
export const roleNames = (roles: readonly string[]): string => roles.map((r) => (ADMIN_ROLE_LABEL as Record<string, string>)[r] ?? r).join(", ");

/**
 * Prüft eine Änderung an einem Zugang. `next` = null bedeutet Löschen. `target` = null bedeutet Neuanlage.
 * Gibt eine verständliche Meldung zurück, wenn die Änderung nicht erlaubt ist, sonst null.
 */
export function checkAccessChange(input: {
  actor: AccessActor;
  target: AccessAccount | null;
  next: RoleSelection | null;
  accounts: readonly AccessAccount[];
}): string | null {
  const { actor, target, next, accounts } = input;
  const actorIsOwner = actor.roles.includes("OWNER");
  const targetRoles = target ? effectiveRoles(target.role, target.extraRoles) : [];
  const nextRoles = next ? rolesOf(next) : [];

  if (next && nextRoles.length === 0) return "Bitte mindestens eine gültige Rolle wählen.";

  if (target && target.id === actor.id) {
    if (next === null) return "Du kannst deinen eigenen Zugang nicht löschen.";
    if (!sameRoleSet(targetRoles, nextRoles)) return "Du kannst deine eigenen Rollen nicht ändern. Bitte eine andere Person mit vollem Zugriff darum bitten.";
  }

  if (!actorIsOwner) {
    if (targetRoles.includes("OWNER")) return "Zugänge von Inhabern kann nur ein Inhaber ändern.";
    if (nextRoles.includes("OWNER")) return "Die Rolle «Inhaber» kann nur ein Inhaber vergeben.";
  }

  // Es muss mindestens ein Zugang mit vollem Zugriff bestehen bleiben.
  const remaining = accounts
    .filter((a) => a.id !== target?.id)
    .filter((a) => hasFullAccess(effectiveRoles(a.role, a.extraRoles))).length;
  const keepsFull = next !== null && hasFullAccess(nextRoles) ? 1 : 0;
  if (remaining + keepsFull === 0) {
    return next === null ? "Dieser Zugang ist der letzte mit vollem Zugriff und kann nicht gelöscht werden." : "Es muss mindestens ein Zugang mit der Rolle «Inhaber» oder «Administrator» bestehen bleiben.";
  }
  return null;
}

/** Darf der Handelnde den Zugang eines anderen zurücksetzen (Passwort)? Gleiche Regel wie beim Ändern von Inhabern. */
export function canTouchAccount(actor: AccessActor, target: AccessAccount): boolean {
  if (actor.roles.includes("OWNER")) return true;
  return !effectiveRoles(target.role, target.extraRoles).includes("OWNER");
}

// ---- Vorschläge aus den Ämtern ---------------------------------------------------------------------------------------

const OFFICE_ROLE: Record<string, AdminRoleValue> = {
  PRAESIDENT: "PRAESIDENT",
  VIZEPRAESIDENT: "VIZEPRAESIDENT",
  KASSIER: "KASSIER",
  AKTUAR: "AKTUAR",
  REVISOR: "REVISOR",
};

/**
 * Rollen, die zu den laufenden Ämtern eines Mitglieds passen, aber dem Zugang fehlen. Nur ein Hinweis: Ein Amt gibt keinen Zugriff,
 * und wer mehr oder weniger darf, bestimmt der Verein.
 */
export function suggestRolesFromOffices(officeKinds: readonly string[], currentRoles: readonly string[]): AdminRoleValue[] {
  const out: AdminRoleValue[] = [];
  for (const kind of officeKinds) {
    const role = OFFICE_ROLE[kind];
    if (role && !currentRoles.includes(role) && !hasFullAccess(currentRoles) && !out.includes(role)) out.push(role);
  }
  return out;
}

// ---- Startpasswort -----------------------------------------------------------------------------------------------------

const UPPER = "ABCDEFGHJKLMNPQRSTUVWXYZ";
const LOWER = "abcdefghijkmnpqrstuvwxyz";
const DIGITS = "23456789";

/** Gleichverteilte Zufallszahl in [0, max) aus dem Zufallsgenerator des Systems (Web Crypto, ohne verzerrte Reste). */
function secureRandomInt(max: number): number {
  const limit = Math.floor(0x100000000 / max) * max;
  const buf = new Uint32Array(1);
  for (;;) {
    globalThis.crypto.getRandomValues(buf);
    if (buf[0]! < limit) return buf[0]! % max;
  }
}

/**
 * Zufälliges Startpasswort der Form «Abcd-Efgh-2345-Jklm» (ohne leicht verwechselbare Zeichen). Es wird einmal angezeigt;
 * die Person muss es bei der ersten Anmeldung ändern (mustChangePassword).
 */
export function generateTempPassword(pick: (max: number) => number = secureRandomInt): string {
  const all = UPPER + LOWER + DIGITS;
  const chars: string[] = [];
  const take = (set: string) => set[pick(set.length)] ?? set[0]!;
  chars.push(take(UPPER), take(LOWER), take(DIGITS));
  while (chars.length < 16) chars.push(take(all));
  // Mischen (Fisher-Yates), damit die Pflichtzeichen nicht immer vorne stehen
  for (let i = chars.length - 1; i > 0; i--) {
    const j = pick(i + 1);
    [chars[i], chars[j]] = [chars[j]!, chars[i]!];
  }
  return [0, 4, 8, 12].map((i) => chars.slice(i, i + 4).join("")).join("-");
}
