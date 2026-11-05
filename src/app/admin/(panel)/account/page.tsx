import type { Metadata } from "next";
import { requireModulePage } from "@/lib/verein/guard";
import { Card } from "@/components/ui/card";
import { PageTitle } from "@/components/admin/core/page-title";
import { PasswordForm } from "@/components/admin/core/password-form";
import { ROLE_LABEL } from "@/components/admin/core/styles";

export const metadata: Metadata = { title: "Konto" };
export const dynamic = "force-dynamic";

export default async function AdminAccountPage() {
  const admin = await requireModulePage("self");

  return (
    <>
      <PageTitle title="Konto" description="Deine Zugangsdaten und Sicherheitseinstellungen." />

      <div className="grid max-w-3xl gap-6">
        <Card className="p-5 sm:p-6">
          <h2 className="text-sm font-semibold text-white">Profil</h2>
          <dl className="mt-4 grid gap-4 text-sm sm:grid-cols-3">
            <div>
              <dt className="text-xs text-zinc-500">Name</dt>
              <dd className="mt-1 font-medium text-zinc-100">{admin.name}</dd>
            </div>
            <div className="min-w-0">
              <dt className="text-xs text-zinc-500">E-Mail-Adresse</dt>
              <dd className="mt-1 break-words font-medium text-zinc-100">{admin.email}</dd>
            </div>
            <div>
              <dt className="text-xs text-zinc-500">Rolle</dt>
              <dd className="mt-1 font-medium text-zinc-100">{ROLE_LABEL[admin.role] ?? admin.role}</dd>
            </div>
          </dl>
          <p className="mt-4 text-xs text-zinc-500">Diese Angaben kannst du hier nicht ändern.</p>
        </Card>

        <Card className="p-5 sm:p-6">
          <h2 className="text-sm font-semibold text-white">Passwort ändern</h2>
          <p className="mt-1 mb-5 text-sm text-zinc-400">
            Wähle ein langes, einzigartiges Passwort, das du nirgendwo sonst verwendest. Ein Passwortmanager hilft dabei.
          </p>
          <PasswordForm />
        </Card>
      </div>
    </>
  );
}
