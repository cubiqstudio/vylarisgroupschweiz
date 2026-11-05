import { MessageSquare, Server, ShieldAlert, type LucideIcon } from "lucide-react";
import type { TicketCategory } from "@/lib/constants";

/** Symbole je Ticket-Kategorie (öffentliches Formular und Dashboard). */
export const TICKET_CATEGORY_ICON: Record<TicketCategory, LucideIcon> = {
  GENERAL: MessageSquare,
  B2B_HOSTING: Server,
  SECURITY_REPORT: ShieldAlert,
};

export function categoryIcon(category: string): LucideIcon {
  return (TICKET_CATEGORY_ICON as Record<string, LucideIcon>)[category] ?? MessageSquare;
}
