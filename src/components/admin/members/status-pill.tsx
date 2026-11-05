import { cn } from "@/lib/utils";
import { PILL } from "@/components/admin/core/styles";
import { MEMBER_STATUS_LABEL, MEMBER_STATUS_TONE, TONE_CLASS, labelOf, type MemberStatus } from "@/lib/verein/constants";

/** Status eines Mitglieds als Pille (Farben aus constants.ts). */
export function MemberStatusPill({ status, className }: { status: string; className?: string }) {
  const tone = MEMBER_STATUS_TONE[status as MemberStatus] ?? "zinc";
  return <span className={cn(PILL, TONE_CLASS[tone], className)}>{labelOf(MEMBER_STATUS_LABEL, status)}</span>;
}
