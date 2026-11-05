import { db } from "@/lib/db";
import type { ComponentStatus } from "@/lib/constants";

export type OverallStatus = ComponentStatus;

/** Schlechtester Status gewinnt: OUTAGE > MAINTENANCE > OPERATIONAL. */
export function worstStatus(statuses: string[]): OverallStatus {
  if (statuses.includes("OUTAGE")) return "OUTAGE";
  if (statuses.includes("MAINTENANCE")) return "MAINTENANCE";
  return "OPERATIONAL";
}

export const OVERALL_HEADLINE: Record<OverallStatus, string> = {
  OPERATIONAL: "Alle Systeme betriebsbereit",
  MAINTENANCE: "Geplante Wartungsarbeiten",
  OUTAGE: "Aktuelle Störung",
};

export async function getOverallStatus(): Promise<OverallStatus> {
  const [metrics, services] = await Promise.all([
    db.systemMetric.findMany({ select: { status: true } }),
    db.saasService.findMany({ where: { comingSoon: false }, select: { status: true } }),
  ]);
  return worstStatus([...metrics, ...services].map((x) => x.status));
}

/** Für den Header-Badge: schlägt nie fehl (DB-Ausfall → null). */
export async function getOverallStatusSafe(): Promise<OverallStatus | null> {
  try {
    return await getOverallStatus();
  } catch {
    return null;
  }
}
