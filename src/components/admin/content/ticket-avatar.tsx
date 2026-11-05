import { cn } from "@/lib/utils";
import { avatarTone, initials } from "./ticket-format";

/** Runder Avatar mit den Initialen des Absenders (rein dekorativ, der Name steht daneben). */
export function TicketAvatar({ name, className }: { name: string; className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "flex size-10 shrink-0 select-none items-center justify-center rounded-full text-sm font-semibold ring-1 ring-inset",
        avatarTone(name),
        className,
      )}
    >
      {initials(name)}
    </span>
  );
}
