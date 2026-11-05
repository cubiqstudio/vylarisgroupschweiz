// Wirksame Rechtematrix laden (nur auf dem Server; Speichern: ./permissions-save.ts, ohne Abhängigkeit zu api.ts, damit auth.ts es nutzen kann). Die Abweichungen von der Voreinstellung liegen in SiteSetting
// «verein.permissions.v1» (Format und Prüfung: ./permissions-config.ts). Gelesen wird mit kurzem Zwischenspeicher (15 Sekunden);
// Speichern macht ihn in diesem Prozess sofort ungültig. Läuft die Software auf mehreren Instanzen, gilt eine Änderung dort
// spätestens nach 15 Sekunden. Bei jedem Lesefehler und bei beschädigten Daten gilt die Voreinstellung (nie mehr Rechte als erlaubt).
import "server-only";
import { db } from "@/lib/db";
import { PERMISSIONS_SETTING_KEY, matrixFromStored } from "./permissions-config";
import { DEFAULT_MATRIX, type EffectiveMatrix } from "./permissions";

const TTL_MS = 15_000;

let cached: { at: number; matrix: EffectiveMatrix } | null = null;
let inflight: Promise<EffectiveMatrix> | null = null;
/** Zählt Speichervorgänge: ein Lesevorgang, der vor einem Speichern begann, darf den Zwischenspeicher nicht mehr füllen. */
let generation = 0;

/** Zwischenspeicher verwerfen (nach dem Speichern und in Tests). */
export function invalidatePermissionsCache(): void {
  generation += 1;
  cached = null;
  inflight = null;
}

/** Gespeicherten Text lesen; null, wenn nichts gespeichert ist. Wirft bei Datenbankfehlern. */
async function readStored(): Promise<string | null> {
  const row = await db.siteSetting.findUnique({ where: { key: PERMISSIONS_SETTING_KEY }, select: { value: true } });
  return row?.value ?? null;
}

/**
 * Die wirksame Matrix. Mit `fresh: true` wird der Zwischenspeicher umgangen. Fehler beim Lesen ergeben die Voreinstellung
 * (und werden nicht zwischengespeichert).
 */
export async function getEffectiveMatrix(opts: { fresh?: boolean } = {}): Promise<EffectiveMatrix> {
  if (!opts.fresh) {
    if (cached && Date.now() - cached.at < TTL_MS) return cached.matrix;
    if (inflight) return inflight;
  }
  const gen = generation;
  const load: Promise<EffectiveMatrix> = (async () => {
    try {
      const matrix = matrixFromStored(await readStored());
      if (gen === generation) cached = { at: Date.now(), matrix };
      return matrix;
    } catch {
      console.error("[rechte] Rollenrechte konnten nicht gelesen werden, es gilt die Voreinstellung.");
      return DEFAULT_MATRIX;
    }
  })();
  if (opts.fresh) return load;
  inflight = load;
  try {
    return await load;
  } finally {
    if (inflight === load) inflight = null;
  }
}
