import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireModulePage } from "@/lib/verein/guard";
import { listMembershipTypes } from "@/lib/verein/members-data";
import { hasBoardRole } from "@/lib/verein/permissions";
import { PageTitle } from "@/components/admin/core/page-title";
import { EMPTY_MEMBER, MemberForm } from "@/components/admin/members/member-form";
import { MembersNav } from "@/components/admin/members/members-nav";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Neues Mitglied" };

export default async function NewMemberPage() {
  const admin = await requireModulePage("members", "write");
  const types = await listMembershipTypes();
  return (
    <div>
      <PageTitle title="Neues Mitglied" description="Erfasse eine Person von Hand, zum Beispiel bei einem Beitritt auf Papier oder an der Versammlung. Die Mitgliedernummer wird automatisch vergeben.">
        <Link href="/admin/members" className="inline-flex items-center gap-1.5 text-sm font-medium text-zinc-400 hover:text-white">
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Zur Mitgliederliste
        </Link>
      </PageTitle>
      <MembersNav />
      <MemberForm mode="create" initial={EMPTY_MEMBER} types={types.map((t) => ({ id: t.id, name: t.name, active: t.active }))} showBoardNotes={hasBoardRole(admin.roles)} />
    </div>
  );
}
