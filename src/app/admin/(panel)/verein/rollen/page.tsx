import type { Metadata } from "next";
import { PageTitle } from "@/components/admin/core/page-title";
import { RolePermissionsEditor, type RolePermissionsState } from "@/components/admin/verein/role-permissions-editor";
import { requireModulePage } from "@/lib/verein/guard";
import { DEFAULT_MATRIX, canAccess } from "@/lib/verein/permissions";
import { matrixToInput } from "@/lib/verein/permissions-config";
import { getEffectiveMatrix } from "@/lib/verein/permissions-data";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Rollen und Rechte" };

export default async function Page() {
  // Modul «system»: Lesen für Rollen, denen das gegeben wurde; ändern nur Inhaber und Administration.
  const admin = await requireModulePage("system");
  const matrix = await getEffectiveMatrix({ fresh: true });
  return (
    <>
      <PageTitle
        title="Rollen und Rechte"
        description="Was die Rollen im Verwaltungsbereich sehen und ändern dürfen. Die Voreinstellung bildet die übliche Aufgabenverteilung im Vorstand ab; Anpassungen stehen im Änderungsprotokoll."
      />
      <RolePermissionsEditor
        current={matrixToInput(matrix) as RolePermissionsState}
        defaults={matrixToInput(DEFAULT_MATRIX) as RolePermissionsState}
        canWrite={canAccess(admin.roles, "system", "write")}
      />
    </>
  );
}
