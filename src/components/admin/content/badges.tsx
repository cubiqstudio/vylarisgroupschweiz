import { CheckCircle2, CircleDot, Hourglass } from "lucide-react";
import { cn } from "@/lib/utils";
import { TICKET_CATEGORY_LABEL, TICKET_STATUS_LABEL, label } from "@/lib/constants";
import { categoryIcon } from "@/components/contact/ticket-category";

const base = "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset";

const TICKET_STATUS_STYLE: Record<string, { badge: string; icon: typeof CircleDot }> = {
  OPEN: { badge: "bg-amber-500/10 text-amber-300 ring-amber-500/30", icon: CircleDot },
  IN_PROGRESS: { badge: "bg-indigo-500/10 text-indigo-300 ring-indigo-500/30", icon: Hourglass },
  CLOSED: { badge: "bg-green-500/10 text-green-800 ring-green-600/30", icon: CheckCircle2 },
};

export function TicketStatusBadge({ status, className }: { status: string; className?: string }) {
  const s = TICKET_STATUS_STYLE[status] ?? TICKET_STATUS_STYLE.CLOSED;
  const Icon = s.icon;
  return (
    <span className={cn(base, s.badge, className)}>
      <Icon className="h-3 w-3" aria-hidden />
      {label(TICKET_STATUS_LABEL, status)}
    </span>
  );
}

export function TicketCategoryBadge({ category, className }: { category: string; className?: string }) {
  const text = label(TICKET_CATEGORY_LABEL, category);
  const Icon = categoryIcon(category);
  const tone =
    category === "SECURITY_REPORT"
      ? "bg-rose-500/10 text-rose-300 ring-rose-500/40"
      : category === "B2B_HOSTING"
        ? "bg-emerald-500/10 text-emerald-300 ring-emerald-500/30"
        : "bg-zinc-900 text-zinc-300 ring-zinc-700";
  return (
    <span className={cn(base, tone, className)}>
      <Icon className="h-3 w-3" aria-hidden />
      {text}
    </span>
  );
}

export function PostStatusBadge({ published, className }: { published: boolean; className?: string }) {
  return published ? (
    <span className={cn(base, "bg-emerald-500/10 text-emerald-300 ring-emerald-500/30", className)}>
      <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" aria-hidden />
      Veröffentlicht
    </span>
  ) : (
    <span className={cn(base, "bg-zinc-800/80 text-zinc-400 ring-zinc-700", className)}>
      <span className="h-1.5 w-1.5 rounded-full bg-zinc-500" aria-hidden />
      Entwurf
    </span>
  );
}
