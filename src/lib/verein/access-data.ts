// Zugänge und Rollen (Admin-Konten): auflisten, anlegen, ändern, Passwort zurücksetzen, löschen. Jede Änderung steht im Änderungsprotokoll
// (Aktion «role.change» bei Rollenwechsel). Schutzregeln: ./access-lib.ts. Passwörter und Hashes erscheinen nie im Protokoll oder in Antworten
// (das Startpasswort wird einmal an die ausführende Person zurückgegeben).
import "server-only";
import bcrypt from "bcryptjs";
import { ApiError } from "@/lib/api";
import type { CurrentAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { auditActor, logAudit } from "./audit";
import {
  canTouchAccount,
  checkAccessChange,
  generateTempPassword,
  rolesOf,
  sameRoleSet,
  storedRoles,
  suggestRolesFromOffices,
  type AccessAccount,
} from "./access-lib";
import type { AccessCreateInput, AccessPatchInput } from "./access-schemas";
import { effectiveRoles, type AdminRoleValue } from "./permissions";

const BCRYPT_COST = 12;

export type AccessRow = {
  id: string;
  email: string;
  name: string;
  role: string;
  extraRoles: string;
  roles: AdminRoleValue[];
  mustChangePassword: boolean;
  lastLoginAt: Date | null;
  createdAt: Date;
  member: { id: string; memberNumber: number; name: string; status: string } | null;
  /** Rollen, die zu laufenden Ämtern des verknüpften Mitglieds passen, dem Zugang aber fehlen (nur Hinweis) */
  suggestedRoles: AdminRoleValue[];
};

export async function listAccessAccounts(): Promise<AccessRow[]> {
  const rows = await db.adminUser.findMany({
    orderBy: [{ createdAt: "asc" }, { email: "asc" }],
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      extraRoles: true,
      mustChangePassword: true,
      lastLoginAt: true,
      createdAt: true,
      member: {
        select: {
          id: true,
          memberNumber: true,
          firstName: true,
          lastName: true,
          status: true,
          offices: { where: { validUntil: null }, select: { kind: true } },
        },
      },
    },
  });
  return rows.map((r) => {
    const roles = effectiveRoles(r.role, r.extraRoles);
    return {
      id: r.id,
      email: r.email,
      name: r.name,
      role: r.role,
      extraRoles: r.extraRoles,
      roles,
      mustChangePassword: r.mustChangePassword,
      lastLoginAt: r.lastLoginAt,
      createdAt: r.createdAt,
      member: r.member ? { id: r.member.id, memberNumber: r.member.memberNumber, name: `${r.member.firstName} ${r.member.lastName}`.trim(), status: r.member.status } : null,
      suggestedRoles: r.member ? suggestRolesFromOffices(r.member.offices.map((o) => o.kind), roles) : [],
    };
  });
}

const allAccounts = (): Promise<AccessAccount[]> => db.adminUser.findMany({ select: { id: true, role: true, extraRoles: true } });

type Actor = Pick<CurrentAdmin, "id" | "name" | "roles">;

async function assertMemberLinkable(memberId: string, exceptAdminId: string | null): Promise<void> {
  const member = await db.member.findUnique({ where: { id: memberId }, select: { id: true, status: true, adminAccount: { select: { id: true } } } });
  if (!member) throw new ApiError(422, "VALIDATION_ERROR", "Ungültige Eingabe.", { memberId: "Dieses Mitglied gibt es nicht." });
  if (member.status !== "AKTIV") throw new ApiError(422, "VALIDATION_ERROR", "Ungültige Eingabe.", { memberId: "Nur aktive Mitglieder lassen sich verknüpfen." });
  if (member.adminAccount && member.adminAccount.id !== exceptAdminId) {
    throw new ApiError(409, "CONFLICT", "Dieses Mitglied ist bereits mit einem anderen Zugang verknüpft.");
  }
}

function deny(message: string): never {
  throw new ApiError(403, "FORBIDDEN", message);
}

export async function createAccessAccount(admin: Actor, input: AccessCreateInput): Promise<{ id: string; tempPassword: string }> {
  const accounts = await allAccounts();
  const problem = checkAccessChange({ actor: admin, target: null, next: { role: input.role, extraRoles: input.extraRoles }, accounts });
  if (problem) deny(problem);
  if (await db.adminUser.findUnique({ where: { email: input.email }, select: { id: true } })) {
    throw new ApiError(409, "CONFLICT", "Für diese E-Mail-Adresse gibt es schon einen Zugang.", { email: "Diese E-Mail-Adresse ist bereits vergeben." });
  }
  if (input.memberId) await assertMemberLinkable(input.memberId, null);

  const tempPassword = generateTempPassword();
  const passwordHash = await bcrypt.hash(tempPassword, BCRYPT_COST);
  const roles = storedRoles({ role: input.role, extraRoles: input.extraRoles });
  const created = await db.$transaction(async (tx) => {
    const row = await tx.adminUser.create({
      data: { email: input.email, name: input.name, passwordHash, role: roles.role, extraRoles: roles.extraRoles, memberId: input.memberId, mustChangePassword: true },
      select: { id: true },
    });
    await logAudit(tx, {
      actor: auditActor(admin),
      action: "access.create",
      objectType: "AdminUser",
      objectId: row.id,
      summary: `Zugang für ${input.name} angelegt`,
      after: { email: input.email, name: input.name, role: roles.role, extraRoles: roles.extraRoles, memberId: input.memberId },
    });
    return row;
  });
  return { id: created.id, tempPassword };
}

