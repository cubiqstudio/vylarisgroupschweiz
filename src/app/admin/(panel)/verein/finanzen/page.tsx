import type { Metadata } from "next";
import { PageTitle } from "@/components/admin/core/page-title";
import { FinanceSettingsForm } from "@/components/admin/verein/finance-settings-form";
import { requireModulePage } from "@/lib/verein/guard";
import { canAccess } from "@/lib/verein/permissions";
import { FINANCE_SETTING_FIELDS } from "@/lib/verein/settings-forms";
import { getVereinSettings, missingForInvoicing, missingForReminders } from "@/lib/verein/settings";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Finanzeinstellungen" };

export default async function Page() {
  const admin = await requireModulePage("finance_settings");
  const all = await getVereinSettings();
  const settings = Object.fromEntries(FINANCE_SETTING_FIELDS.map((f) => [f, all[f]])) as Pick<typeof all, (typeof FINANCE_SETTING_FIELDS)[number]>;
  const missing = [...missingForInvoicing(all), ...missingForReminders(all)];

  return (
    <>
      <PageTitle title="Finanzeinstellungen" description="Kontoinhaber, IBAN, Zahlungsfrist und Mahnfristen für Rechnungen und Mahnungen." />
      <FinanceSettingsForm settings={settings} missing={missing} canWrite={canAccess(admin.roles, "finance_settings", "write")} />
    </>
  );
}
