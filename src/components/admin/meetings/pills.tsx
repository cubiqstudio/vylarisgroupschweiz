import { cn } from "@/lib/utils";
import { PILL } from "@/components/admin/core/styles";
import {
  ATTENDANCE_STATUS_LABEL,
  MEETING_STATUS_LABEL,
  MEETING_STATUS_TONE,
  RESOLUTION_RESULT_LABEL,
  TONE_CLASS,
  labelOf,
  type MeetingStatus,
  type Tone,
} from "@/lib/verein/constants";
import { RSVP_LABEL } from "@/lib/verein/meetings-lib";

export function MeetingStatusPill({ status, className }: { status: string; className?: string }) {
  const tone = MEETING_STATUS_TONE[status as MeetingStatus] ?? "zinc";
  return <span className={cn(PILL, TONE_CLASS[tone], className)}>{labelOf(MEETING_STATUS_LABEL, status)}</span>;
}

const RESULT_TONE: Record<string, Tone> = { ANGENOMMEN: "green", ABGELEHNT: "rose", VERSCHOBEN: "amber" };

export function ResultPill({ result, className }: { result: string; className?: string }) {
  return <span className={cn(PILL, TONE_CLASS[RESULT_TONE[result] ?? "zinc"], className)}>{labelOf(RESOLUTION_RESULT_LABEL, result)}</span>;
}

/** Rückmeldung vor der Sitzung (leer = keine Antwort). */
export function RsvpPill({ rsvp, className }: { rsvp: string; className?: string }) {
  if (rsvp === "ZUSAGE") return <span className={cn(PILL, TONE_CLASS.green, className)}>{RSVP_LABEL.ZUSAGE}</span>;
  if (rsvp === "ABSAGE") return <span className={cn(PILL, TONE_CLASS.amber, className)}>{RSVP_LABEL.ABSAGE}</span>;
  return <span className={cn(PILL, TONE_CLASS.zinc, className)}>Keine Antwort</span>;
}

export function AttendancePill({ status, className }: { status: string; className?: string }) {
  const tone: Tone = status === "ANWESEND" ? "green" : status === "ENTSCHULDIGT" ? "amber" : "zinc";
  return <span className={cn(PILL, TONE_CLASS[tone], className)}>{labelOf(ATTENDANCE_STATUS_LABEL, status)}</span>;
}
