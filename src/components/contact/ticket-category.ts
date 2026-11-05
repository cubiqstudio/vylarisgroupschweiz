import { CreditCard, MessageSquare, Server, ShieldAlert, Users, type LucideIcon } from "lucide-react";

/** Symbole je Ticket-Kategorie (öffentliches Formular und Dashboard). Unbekannte Kategorien fallen auf das allgemeine Symbol zurück. */
export const TICKET_CATEGORY_ICON: Record<string, LucideIcon> = {
  GENERAL: MessageSquare,
  MEMBERSHIP: Users,
  BILLING: CreditCard,
  B2B_HOSTING: Server,
  SECURITY_REPORT: ShieldAlert,
};

export function categoryIcon(category: string): LucideIcon {
  return TICKET_CATEGORY_ICON[category] ?? MessageSquare;
}
