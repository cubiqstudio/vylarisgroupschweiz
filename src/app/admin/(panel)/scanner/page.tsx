import type { Metadata } from "next";
import { Card } from "@/components/ui/card";
import { Notice } from "@/components/admin/core/notice";
import { PageTitle } from "@/components/admin/core/page-title";
import { ScannerManager } from "@/components/admin/scanner/scanner-manager";
import type { ScannerDeviceDto } from "@/components/admin/scanner/types";
import { site } from "@/lib/site";
import { requireModulePage } from "@/lib/verein/guard";
import { canAccess } from "@/lib/verein/permissions";
import { listScannerDevices } from "@/lib/verein/scanner-devices";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Scanner" };

export default async function Page() {
  const admin = await requireModulePage("system");
  const rows = await listScannerDevices();
  const devices: ScannerDeviceDto[] = rows.map((r) => ({
    id: r.id,
    label: r.label,
    tokenHint: r.tokenHint,
    canCheckIn: r.canCheckIn,
    active: r.active,
    createdAt: r.createdAt.toISOString(),
    lastUsedAt: r.lastUsedAt?.toISOString() ?? null,
    revokedAt: r.revokedAt?.toISOString() ?? null,
  }));

  return (
    <>
      <PageTitle
        title="Scanner"
        description="Geräte für die Türkontrolle mit der Android-App «Vylaris Scanner»: Sie prüfen den QR-Code des digitalen Mitgliederausweises und tragen Personen bei Anlässen als anwesend ein."
      />

      <Card className="mb-6 p-5">
        <h2 className="text-sm font-semibold text-white">So koppelst du die App</h2>
        <ol className="mt-3 list-decimal space-y-1.5 pl-5 text-sm text-zinc-400">
          <li>Hier ein neues Gerät anlegen (Bezeichnung, «darf einchecken»).</li>
          <li>Auf dem Telefon die App «Vylaris Scanner» öffnen und «Gerät koppeln» wählen.</li>
          <li>Den angezeigten Kopplungs-QR-Code mit der App scannen. Alternativ Adresse der Website und Token von Hand eintippen.</li>
          <li>Das Token wird nur einmal angezeigt. Danach ist nur noch der Anfang des Tokens sichtbar; geht es verloren, legst du ein neues Gerät an.</li>
        </ol>
      </Card>

      <Notice variant="warning" className="mb-6">
        <strong className="font-semibold">Telefon verloren oder gestohlen?</strong> Sperre das Gerät hier sofort: Sein Token ist dann ungültig und es gibt keine Mitgliederdaten mehr heraus. Taucht das Telefon wieder auf, gibst du das Gerät mit «Wieder aktivieren» frei.
      </Notice>

      <ScannerManager devices={devices} serverUrl={site.url} canWrite={canAccess(admin.roles, "system", "write")} />
    </>
  );
}
