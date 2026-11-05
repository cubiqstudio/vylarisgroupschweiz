// Gemeinsame Filter-Logik für Ticket-Inbox und Ticket-Detail (reine Funktionen, keine Server-Abhängigkeiten).
import { TICKET_CATEGORIES, TICKET_STATUSES, type TicketCategory, type TicketStatus } from "@/lib/constants";
import { containsCI } from "@/lib/search";

export const TICKET_PAGE_SIZE = 25;

export type TicketFilters = {
  status: TicketStatus | "";
  category: TicketCategory | "";
  q: string;
  page: number;
};

type RawParams = Record<string, string | string[] | undefined>;

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

export function parseTicketFilters(sp: RawParams): TicketFilters {
  const status = first(sp.status);
  const category = first(sp.category);
  const page = Number.parseInt(first(sp.page), 10);
  return {
    status: (TICKET_STATUSES as readonly string[]).includes(status) ? (status as TicketStatus) : "",
    category: (TICKET_CATEGORIES as readonly string[]).includes(category) ? (category as TicketCategory) : "",
    q: first(sp.q).trim().slice(0, 100),
    page: Number.isFinite(page) && page > 0 ? Math.min(page, 100_000) : 1,
  };
}

/** Where-Bedingung ohne Statusfilter (für die Statuszähler der Tabs). */
export function baseWhere(f: Pick<TicketFilters, "category" | "q">) {
  return {
    ...(f.category ? { category: f.category } : {}),
    ...(f.q
      ? {
          OR: [
            { ticketNumber: containsCI(f.q) },
            { name: containsCI(f.q) },
            { email: containsCI(f.q) },
            { subject: containsCI(f.q) },
          ],
        }
      : {}),
  };
}

export function fullWhere(f: TicketFilters) {
  return { ...baseWhere(f), ...(f.status ? { status: f.status } : {}) };
}

/** Baut den Query-String (ohne führendes "?"); Standardwerte werden weggelassen. */
export function buildTicketQuery(f: Partial<TicketFilters>): string {
  const p = new URLSearchParams();
  if (f.status) p.set("status", f.status);
  if (f.category) p.set("category", f.category);
  if (f.q) p.set("q", f.q);
  if (f.page && f.page > 1) p.set("page", String(f.page));
  return p.toString();
}

export function inboxHref(f: Partial<TicketFilters>): string {
  const qs = buildTicketQuery(f);
  return qs ? `/admin/tickets?${qs}` : "/admin/tickets";
}
