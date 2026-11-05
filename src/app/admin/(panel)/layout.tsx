import { db } from "@/lib/db";
import { requireAdminPage } from "@/lib/auth";
import { AdminShell } from "@/components/admin/core/admin-shell";
import { MustChangeBanner } from "@/components/admin/core/must-change-banner";

export const dynamic = "force-dynamic";

export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  const admin = await requireAdminPage();
  const [openTickets, pendingKeys, pendingWebspace] = await Promise.all([
    db.contactTicket.count({ where: { status: "OPEN" } }),
    db.licenseKey.count({ where: { status: "PENDING" } }),
    db.webspaceRequest.count({ where: { status: "PENDING" } }),
  ]);

  return (
    <AdminShell user={{ name: admin.name, email: admin.email, role: admin.role }} openTickets={openTickets} pendingLicenses={pendingKeys + pendingWebspace}>
      {admin.mustChangePassword && <MustChangeBanner />}
      {children}
    </AdminShell>
  );
}
