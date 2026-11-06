import type { Metadata } from "next";
import { PageTitle } from "@/components/admin/core/page-title";
import { AccessManager, type AccessRowDto } from "@/components/admin/verein/access-manager";
import { RoleMatrix } from "@/components/admin/verein/role-matrix";
import { listAccessAccounts } from "@/lib/verein/access-data";
import { requireModulePage } from "@/lib/verein/guard";
import { canAccess, ADMIN_ROLE_VALUES, matrixOf, roleHint } from "@/lib/verein/permissions";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Zugänge und Rollen" };

export default async function Page() {
  const admin = await requireModulePage("system");
  const rows = await listAccessAccounts();
  const matrix = matrixOf(admin.roles);
  const roleHints = Object.fromEntries(ADMIN_ROLE_VALUES.map((r) => [r, roleHint(r, matrix)]));
  const dto: AccessRowDto[] = rows.map((r) => ({
    id: r.id,
    email: r.email,
    name: r.name,
    role: r.role,
    extraRoles: r.extraRoles
      .split(",")
      .map((x) => x.trim())
      .filter(Boolean),
    roles: r.roles,
    mustChangePassword: r.mustChangePassword,
    lastLoginAt: r.lastLoginAt?.toISOString() ?? null,
    member: r.member,
    suggestedRoles: r.suggestedRoles,
  }));

  return (
    <>
      <PageTitle
        title="Zugänge und Rollen"
        description="Wer die Verwaltung nutzen darf und was er dort darf. Rollen (Präsident/in, Vize-Präsident/in, Kassier/in, Aktuar/in, Revisor/in, Administrator) und die Verknüpfung mit dem Mitglied im Verein."
      />
      <AccessManager rows={dto} selfId={admin.id} selfRoles={admin.roles} roleHints={roleHints} canWrite={canAccess(admin.roles, "system", "write")} />
      <RoleMatrix matrix={matrix} canEdit={canAccess(admin.roles, "system", "write")} />
    </>
  );
}
