import { db } from "@/lib/db";
import { requireAdminPage } from "@/lib/auth";
import { AdminShell } from "@/components/admin/core/admin-shell";
import { MustChangeBanner } from "@/components/admin/core/must-change-banner";
import { canAccess } from "@/lib/verein/permissions";

export const dynamic = "force-dynamic";

export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  const admin = await requireAdminPage();
  // Zähler nur für Bereiche laden, die die Rolle sehen darf (kein unnötiger Datenzugriff auf fremde Module).
  const sees = (module: Parameters<typeof canAccess>[1]) => canAccess(admin.roles, module, "read");
  const [openTickets, pendingKeys, pendingWebspace, applications] = await Promise.all([
    sees("website") ? db.contactTicket.count({ where: { status: "OPEN" } }) : 0,
    sees("website") ? db.licenseKey.count({ where: { status: "PENDING" } }) : 0,
    sees("website") ? db.webspaceRequest.count({ where: { status: "PENDING" } }) : 0,
    sees("members") ? db.member.count({ where: { status: "ANTRAG" } }) : 0,
  ]);

  return (
    <AdminShell
      user={{ name: admin.name, email: admin.email, roles: admin.roles }}
      badges={{ tickets: openTickets, licenses: pendingKeys + pendingWebspace, applications }}
    >
      {admin.mustChangePassword && <MustChangeBanner />}
      {children}
    </AdminShell>
  );
}
