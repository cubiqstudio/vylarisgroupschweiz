import type { Metadata } from "next";
import { PageTitle } from "@/components/admin/core/page-title";
import { GeneralSettingsForm } from "@/components/admin/verein/general-settings-form";
import { SITE } from "@/lib/sites";
import { requireModulePage } from "@/lib/verein/guard";
import { canAccess } from "@/lib/verein/permissions";
import { getVereinProfile } from "@/lib/verein/profile";
import { GENERAL_SETTING_FIELDS } from "@/lib/verein/settings-forms";
import { getVereinSettings } from "@/lib/verein/settings";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Vereinseinstellungen" };

export default async function Page() {
  const admin = await requireModulePage("verein_settings");
  const [all, profile] = await Promise.all([getVereinSettings(), getVereinProfile()]);
  const settings = Object.fromEntries(GENERAL_SETTING_FIELDS.map((f) => [f, all[f]])) as Pick<typeof all, (typeof GENERAL_SETTING_FIELDS)[number]>;

  return (
    <>
      <PageTitle
        title="Vereinseinstellungen"
        description="Stammdaten, Geschäftsjahr, Einladungsfrist, Austrittsregel, Beitrittsformular und Texte der Vereinsmails. Beträge, Fristen und Kontodaten trägt der Verein selbst ein."
      />
      <GeneralSettingsForm settings={settings} profile={profile} defaultName={SITE.legalName} canWrite={canAccess(admin.roles, "verein_settings", "write")} />
    </>
  );
}
