import { db } from "@/lib/db";
import { handle } from "@/lib/api";
import { requireTeamMember } from "@/lib/team";
import { TICKET_PAGE_SIZE } from "@/components/admin/content/ticket-filters";
import { parseTeamFilters, teamFullWhere } from "@/components/team/team-filters";
import { adminOk } from "../../../_lib/http";

export const dynamic = "force-dynamic";

/** Ticketliste für Teammitglieder (ohne Security-Reports). Filter wie auf der Seite: status, category, q, mine, page. */
export const GET = handle(async (req: Request) => {
  const user = await requireTeamMember(req);
  const sp = Object.fromEntries(new URL(req.url).searchParams);
  const filters = parseTeamFilters(sp);
  const where = teamFullWhere(filters, user.id);

  const [items, total] = await Promise.all([
    db.contactTicket.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: { assignedTo: { select: { id: true, name: true, avatarType: true } } },
      skip: (filters.page - 1) * TICKET_PAGE_SIZE,
      take: TICKET_PAGE_SIZE,
    }),
    db.contactTicket.count({ where }),
  ]);

  return adminOk({ items, total, page: filters.page, pageSize: TICKET_PAGE_SIZE });
});
