import { PILL } from "@/components/admin/core/styles";
import { EVENT_STATUS_LABEL, EVENT_STATUS_TONE, TONE_CLASS, labelOf, type EventStatus } from "@/lib/verein/constants";
import { cn } from "@/lib/utils";

/** Status eines Anlasses als Pille (Farben aus constants.ts). */
export function EventStatusPill({ status, className }: { status: string; className?: string }) {
  const tone = EVENT_STATUS_TONE[status as EventStatus] ?? "zinc";
  return <span className={cn(PILL, TONE_CLASS[tone], className)}>{labelOf(EVENT_STATUS_LABEL, status)}</span>;
}

/** Kurzbeschreibung der Sichtbarkeit. */
export function visibilityLabel(isPublic: boolean, membersOnly: boolean): string {
  if (!isPublic) return "Nur Mitglieder";
  return membersOnly ? "Öffentlich, Anmeldung nur Mitglieder" : "Öffentlich, Gäste willkommen";
}
