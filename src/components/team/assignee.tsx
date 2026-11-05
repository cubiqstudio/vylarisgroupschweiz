import { UserRound } from "lucide-react";
import { Avatar } from "@/components/account/avatar";
import { cn } from "@/lib/utils";

export type AssigneeUser = { id: string; name: string; avatarType: string | null };

/** Zuständiges Teammitglied mit Profilbild (ohne Bild: Initialen); ohne Zuständigkeit ein dezenter Hinweis. */
export function AssigneeChip({ user, size = 28, className }: { user: AssigneeUser | null; size?: number; className?: string }) {
  if (!user) {
    return (
      <span className={cn("inline-flex items-center gap-2 text-xs text-zinc-500", className)}>
        <span
          aria-hidden
          style={{ width: size, height: size }}
          className="inline-flex shrink-0 items-center justify-center rounded-full border border-dashed border-zinc-700 text-zinc-500"
        >
          <UserRound className="size-3.5" />
        </span>
        Niemand zuständig
      </span>
    );
  }
  return (
    <span className={cn("inline-flex min-w-0 items-center gap-2 text-xs text-zinc-300", className)}>
      <Avatar name={user.name} userId={user.id} hasImage={!!user.avatarType} size={size} />
      <span className="truncate">{user.name}</span>
    </span>
  );
}