export async function updateAccessAccount(admin: Actor, id: string, patch: AccessPatchInput): Promise<void> {
  const accounts = await allAccounts();
  const target = await db.adminUser.findUnique({ where: { id }, select: { id: true, name: true, email: true, role: true, extraRoles: true, memberId: true } });
  if (!target) throw new ApiError(404, "NOT_FOUND", "Zugang nicht gefunden.");

  const nextSel = {
    role: patch.role ?? target.role,
    extraRoles: patch.extraRoles ?? effectiveRoles(target.role, target.extraRoles).filter((r) => r !== target.role),
  };
  const problem = checkAccessChange({ actor: admin, target, next: nextSel, accounts });
  if (problem) deny(problem);

  const nextRoles = storedRoles(nextSel);
  const beforeRoles = effectiveRoles(target.role, target.extraRoles);
  const rolesChanged = !sameRoleSet(beforeRoles, rolesOf(nextSel));
  const memberChanged = patch.memberId !== undefined && patch.memberId !== target.memberId;
  if (memberChanged && patch.memberId) await assertMemberLinkable(patch.memberId, id);

  const data: { name?: string; role?: string; extraRoles?: string; memberId?: string | null; sessionVersion?: { increment: number } } = {};
  if (patch.name !== undefined && patch.name !== target.name) data.name = patch.name;
  if (rolesChanged || nextRoles.role !== target.role || nextRoles.extraRoles !== target.extraRoles) {
    data.role = nextRoles.role;
    data.extraRoles = nextRoles.extraRoles;
  }
  if (memberChanged) data.memberId = patch.memberId ?? null;
  if (Object.keys(data).length === 0) return;
  // Wechselt die Rolle einer anderen Person, endet ihre Sitzung (neue Anmeldung mit den neuen Rechten). Die eigene Sitzung bleibt.
  if (rolesChanged && target.id !== admin.id) data.sessionVersion = { increment: 1 };

  await db.$transaction(async (tx) => {
    await tx.adminUser.update({ where: { id }, data });
    if (rolesChanged) {
      await logAudit(tx, {
        actor: auditActor(admin),
        action: "role.change",
        objectType: "AdminUser",
        objectId: id,
        summary: `Rolle von ${target.name} geändert`,
        before: { role: target.role, extraRoles: target.extraRoles },
        after: { role: nextRoles.role, extraRoles: nextRoles.extraRoles },
      });
    }
    if (data.name !== undefined || memberChanged) {
      await logAudit(tx, {
        actor: auditActor(admin),
        action: "access.update",
        objectType: "AdminUser",
        objectId: id,
        summary: `Zugang von ${target.name} geändert`,
        before: { ...(data.name !== undefined ? { name: target.name } : {}), ...(memberChanged ? { memberId: target.memberId } : {}) },
        after: { ...(data.name !== undefined ? { name: data.name } : {}), ...(memberChanged ? { memberId: data.memberId ?? null } : {}) },
      });
    }
  });
}

export async function resetAccessPassword(admin: Actor, id: string): Promise<{ tempPassword: string }> {
  if (id === admin.id) throw new ApiError(409, "CONFLICT", "Dein eigenes Passwort änderst du unter «Mein Konto».");
  const target = await db.adminUser.findUnique({ where: { id }, select: { id: true, name: true, role: true, extraRoles: true } });
  if (!target) throw new ApiError(404, "NOT_FOUND", "Zugang nicht gefunden.");
  if (!canTouchAccount(admin, target)) deny("Zugänge von Inhabern kann nur ein Inhaber ändern.");
  const tempPassword = generateTempPassword();
  const passwordHash = await bcrypt.hash(tempPassword, BCRYPT_COST);
  await db.$transaction(async (tx) => {
    await tx.adminUser.update({ where: { id }, data: { passwordHash, mustChangePassword: true, sessionVersion: { increment: 1 } } });
    await logAudit(tx, {
      actor: auditActor(admin),
      action: "access.password-reset",
      objectType: "AdminUser",
      objectId: id,
      summary: `Passwort von ${target.name} zurückgesetzt`,
    });
  });
  return { tempPassword };
}

export async function deleteAccessAccount(admin: Actor, id: string): Promise<void> {
  const accounts = await allAccounts();
  const target = await db.adminUser.findUnique({ where: { id }, select: { id: true, name: true, email: true, role: true, extraRoles: true, memberId: true } });
  if (!target) throw new ApiError(404, "NOT_FOUND", "Zugang nicht gefunden.");
  const problem = checkAccessChange({ actor: admin, target, next: null, accounts });
  if (problem) deny(problem);
  await db.$transaction(async (tx) => {
    await tx.adminUser.delete({ where: { id } });
    await logAudit(tx, {
      actor: auditActor(admin),
      action: "access.delete",
      objectType: "AdminUser",
      objectId: id,
      summary: `Zugang von ${target.name} gelöscht`,
      before: { email: target.email, name: target.name, role: target.role, extraRoles: target.extraRoles, memberId: target.memberId },
    });
  });
}
