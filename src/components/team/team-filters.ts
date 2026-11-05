// Filter- und Sichtbarkeitsregeln des Team-Bereichs (reine Funktionen, ohne Server-Abhängigkeiten).
import { TICKET_CATEGORIES, type TicketCategory } from "@/lib/constants";
import { baseWhere, buildTicketQuery, parseTicketFilters, type TicketFilters } from "@/components/admin/content/ticket-filters";

/** Kategorien, die nur Admins sehen: Security-Reports sind für Teammitglieder weder sichtbar noch abrufbar. */
export const TEAM_HIDDEN_CATEGORIES: readonly string[] = ["SECURITY_REPORT"];

/** Kategorien, die im Team-Bereich angeboten werden. */
export const TEAM_CATEGORIES: readonly TicketCategory[] = TICKET_CATEGORIES.filter((c) => !TEAM_HIDDEN_CATEGORIES.includes(c));

export const isTeamVisibleCategory = (category: string) => !TEAM_HIDDEN_CATEGORIES.includes(category);

/** Grundbedingung für jede Ticket-Abfrage eines Teammitglieds. */
export const teamVisibleWhere = { category: { notIn: [...TEAM_HIDDEN_CATEGORIES] } };

export type TeamFilters = TicketFilters & {
  /** nur Tickets, die dem angemeldeten Teammitglied zugewiesen sind */
  mine: boolean;
};

type RawParams = Record<string, string | string[] | undefined>;

export function parseTeamFilters(sp: RawParams): TeamFilters {
  const base = parseTicketFilters(sp);
  const rawMine = Array.isArray(sp.mine) ? sp.mine[0] : sp.mine;
  return {
    ...base,
    // Eine ausgeblendete Kategorie wird wie "alle" behandelt, nicht wie ein Fehler.
    category: TEAM_HIDDEN_CATEGORIES.includes(base.category) ? "" : base.category,
    mine: rawMine === "1",
  };
}

/** Where-Bedingung ohne Statusfilter (für die Statuszähler); enthält immer die Sichtbarkeitsregel. */
export function teamBaseWhere(f: Pick<TeamFilters, "category" | "q" | "mine">, userId: string) {
  return {
    AND: [teamVisibleWhere, baseWhere({ category: f.category, q: f.q }), ...(f.mine ? [{ assignedToId: userId }] : [])],
  };
}

export function teamFullWhere(f: TeamFilters, userId: string) {
  return { AND: [teamBaseWhere(f, userId), ...(f.status ? [{ status: f.status }] : [])] };
}

/** Query-String ohne führendes "?"; Standardwerte werden weggelassen. */
export function buildTeamQuery(f: Partial<TeamFilters>): string {
  const p = new URLSearchParams(buildTicketQuery(f));
  if (f.mine) p.set("mine", "1");
  return p.toString();
}

export const TEAM_TICKETS_PATH = "/account/team/tickets";

export function teamTicketsHref(f: Partial<TeamFilters> = {}): string {
  const qs = buildTeamQuery(f);
  return qs ? `${TEAM_TICKETS_PATH}?${qs}` : TEAM_TICKETS_PATH;
}

/** Link auf ein Ticket; die Listenfilter werden als ?from= mitgegeben, damit "Zurück" sie wiederherstellt. */
export function teamTicketHref(id: string, f: Partial<TeamFilters> = {}): string {
  const qs = buildTeamQuery(f);
  return `${TEAM_TICKETS_PATH}/${encodeURIComponent(id)}${qs ? `?from=${encodeURIComponent(qs)}` : ""}`;
}
