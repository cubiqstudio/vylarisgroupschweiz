import { db } from "@/lib/db";
import { ApiError, handle, requireAdmin } from "@/lib/api";
import { auditActor, logAudit } from "@/lib/verein/audit";
import { canHandVerifyAccounts } from "@/lib/verein/permissions";
import { userAdminUpdateSchema } from "@/lib/validation";
import { decideBusiness } from "@/lib/licenses";
import { adminOk, notFound, parsePatch, type IdContext } from "../../../_lib/http";

export const dynamic = "force-dynamic";

const userSelect = {
  id: true,
  name: true,
  email: true,
  emailVerifiedAt: true,
  disabled: true,
  lastLoginAt: true,
  createdAt: true,
  isTeam: true,
  teamTitle: true,
  businessStatus: true,
  companyName: true,
} as const;

export const PATCH = handle(async (req: Request, { params }: IdContext) => {
  const admin = await requireAdmin(req);
  const { id } = await params;
  const patch = await parsePatch(req, userAdminUpdateSchema);

  const existing = await db.user.findUnique({
    where: { id },
    select: { id: true, emailVerifiedAt: true, disabled: true, isTeam: true, teamTitle: true, businessStatus: true },
  });
  if (!existing) notFound("Nutzer");
  // Die Bestätigung von Hand ersetzt den Nachweis per Mail. Sie ist deshalb nicht mit der reinen Website-Rolle (z. B. Redaktion) erlaubt.
  if (patch.verified === true && !existing.emailVerifiedAt && !canHandVerifyAccounts(admin.roles)) {
    throw new ApiError(403, "FORBIDDEN", "Dafür fehlt dir die Berechtigung: Die E-Mail-Adresse von Hand zu bestätigen ist nur mit den Rechten «Mitglieder ändern» oder «System» möglich.");
  }

  const data: { disabled?: boolean; emailVerifiedAt?: Date | null; emailVerifiedViaMail?: boolean; isTeam?: boolean; teamTitle?: string | null } = {};
  if (patch.disabled !== undefined) data.disabled = patch.disabled;
  if (patch.verified !== undefined) {
    if (patch.verified) {
      // Von Hand bestätigt: emailVerifiedViaMail bleibt unverändert (false), das Konto wird deshalb nie automatisch mit einem Mitglied verknüpft.
      if (!existing.emailVerifiedAt) data.emailVerifiedAt = new Date();
    } else {
      data.emailVerifiedAt = null;
      data.emailVerifiedViaMail = false;
    }
  }

  if (patch.team !== undefined) {
    data.isTeam = patch.team;
    if (!patch.team) data.teamTitle = null;
  }
  if (patch.teamTitle !== undefined && patch.team !== false) data.teamTitle = patch.teamTitle || null;

  if (patch.business) await decideBusiness(id, patch.business);

  const user = Object.keys(data).length
    ? await db.user.update({ where: { id }, data, select: userSelect })
    : await db.user.findUniqueOrThrow({ where: { id }, select: userSelect });

  // Sperren, Bestätigen, Team- und Firmenstatus ändern, was ein Konto darf: nachvollziehbar im Änderungsprotokoll (ohne Namen und Adressen).
  const changes: string[] = [];
  const before: Record<string, unknown> = {};
  const after: Record<string, unknown> = {};
  const note = (key: string, was: unknown, now: unknown) => {
    if (was === now) return;
    changes.push(key);
    before[key] = was;
    after[key] = now;
  };
  note("gesperrt", existing.disabled, user.disabled);
  note("bestätigt", existing.emailVerifiedAt !== null, user.emailVerifiedAt !== null);
  note("team", existing.isTeam, user.isTeam);
  note("teamTitel", existing.teamTitle, user.teamTitle);
  note("firmenstatus", existing.businessStatus, user.businessStatus);
  if (changes.length > 0) {
    const handVerified = patch.verified === true && !existing.emailVerifiedAt;
    await logAudit(db, {
      actor: auditActor(admin),
      action: handVerified ? "user.verify" : "user.update",
      objectType: "User",
      objectId: id,
      summary: `Website-Konto geändert (${changes.join(", ")})${handVerified ? ": E-Mail-Adresse von Hand bestätigt" : ""}`,
      before,
      after,
    });
  }
  return adminOk(user);
});

export const DELETE = handle(async (req: Request, { params }: IdContext) => {
  const admin = await requireAdmin(req);
  const { id } = await params;
  const existing = await db.user.findUnique({ where: { id }, select: { id: true } });
  if (!existing) notFound("Nutzer");
  await db.user.delete({ where: { id } }); // AuthTokens werden per Cascade entfernt
  await logAudit(db, { actor: auditActor(admin), action: "user.delete", objectType: "User", objectId: id, summary: "Website-Konto gelöscht" });
  return adminOk({ id });
});
