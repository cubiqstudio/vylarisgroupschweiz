#!/bin/sh
# =============================================================================
# VylarisGroupEurope – Container-Entrypoint
#
# Ablauf:
#   1. Wartet, bis die Datenbank erreichbar ist (Retry ueber "prisma db push").
#   2. Legt/aktualisiert das Datenbankschema (prisma db push --skip-generate).
#   3. Fuehrt optional den Seed aus (SEED_ON_START=true).
#   4. Startet den uebergebenen Befehl (Standard: node server.js) per exec,
#      damit SIGTERM/SIGINT direkt beim Node-Prozess ankommen.
#
# SEED_ON_START:
#   Der Seed ist idempotent (upsert, "update: {}" bei Inhalten) und ueberschreibt
#   keine Aenderungen aus dem Admin-Bereich. In docker-compose.yml ist der Default
#   "true", damit beim ersten Start Admin-Konto und Basisinhalte angelegt werden.
#   Nach dem ersten Start kann SEED_ON_START=false gesetzt werden.
#
# Weitere Variablen:
#   DB_WAIT_TIMEOUT  Maximale Wartezeit auf die Datenbank in Sekunden (Default 60)
#   DB_WAIT_INTERVAL Pause zwischen zwei Versuchen in Sekunden (Default 3)
# =============================================================================
set -e

log() { printf '[entrypoint] %s\n' "$*"; }

PRISMA="node node_modules/prisma/build/index.js"
TSX="node node_modules/tsx/dist/cli.mjs"
DB_WAIT_TIMEOUT="${DB_WAIT_TIMEOUT:-60}"
DB_WAIT_INTERVAL="${DB_WAIT_INTERVAL:-3}"

if [ -z "${DATABASE_URL:-}" ]; then
  log "FEHLER: DATABASE_URL ist nicht gesetzt." >&2
  exit 1
fi

# --- 1 + 2: Datenbank erreichbar? Schema anwenden ----------------------------
log "Warte auf die Datenbank und wende das Schema an (max. ${DB_WAIT_TIMEOUT}s) ..."
elapsed=0
attempt=1
while :; do
  if out=$($PRISMA db push --skip-generate 2>&1); then
    printf '%s\n' "$out"
    log "Datenbankschema ist aktuell."
    break
  fi
  if [ "$elapsed" -ge "$DB_WAIT_TIMEOUT" ]; then
    printf '%s\n' "$out" >&2
    log "FEHLER: Datenbank nach ${DB_WAIT_TIMEOUT}s nicht erreichbar oder Schema-Migration fehlgeschlagen." >&2
    log "Pruefe DATABASE_URL, Zugangsdaten (Sonderzeichen im Passwort URL-kodieren) und das db-Log." >&2
    exit 1
  fi
  log "Versuch ${attempt} fehlgeschlagen, neuer Versuch in ${DB_WAIT_INTERVAL}s ..."
  sleep "$DB_WAIT_INTERVAL"
  elapsed=$((elapsed + DB_WAIT_INTERVAL))
  attempt=$((attempt + 1))
done

# --- 3: Seed (optional, idempotent) -----------------------------------------
if [ "${SEED_ON_START:-false}" = "true" ]; then
  log "SEED_ON_START=true: fuehre idempotenten Seed aus ..."
  $TSX prisma/seed.ts
  log "Seed abgeschlossen."
else
  log "Seed uebersprungen (SEED_ON_START != true)."
fi

# --- 4: Anwendung starten ----------------------------------------------------
log "Starte: $*"
exec "$@"
