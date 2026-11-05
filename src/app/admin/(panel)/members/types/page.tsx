import type { Metadata } from "next";
import { requireModulePage } from "@/lib/verein/guard";
import { listMembershipTypes } from "@/lib/verein/members-data";
import { formatChf, toDecimalString } from "@/lib/verein/money";
import { canAccess } from "@/lib/verein/permissions";
import { PageTitle } from "@/components/admin/core/page-title";
import { Notice } from "@/components/admin/core/notice";
import { EmptyState } from "@/components/admin/licenses/empty-state";
import { MembersNav } from "@/components/admin/members/members-nav";
import { MembershipTypeManager } from "@/components/admin/members/membership-type-manager";
import { Layers } from "lucide-react";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Mitgliedschaftsarten" };

export default async function MembershipTypesPage() {
  const admin = await requireModulePage("members");
  const canWrite = canAccess(admin.roles, "members", "write");
  const types = await listMembershipTypes();
  return (
    <div>
      <PageTitle title="Mitgliedschaftsarten" description="Welche Arten von Mitgliedschaft es gibt, was sie kosten und welche Rechte sie geben." />
      <MembersNav />
      <Notice variant="info" className="mb-6">
        Beitrag, Stimmrecht und Wählbarkeit sind Voreinstellungen, die der Verein selbst festlegt: gemäss Statuten anpassen. Ohne abweichende Regel haben nach ZGB Art. 67 alle Mitglieder das gleiche Stimmrecht.
      </Notice>
      {types.length === 0 ? (
        <EmptyState icon={Layers} title="Noch keine Mitgliedschaftsarten" text="Lege mindestens eine Art an, damit Mitglieder zugeordnet werden können und das Beitrittsformular eine Auswahl anbietet." />
      ) : null}
      {(types.length > 0 || canWrite) && (
        <MembershipTypeManager
          canWrite={canWrite}
          types={types.map((t) => ({
            id: t.id,
            name: t.name,
            description: t.description,
            annualFee: toDecimalString(t.annualFeeRappen),
            annualFeeDisplay: formatChf(t.annualFeeRappen),
            votingRight: t.votingRight,
            eligibleForBoard: t.eligibleForBoard,
            selectable: t.selectable,
            active: t.active,
            sortOrder: t.sortOrder,
            memberCount: t._count.members,
          }))}
        />
      )}
    </div>
  );
}
