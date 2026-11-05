import { db } from "@/lib/db";
import { handle, requireAdmin } from "@/lib/api";
import { STATUSES } from "@/lib/constants";
import { getOverallStatus } from "@/lib/status";
import { adminOk } from "../../_lib/http";

export const dynamic = "force-dynamic";

export const GET = handle(async (req: Request) => {
  await requireAdmin(req);

  const [openTickets, inProgressTickets, totalTickets, serviceGroups, publishedPosts, draftPosts, activeIncidents, overall, pendingLicenseKeys, pendingWebspaceRequests] =
    await Promise.all([
      db.contactTicket.count({ where: { status: "OPEN" } }),
      db.contactTicket.count({ where: { status: "IN_PROGRESS" } }),
      db.contactTicket.count(),
      db.saasService.groupBy({ by: ["status"], where: { comingSoon: false }, _count: { _all: true } }),
      db.blogPost.count({ where: { published: true } }),
      db.blogPost.count({ where: { published: false } }),
      db.incident.count({ where: { status: { not: "RESOLVED" } } }),
      getOverallStatus(),
      db.licenseKey.count({ where: { status: "PENDING" } }),
      db.webspaceRequest.count({ where: { status: "PENDING" } }),
    ]);

  const servicesByStatus: Record<string, number> = Object.fromEntries(STATUSES.map((s) => [s, 0]));
  let serviceCount = 0;
  for (const g of serviceGroups) {
    servicesByStatus[g.status] = (servicesByStatus[g.status] ?? 0) + g._count._all;
    serviceCount += g._count._all;
  }

  return adminOk({
    openTickets,
    inProgressTickets,
    totalTickets,
    serviceCount,
    servicesByStatus,
    overall,
    publishedPosts,
    draftPosts,
    activeIncidents,
    pendingLicenseKeys,
    pendingWebspaceRequests,
    pendingLicenses: pendingLicenseKeys + pendingWebspaceRequests,
  });
});
