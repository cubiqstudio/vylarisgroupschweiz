import type { Metadata } from "next";
import { site } from "@/lib/site";
import { requireModulePage } from "@/lib/verein/guard";
import { loadVereinDashboard } from "@/lib/verein/overview-data";
import { PageTitle } from "@/components/admin/core/page-title";
import { CronStatusCard, NextDatesCard, QuickActions, SetupHelp, VereinKpis } from "@/components/admin/verein/dashboard-parts";
import { WebsiteOverview } from "@/components/admin/verein/website-overview";

export const metadata: Metadata = { title: "Übersicht" };
export const dynamic = "force-dynamic";

export default async function AdminOverviewPage() {
  const admin = await requireModulePage("dashboard");
  const data = await loadVereinDashboard(admin);
  const { sections } = data;
  const firstName = admin.name.split(" ")[0];
  const hasVerein = sections.members || sections.fees || sections.ledger || sections.meetings || sections.events || sections.tasks;
  const showDates = sections.meetings || sections.events;

  return (
    <>
      <PageTitle
        title={firstName ? `Hallo, ${firstName}` : "Übersicht"}
        description={
          hasVerein && sections.website
            ? `Der aktuelle Stand des Vereins ${site.legalName} und der Website auf einen Blick.`
            : hasVerein
              ? `Der aktuelle Stand des Vereins ${site.legalName} auf einen Blick.`
              : `Der aktuelle Stand der Website der ${site.name} auf einen Blick.`
        }
      />

      {data.setup && <SetupHelp groups={data.setup} />}
      <CronStatusCard data={data} />

      {hasVerein && (
        <>
          <VereinKpis data={data} />
          <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-5">
            {showDates && (
              <div className="min-w-0 lg:col-span-3">
                <NextDatesCard data={data} />
              </div>
            )}
            <div className={showDates ? "min-w-0 lg:col-span-2" : "min-w-0 lg:col-span-5 lg:max-w-sm"}>
              <QuickActions roles={admin.roles} />
            </div>
          </div>
        </>
      )}

      {sections.website && (
        <section aria-labelledby="website-heading" className={hasVerein ? "mt-10" : undefined}>
          {hasVerein && (
            <h2 id="website-heading" className="mb-4 text-sm font-semibold uppercase tracking-[0.14em] text-zinc-500">
              Website
            </h2>
          )}
          <WebsiteOverview />
          {!hasVerein && (
            <div className="mt-6 max-w-sm">
              <QuickActions roles={admin.roles} />
            </div>
          )}
        </section>
      )}

      {!hasVerein && !sections.website && (
        <p className="rounded-xl border border-zinc-800 bg-surface px-5 py-8 text-center text-sm text-zinc-400">
          Für deine Rolle gibt es hier keine Kennzahlen. Nutze das Menü, um zu deinen Bereichen zu gelangen.
        </p>
      )}
    </>
  );
}
