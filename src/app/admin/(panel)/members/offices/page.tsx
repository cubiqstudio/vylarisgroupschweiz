import type { Metadata } from "next";
import Link from "next/link";
import { Landmark } from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { PILL } from "@/components/admin/core/styles";
import { site } from "@/lib/site";
import { requireModulePage } from "@/lib/verein/guard";
import { listOffices } from "@/lib/verein/members-data";
import { compareBoardWithWebsite, groupOffices, memberName, officePeriodLabel, officeState, officeTitle, OFFICE_STATE_LABEL } from "@/lib/verein/members-lib";
import { toDateInputValue } from "@/lib/verein/dates";
import { canAccess } from "@/lib/verein/permissions";
import { PageTitle } from "@/components/admin/core/page-title";
import { Notice } from "@/components/admin/core/notice";
import { EmptyState } from "@/components/admin/licenses/empty-state";
import { MembersNav } from "@/components/admin/members/members-nav";
import { OfficeAddButton, OfficeRowActions, type OfficeDTO } from "@/components/admin/members/office-actions";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Ämter und Vorstand" };

type Row = Awaited<ReturnType<typeof listOffices>>[number];

export default async function OfficesPage() {
  const admin = await requireModulePage("members");
  const canWrite = canAccess(admin.roles, "members", "write");
  const offices = await listOffices();
  const groups = groupOffices(offices);

  const dto = (o: Row): OfficeDTO => ({
    id: o.id,
    kind: o.kind,
    title: o.title,
    validFrom: toDateInputValue(o.validFrom),
    validUntil: o.validUntil ? toDateInputValue(o.validUntil) : "",
    note: o.note,
    label: officeTitle(o),
    memberName: memberName(o.member),
  });

  const boardNames = [...groups.board].map((o) => memberName(o.member));
  const cmp = compareBoardWithWebsite(boardNames, site.board.map((p) => p.name));

  const renderList = (list: Row[]) => (
    <Card className="overflow-hidden">
      <ul className="divide-y divide-zinc-800">
        {list.map((o) => {
          const state = officeState(o);
          return (
            <li key={o.id} className="px-4 py-4 sm:px-5">
              <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5">
                <h3 className="text-sm font-semibold text-white sm:text-base">{officeTitle(o)}</h3>
                <span className={cn(PILL, state === "LAUFEND" ? "bg-emerald-500/10 text-emerald-300 ring-emerald-500/30" : state === "GEPLANT" ? "bg-sky-500/10 text-sky-300 ring-sky-500/30" : "bg-zinc-800/80 text-zinc-400 ring-zinc-700")}>{OFFICE_STATE_LABEL[state]}</span>
              </div>
              <p className="mt-0.5 text-sm text-zinc-300">
                <Link href={`/admin/members/${o.member.id}`} className="hover:text-emerald-400">
                  {memberName(o.member)}
                </Link>{" "}
                <span className="text-zinc-500">(Nr. {o.member.memberNumber})</span>
              </p>
              <p className="mt-0.5 text-xs text-zinc-500">{officePeriodLabel(o)}</p>
              {o.note && <p className="mt-1 text-xs text-zinc-500">{o.note}</p>}
              {canWrite && (
                <div className="mt-3">
                  <OfficeRowActions office={dto(o)} />
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </Card>
  );

  const section = (title: string, list: Row[], empty?: string) =>
    list.length === 0 && !empty ? null : (
      <section className="mt-8 first:mt-0" aria-label={title}>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-[0.14em] text-zinc-500">{title}</h2>
        {list.length === 0 ? <p className="text-sm text-zinc-500">{empty}</p> : renderList(list)}
      </section>
    );

  return (
    <div>
      <PageTitle title="Ämter und Vorstand" description="Wer welches Amt innehat und wie lange: Vorstand, Revisionsstelle und weitere Ämter mit Amtszeit.">
        {canWrite && <OfficeAddButton />}
      </PageTitle>
      <MembersNav />

      {offices.length === 0 ? (
        <EmptyState icon={Landmark} title="Noch keine Ämter erfasst" text="Trage hier ein, wer im Vorstand und in der Revisionsstelle ist. Das ist nur eine Übersicht; Zugriffsrechte in dieser Software vergibst du getrennt unter «Zugänge und Rollen»." />
      ) : (
        <>
          {section("Vorstand (laufend)", groups.board, "Zurzeit ist kein Vorstandsamt besetzt.")}
          {section("Revisionsstelle (laufend)", groups.auditors)}
          {section("Weitere Ämter (laufend)", groups.other)}
          {section("Geplant", groups.planned)}
          {section("Frühere Ämter (Verlauf)", groups.past)}
        </>
      )}

      <Notice variant={cmp.matches ? "success" : "info"} className="mt-8">
        <p className="font-medium">Abgleich mit der Über-uns-Seite</p>
        {cmp.matches ? (
          <p className="mt-1">Der Vorstand hier entspricht den Personen auf der Über-uns-Seite.</p>
        ) : (
          <div className="mt-1 space-y-1">
            {cmp.missingOnWebsite.length > 0 && <p>Im Vorstand, aber nicht auf der Über-uns-Seite: {cmp.missingOnWebsite.join(", ")}.</p>}
            {cmp.notInRecords.length > 0 && <p>Auf der Über-uns-Seite, aber hier nicht im laufenden Vorstand: {cmp.notInRecords.join(", ")}.</p>}
            <p>Das ist nur ein Hinweis. Die Website wird nie automatisch geändert; die Personen dort pflegst du in den Stammdaten der Website.</p>
          </div>
        )}
      </Notice>
    </div>
  );
}
