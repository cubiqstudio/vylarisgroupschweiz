import type { Metadata } from "next";
import { ShieldAlert } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PageTitle } from "@/components/admin/core/page-title";
import { rolesLabel } from "@/components/admin/core/styles";
import { requireAdminPage } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Keine Berechtigung" };

export default async function ForbiddenPage() {
  const admin = await requireAdminPage();
  return (
    <>
      <PageTitle title="Keine Berechtigung" description="Dein Zugang erlaubt diesen Bereich nicht." />
      <Card className="flex flex-col items-center px-6 py-14 text-center">
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-rose-500/10 text-rose-300 ring-1 ring-inset ring-rose-500/30">
          <ShieldAlert className="h-5 w-5" aria-hidden />
        </span>
        <h2 className="mt-4 text-lg font-semibold text-white">Dafür fehlt dir die Berechtigung</h2>
        <p className="mt-1.5 max-w-md text-sm text-zinc-400">
          Du bist als {rolesLabel(admin.roles) || "Benutzer"} angemeldet. Wenn du diesen Bereich brauchst, bitte den Vorstand, deine Rolle anzupassen.
        </p>
        <ButtonLink href="/admin" variant="secondary" className="mt-6">
          Zur Übersicht
        </ButtonLink>
      </Card>
    </>
  );
}
