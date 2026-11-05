import { cn } from "@/lib/utils";
import { PILL } from "@/components/admin/core/styles";
import { KEY_STATUS_LABEL, REQUEST_STATUS_LABEL, STATUS_TONE } from "./types";

/** Status eines Schlüssels (kind="key") oder eines Webspace-Antrags (kind="request"). */
export function StatusPill({ status, kind = "key" }: { status: string; kind?: "key" | "request" }) {
  const labels = kind === "key" ? KEY_STATUS_LABEL : REQUEST_STATUS_LABEL;
  return <span className={cn(PILL, STATUS_TONE[status] ?? STATUS_TONE.REJECTED)}>{labels[status] ?? status}</span>;
}
