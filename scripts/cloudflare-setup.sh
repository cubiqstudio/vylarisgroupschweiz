#!/usr/bin/env bash
# =============================================================================
# VylarisGroup – Cloudflare-Tunnel einrichten
#
# Legt (idempotent) per Cloudflare-API an:
#   1. einen Tunnel ("vylaris-group") mit Ingress-Regeln: je Domain und www.<Domain> → http://app:3000
#   2. je Domain (Apex) und www einen proxied CNAME-Eintrag auf <tunnel-id>.cfargotunnel.com
# und trägt den Tunnel-Token als CLOUDFLARE_TUNNEL_TOKEN in die .env ein (Rechte 600).
#
# Der API-Token wird aus CLOUDFLARE_API_TOKEN gelesen oder verdeckt abgefragt. Er wird nie ausgegeben,
# nie in eine Datei geschrieben und nie als Prozessargument übergeben (curl bekommt den Header über eine
# Konfiguration per Dateideskriptor). Nach dem Lauf wird er nicht mehr gebraucht.
#
# Benötigte Token-Rechte:
#   Account → Cloudflare Tunnel: Bearbeiten
#   Zone    → DNS: Bearbeiten
#   Zone    → Zone: Lesen
#
# Aufruf:
#   scripts/cloudflare-setup.sh [--dry-run] [--domains "a.eu b.de c.net"] [--tunnel-name NAME]
#                               [--replace] [--env-file PFAD]
#
# Exit-Codes: 0 = ok · 1 = Fehler · 2 = falscher Aufruf · 3 = Konflikt mit vorhandenen DNS-Einträgen
# =============================================================================
set -euo pipefail
{ set +x; } 2>/dev/null # niemals per xtrace mitschreiben (der Token steckt in einer Variablen)

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
API_BASE="${CLOUDFLARE_API_BASE:-https://api.cloudflare.com/client/v4}"
API_BASE="${API_BASE%/}"
ORIGIN_SERVICE="${CLOUDFLARE_ORIGIN_SERVICE:-http://app:3000}"
DEFAULT_DOMAINS="vylaris.eu vylaris.de vylaris.net"
TUNNEL_NAME="vylaris-group"
ENV_FILE="${ENV_FILE:-$SCRIPT_DIR/../.env}"
DOMAINS="${CLOUDFLARE_DOMAINS:-}"
DRY_RUN=0
REPLACE=0
EXIT_CONFLICT=3
RIGHTS="Account → Cloudflare Tunnel: Bearbeiten · Zone → DNS: Bearbeiten · Zone → Zone: Lesen"

# --- Ausgabe -----------------------------------------------------------------
if [ -t 1 ]; then
  C_RED=$'\033[31m'; C_GRN=$'\033[32m'; C_YEL=$'\033[33m'; C_BLU=$'\033[36m'; C_BLD=$'\033[1m'; C_OFF=$'\033[0m'
else
  C_RED=""; C_GRN=""; C_YEL=""; C_BLU=""; C_BLD=""; C_OFF=""
fi
log()  { printf '%s➜%s %s\n' "$C_BLU" "$C_OFF" "$*"; }
ok()   { printf '%s✔%s %s\n' "$C_GRN" "$C_OFF" "$*"; }
warn() { printf '%s!%s %s\n' "$C_YEL" "$C_OFF" "$*" >&2; }
die()  { printf '%s✘ %s%s\n' "$C_RED" "$*" "$C_OFF" >&2; exit 1; }
plan() { printf '%s[Probelauf]%s %s\n' "$C_YEL" "$C_OFF" "$*"; }

usage() {
  cat <<'EOF'
Cloudflare-Tunnel für die Vylaris-Domains einrichten.

Verwendung: cloudflare-setup.sh [Optionen]

Optionen:
  --dry-run              Nur lesen und anzeigen, was geändert würde (nichts wird angelegt/geschrieben)
  --domains "a b c"      Domains (Standard: vylaris.eu vylaris.de vylaris.net bzw. CLOUDFLARE_DOMAINS aus der .env)
  --tunnel-name NAME     Name des Tunnels (Standard: vylaris-group)
  --replace              Vorhandene A/AAAA/CNAME-Einträge gleichen Namens ersetzen (sonst Abbruch bei Konflikt)
  --env-file PFAD        .env, in die CLOUDFLARE_TUNNEL_TOKEN geschrieben wird (Standard: <Projekt>/.env)
  -h, --help             Diese Hilfe

Der API-Token kommt aus CLOUDFLARE_API_TOKEN oder wird verdeckt abgefragt. Er wird nicht gespeichert.
Benötigte Rechte: Account → Cloudflare Tunnel: Bearbeiten · Zone → DNS: Bearbeiten · Zone → Zone: Lesen
Test-Umgebung: CLOUDFLARE_API_BASE überschreibt die API-Adresse (nur https oder localhost).
EOF
}

# --- Argumente -----------------------------------------------------------------
while [ $# -gt 0 ]; do
  case "$1" in
    --dry-run)     DRY_RUN=1 ;;
    --replace)     REPLACE=1 ;;
    --domains)     [ $# -ge 2 ] || { warn "--domains braucht einen Wert"; exit 2; }; DOMAINS="$2"; shift ;;
    --tunnel-name) [ $# -ge 2 ] || { warn "--tunnel-name braucht einen Wert"; exit 2; }; TUNNEL_NAME="$2"; shift ;;
    --env-file)    [ $# -ge 2 ] || { warn "--env-file braucht einen Wert"; exit 2; }; ENV_FILE="$2"; shift ;;
    -h|--help)     usage; exit 0 ;;
    *) warn "Unbekannte Option: $1 (siehe --help)"; exit 2 ;;
  esac
  shift
done

for c in curl jq awk; do
  command -v "$c" >/dev/null 2>&1 || die "Das Programm '$c' fehlt – bitte installieren (z. B. apt-get install $c)."
done

# --- .env-Helfer (wie in install.sh) ---------------------------------------------
env_get() { { grep -E "^$1=" "$ENV_FILE" 2>/dev/null || true; } | tail -n1 | cut -d= -f2-; }
env_set() { # env_set KEY VALUE – ersetzt oder hängt an (ohne sed-Escaping-Probleme)
  local tmp; tmp=$(mktemp)
  K="$1" V="$2" awk 'BEGIN{k=ENVIRON["K"]; v=ENVIRON["V"]; d=0}
    index($0,k"=")==1 {print k"="v; d=1; next} {print}
    END{if(!d) print k"="v}' "$ENV_FILE" >"$tmp"
  cat "$tmp" >"$ENV_FILE"; rm -f "$tmp"
}

# --- Eingaben prüfen -------------------------------------------------------------
valid_domain() {
  [[ "$1" =~ ^([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+(xn--[a-z0-9-]{2,59}|[a-z]{2,63})$ ]]
}

[[ "$TUNNEL_NAME" =~ ^[A-Za-z0-9._-]{1,64}$ ]] || die "Ungültiger Tunnel-Name (erlaubt: Buchstaben, Ziffern, . _ -)."

# Basis-URL: Der Token darf nur über HTTPS (oder an localhost für Tests) gesendet werden.
LOOPBACK=0
case "$API_BASE" in
  https://*) ;;
  http://127.0.0.1|http://127.0.0.1:*|http://localhost|http://localhost:*) LOOPBACK=1 ;;
  *) die "CLOUDFLARE_API_BASE muss mit https:// beginnen (http:// nur für localhost)." ;;
esac

if [ -z "${DOMAINS// /}" ] && [ -f "$ENV_FILE" ]; then DOMAINS=$(env_get CLOUDFLARE_DOMAINS); fi
[ -n "${DOMAINS// /}" ] || DOMAINS="$DEFAULT_DOMAINS"
DOMAIN_LIST=()
for d in ${DOMAINS//,/ }; do
  d="${d,,}"; d="${d#https://}"; d="${d#http://}"; d="${d%%/*}"; d="${d#www.}"; d="${d%.}"
  valid_domain "$d" || die "'$d' ist keine gültige Domain."
  dup=0; for e in "${DOMAIN_LIST[@]+"${DOMAIN_LIST[@]}"}"; do [ "$e" = "$d" ] && dup=1; done
  [ "$dup" -eq 1 ] || DOMAIN_LIST+=("$d")
done
[ "${#DOMAIN_LIST[@]}" -gt 0 ] || die "Keine Domain angegeben."

# --- Token einlesen ----------------------------------------------------------------
CF_TOKEN="${CLOUDFLARE_API_TOKEN:-}"
unset CLOUDFLARE_API_TOKEN # Kindprozesse (curl, jq) sollen den Token nicht erben
if [ -z "$CF_TOKEN" ]; then
  if (: </dev/tty) 2>/dev/null; then
    printf 'Benötigte Token-Rechte: %s\n' "$RIGHTS" >&2
    read -rs -p "Cloudflare-API-Token (Eingabe bleibt unsichtbar): " CF_TOKEN </dev/tty || true
    printf '\n' >&2
  else
    die "Kein Cloudflare-API-Token: Umgebungsvariable CLOUDFLARE_API_TOKEN setzen oder das Skript in einem Terminal starten."
  fi
fi
CF_TOKEN="${CF_TOKEN//[[:space:]]/}"
[ -n "$CF_TOKEN" ] || die "Kein Cloudflare-API-Token eingegeben."
[[ "$CF_TOKEN" =~ ^[A-Za-z0-9_-]{8,}$ ]] || die "Der Token enthält ungültige Zeichen oder ist zu kurz (erwartet: Buchstaben, Ziffern, - und _)."

# --- Aufräumen -----------------------------------------------------------------------
ERR_FILE=$(mktemp)
cleanup() { rm -f "$ERR_FILE"; }
trap cleanup EXIT

# --- API-Zugriff ------------------------------------------------------------------------
CF_CODE=""
CF_BODY=""

# cf METHOD PFAD [JSON]: setzt CF_CODE und CF_BODY. Der Authorization-Header wird curl über einen
# Dateideskriptor (process substitution) als Konfiguration übergeben – er taucht in keiner Prozessliste auf.
cf() {
  local method="$1" path="$2" body="${3-}" out rc=0
  local args=(-sS --max-time 30 -X "$method" -H "Content-Type: application/json" -H "Accept: application/json" -w $'\n%{http_code}')
  [ "$LOOPBACK" -eq 1 ] && args+=(--noproxy '*')
  if [ -n "$body" ]; then
    out=$(printf '%s' "$body" | curl --config <(printf 'header = "Authorization: Bearer %s"\n' "$CF_TOKEN") \
      "${args[@]}" --data-binary @- "$API_BASE$path" 2>"$ERR_FILE") || rc=$?
  else
    out=$(curl --config <(printf 'header = "Authorization: Bearer %s"\n' "$CF_TOKEN") \
      "${args[@]}" "$API_BASE$path" 2>"$ERR_FILE" </dev/null) || rc=$?
  fi
  if [ "$rc" -ne 0 ]; then
    die "Die Cloudflare-API ist nicht erreichbar (curl-Exit $rc): $(tr '\n' ' ' <"$ERR_FILE")
   Internetverbindung, Proxy-Einstellungen und CLOUDFLARE_API_BASE prüfen."
  fi
  CF_CODE="${out##*$'\n'}"
  CF_BODY="${out%$'\n'*}"
}

api_errors() { jq -r '[.errors[]? | "\(.code): \(.message)"] | join("; ")' <<<"$CF_BODY" 2>/dev/null || true; }
api_ok() { [[ "$CF_CODE" =~ ^2[0-9][0-9]$ ]] && jq -e '.success == true' <<<"$CF_BODY" >/dev/null 2>&1; }

# api_fail KONTEXT RECHT: verständliche deutsche Fehlermeldung (der Token wird nie ausgegeben)
api_fail() {
  local ctx="$1" need="$2" errs invalid=0
  errs=$(api_errors)
  if jq -e '[.errors[]?.code] | any(. == 1000 or . == 6003 or . == 6111 or . == 9106 or . == 9109)' <<<"$CF_BODY" >/dev/null 2>&1; then invalid=1; fi
  if [ "$CF_CODE" = 401 ] || [ "$invalid" -eq 1 ]; then
    die "Cloudflare lehnt den API-Token ab (ungültig, abgelaufen oder widerrufen)${errs:+ – $errs}.
   Neuen Token erstellen unter https://dash.cloudflare.com/profile/api-tokens
   (benötigte Rechte: $RIGHTS)."
  elif [ "$CF_CODE" = 403 ]; then
    die "Dem API-Token fehlt eine Berechtigung für: $ctx${errs:+ ($errs)}.
   Benötigt wird: $need
   Alle Rechte des Tokens: $RIGHTS
   (Zonen-Rechte müssen die betroffene Domain einschließen, Account-Rechte den richtigen Account.)"
  elif ! jq -e . <<<"$CF_BODY" >/dev/null 2>&1; then
    die "Unerwartete Antwort der Cloudflare-API bei '$ctx' (HTTP $CF_CODE, kein JSON)."
  fi
  die "Cloudflare meldet einen Fehler bei '$ctx' (HTTP $CF_CODE)${errs:+: $errs}."
}

# api METHOD PFAD JSON KONTEXT RECHT: führt aus, bricht bei Fehlern mit Meldung ab
api() {
  cf "$1" "$2" "$3"
  api_ok || api_fail "$4" "$5"
}

# --- 1. Token prüfen ---------------------------------------------------------------------
log "Prüfe den API-Token …"
cf GET /user/tokens/verify
if api_ok; then
  status=$(jq -r '.result.status // "unknown"' <<<"$CF_BODY")
  [ "$status" = "active" ] || die "Der API-Token ist nicht aktiv (Status: $status). Bitte einen neuen Token erstellen: https://dash.cloudflare.com/profile/api-tokens"
else
  # Account-eigene Tokens kennen /user/tokens/verify nicht: Gültigkeit stattdessen über die Zonenliste prüfen.
  cf GET "/zones?per_page=1"
  api_ok || api_fail "Token prüfen" "Zone → Zone: Lesen"
fi
ok "API-Token akzeptiert"

# Vorab: Ziel-.env schreibbar?
if [ "$DRY_RUN" -eq 0 ]; then
  if [ -e "$ENV_FILE" ]; then
    [ -w "$ENV_FILE" ] || die "Die Datei $ENV_FILE ist nicht beschreibbar."
  else
    [ -d "$(dirname "$ENV_FILE")" ] && [ -w "$(dirname "$ENV_FILE")" ] || die "Das Verzeichnis für $ENV_FILE existiert nicht oder ist nicht beschreibbar."
  fi
fi

# --- 2. Zonen ermitteln -------------------------------------------------------------------
declare -A ZONE_ID
ACCOUNT_ID=""
log "Ermittle die Zonen (${DOMAIN_LIST[*]}) …"
for d in "${DOMAIN_LIST[@]}"; do
  api GET "/zones?name=$d&per_page=5" "" "Zone $d lesen" "Zone → Zone: Lesen (für $d)"
  zid=$(jq -r --arg d "$d" '[.result[]? | select(.name == $d)][0].id // empty' <<<"$CF_BODY")
  acc=$(jq -r --arg d "$d" '[.result[]? | select(.name == $d)][0].account.id // empty' <<<"$CF_BODY")
  zstatus=$(jq -r --arg d "$d" '[.result[]? | select(.name == $d)][0].status // empty' <<<"$CF_BODY")
  [ -n "$zid" ] || die "Die Zone $d wurde nicht gefunden. Die Domain muss bei Cloudflare angelegt sein (Nameserver bei der Registrierung auf Cloudflare gestellt) und der Token muss sie lesen dürfen (Zone → Zone: Lesen, Zonen-Auswahl prüfen)."
  [ -n "$acc" ] || die "Zu $d wurde keine Account-ID geliefert."
  if [ -n "$ACCOUNT_ID" ] && [ "$ACCOUNT_ID" != "$acc" ]; then
    die "Die Domains liegen in verschiedenen Cloudflare-Accounts ($d). Ein Tunnel kann nur Domains desselben Accounts bedienen."
  fi
  ACCOUNT_ID="$acc"
  ZONE_ID[$d]="$zid"
  [ -z "$zstatus" ] || [ "$zstatus" = "active" ] || warn "Die Zone $d hat den Status '$zstatus' (Nameserver noch nicht auf Cloudflare umgestellt?) – sie ist erst erreichbar, wenn sie 'active' ist."
done
ok "Alle Zonen gefunden (Account ${ACCOUNT_ID:0:6}…)"

# --- 3. Tunnel suchen --------------------------------------------------------------------
TUNNEL_ID=""
api GET "/accounts/$ACCOUNT_ID/cfd_tunnel?name=$TUNNEL_NAME&is_deleted=false" "" "Tunnel suchen" "Account → Cloudflare Tunnel: Bearbeiten"
TUNNEL_ID=$(jq -r --arg n "$TUNNEL_NAME" '[.result[]? | select(.name == $n and (.deleted_at // null) == null)][0].id // empty' <<<"$CF_BODY")
if [ -n "$TUNNEL_ID" ]; then
  src=$(jq -r --arg n "$TUNNEL_NAME" '[.result[]? | select(.name == $n)][0].config_src // "cloudflare"' <<<"$CF_BODY")
  [ "$src" = "cloudflare" ] || die "Der Tunnel '$TUNNEL_NAME' wird lokal konfiguriert (config_src=$src) und lässt sich nicht per API verwalten. Anderen Namen mit --tunnel-name wählen oder den Tunnel im Dashboard löschen."
  ok "Tunnel '$TUNNEL_NAME' vorhanden (${TUNNEL_ID:0:8}…)"
else
  log "Tunnel '$TUNNEL_NAME' ist noch nicht vorhanden."
fi

# --- 4. DNS planen (vor jeder Änderung, damit ein Konflikt nichts halb erledigt hinterlässt) -------
if [ -n "$TUNNEL_ID" ]; then TARGET="$TUNNEL_ID.cfargotunnel.com"; else TARGET="<neue-tunnel-id>.cfargotunnel.com"; fi

HOSTS=()
declare -A H_ZONE H_ACTION H_RECORD H_DELETE H_DESC
CONFLICTS=()
log "Prüfe vorhandene DNS-Einträge …"
for d in "${DOMAIN_LIST[@]}"; do
  for host in "$d" "www.$d"; do
    HOSTS+=("$host")
    H_ZONE[$host]="${ZONE_ID[$d]}"
    api GET "/zones/${ZONE_ID[$d]}/dns_records?name=$host&per_page=100" "" "DNS-Einträge von $host lesen" "Zone → DNS: Bearbeiten (für $d)"
    existing=$(jq -c --arg h "$host" '[.result[]? | select(.name == $h and (.type == "A" or .type == "AAAA" or .type == "CNAME"))]' <<<"$CF_BODY")
    count=$(jq 'length' <<<"$existing")
    H_RECORD[$host]=""; H_DELETE[$host]=""; H_DESC[$host]=""
    if [ "$count" -eq 0 ]; then
      H_ACTION[$host]="create"
      continue
    fi
    H_DESC[$host]=$(jq -r '[.[] | "\(.type) \(.content)\(if .proxied then " (proxied)" else "" end)"] | join(", ")' <<<"$existing")
    if [ "$count" -eq 1 ] && jq -e --arg t "$TARGET" '.[0].type == "CNAME" and .[0].content == $t' <<<"$existing" >/dev/null; then
      if jq -e '.[0].proxied == true' <<<"$existing" >/dev/null; then
        H_ACTION[$host]="keep"
      else
        H_ACTION[$host]="update"; H_RECORD[$host]=$(jq -r '.[0].id' <<<"$existing")
      fi
      continue
    fi
    # Konflikt: A/AAAA/CNAME mit anderem Inhalt
    if [ "$REPLACE" -eq 1 ]; then
      if [ "$count" -eq 1 ] && jq -e '.[0].type == "CNAME"' <<<"$existing" >/dev/null; then
        H_ACTION[$host]="update"; H_RECORD[$host]=$(jq -r '.[0].id' <<<"$existing")
      else
        H_ACTION[$host]="replace"; H_DELETE[$host]=$(jq -r '[.[].id] | join(" ")' <<<"$existing")
      fi
    else
      H_ACTION[$host]="conflict"
      CONFLICTS+=("$host: ${H_DESC[$host]}")
    fi
  done
done

if [ "${#CONFLICTS[@]}" -gt 0 ]; then
  printf '%s✘ Für diese Namen gibt es bereits DNS-Einträge, die nicht zum Tunnel passen:%s\n' "$C_RED" "$C_OFF" >&2
  for c in "${CONFLICTS[@]}"; do printf '    %s\n' "$c" >&2; done
  printf '\n  Ein Name kann nur auf EINE Weise aufgelöst werden. Sollen diese Einträge durch den Tunnel-Eintrag\n' >&2
  printf '  (CNAME → %s) ersetzt werden? Dann das Skript erneut mit --replace starten\n' "$TARGET" >&2
  printf '  (die alten Einträge werden gelöscht, die Seite wechselt dann auf den Tunnel).\n' >&2
  exit "$EXIT_CONFLICT"
fi

# --- 5. Tunnel anlegen, Token holen -------------------------------------------------------------
TUNNEL_TOKEN=""
if [ -z "$TUNNEL_ID" ]; then
  if [ "$DRY_RUN" -eq 1 ]; then
    plan "Tunnel '$TUNNEL_NAME' würde angelegt."
  else
    log "Lege Tunnel '$TUNNEL_NAME' an …"
    body=$(jq -nc --arg n "$TUNNEL_NAME" '{name: $n, config_src: "cloudflare"}')
    api POST "/accounts/$ACCOUNT_ID/cfd_tunnel" "$body" "Tunnel anlegen" "Account → Cloudflare Tunnel: Bearbeiten"
    TUNNEL_ID=$(jq -r '.result.id // empty' <<<"$CF_BODY")
    [ -n "$TUNNEL_ID" ] || die "Cloudflare hat keine Tunnel-ID geliefert."
    TUNNEL_TOKEN=$(jq -r '.result.token // empty' <<<"$CF_BODY")
    ok "Tunnel angelegt (${TUNNEL_ID:0:8}…)"
    TARGET="$TUNNEL_ID.cfargotunnel.com"
  fi
fi
if [ "$DRY_RUN" -eq 0 ] && [ -z "$TUNNEL_TOKEN" ]; then
  api GET "/accounts/$ACCOUNT_ID/cfd_tunnel/$TUNNEL_ID/token" "" "Tunnel-Token abrufen" "Account → Cloudflare Tunnel: Bearbeiten"
  TUNNEL_TOKEN=$(jq -r '.result // empty | if type == "string" then . else empty end' <<<"$CF_BODY")
fi
if [ "$DRY_RUN" -eq 0 ]; then
  [ -n "$TUNNEL_TOKEN" ] || die "Cloudflare hat keinen Tunnel-Token geliefert."
  [[ "$TUNNEL_TOKEN" =~ ^[A-Za-z0-9+/=_.-]+$ ]] || die "Der Tunnel-Token hat ein unerwartetes Format."
fi

# --- 6. Ingress (Veröffentlichte Anwendungen) -----------------------------------------------------
INGRESS_HOSTS=()
for d in "${DOMAIN_LIST[@]}"; do INGRESS_HOSTS+=("$d" "www.$d"); done
DESIRED_INGRESS=$(printf '%s\n' "${INGRESS_HOSTS[@]}" | jq -R . | jq -sc --arg s "$ORIGIN_SERVICE" \
  '[.[] | {hostname: ., service: $s}] + [{hostname: null, service: "http_status:404"}]')

ingress_unchanged=0
if [ -n "$TUNNEL_ID" ]; then
  cf GET "/accounts/$ACCOUNT_ID/cfd_tunnel/$TUNNEL_ID/configurations"
  if api_ok; then
    current=$(jq -c '[.result.config.ingress[]? | {hostname: (.hostname // null), service: .service}]' <<<"$CF_BODY")
    jq -e --argjson a "$current" --argjson b "$DESIRED_INGRESS" -n '$a == $b' >/dev/null && ingress_unchanged=1
  elif [ "$CF_CODE" = 401 ] || [ "$CF_CODE" = 403 ]; then
    api_fail "Tunnel-Konfiguration lesen" "Account → Cloudflare Tunnel: Bearbeiten"
  fi
fi
if [ "$ingress_unchanged" -eq 1 ]; then
  ok "Ingress-Regeln sind bereits aktuell"
elif [ "$DRY_RUN" -eq 1 ]; then
  plan "Ingress würde gesetzt: ${INGRESS_HOSTS[*]} → $ORIGIN_SERVICE (sonst 404)."
else
  log "Setze die Ingress-Regeln (${INGRESS_HOSTS[*]} → $ORIGIN_SERVICE) …"
  body=$(jq -nc --argjson i "$DESIRED_INGRESS" '{config: {ingress: ($i | map(if .hostname == null then del(.hostname) else . end))}}')
  api PUT "/accounts/$ACCOUNT_ID/cfd_tunnel/$TUNNEL_ID/configurations" "$body" "Tunnel-Konfiguration setzen" "Account → Cloudflare Tunnel: Bearbeiten"
  ok "Ingress-Regeln gesetzt"
fi

# --- 7. DNS anwenden -----------------------------------------------------------------------------------
dns_body() { jq -nc --arg n "$1" --arg c "$TARGET" '{type: "CNAME", name: $n, content: $c, proxied: true, ttl: 1, comment: "VylarisGroup Cloudflare-Tunnel"}'; }

for host in "${HOSTS[@]}"; do
  zid="${H_ZONE[$host]}"
  zone_hint="Zone → DNS: Bearbeiten (für $host)"
  case "${H_ACTION[$host]}" in
    keep)
      ok "DNS $host: unverändert" ;;
    create)
      if [ "$DRY_RUN" -eq 1 ]; then plan "DNS $host: CNAME → $TARGET würde angelegt."; else
        api POST "/zones/$zid/dns_records" "$(dns_body "$host")" "DNS-Eintrag $host anlegen" "$zone_hint"
        ok "DNS $host: angelegt"
      fi ;;
    update)
      if [ "$DRY_RUN" -eq 1 ]; then plan "DNS $host: vorhandener Eintrag (${H_DESC[$host]}) würde auf CNAME → $TARGET (proxied) gesetzt."; else
        api PUT "/zones/$zid/dns_records/${H_RECORD[$host]}" "$(dns_body "$host")" "DNS-Eintrag $host aktualisieren" "$zone_hint"
        ok "DNS $host: aktualisiert"
      fi ;;
    replace)
      if [ "$DRY_RUN" -eq 1 ]; then plan "DNS $host: vorhandene Einträge (${H_DESC[$host]}) würden durch CNAME → $TARGET ersetzt."; else
        for rid in ${H_DELETE[$host]}; do
          api DELETE "/zones/$zid/dns_records/$rid" "" "DNS-Eintrag $host löschen" "$zone_hint"
        done
        api POST "/zones/$zid/dns_records" "$(dns_body "$host")" "DNS-Eintrag $host anlegen" "$zone_hint"
        ok "DNS $host: ersetzt (vorher: ${H_DESC[$host]})"
      fi ;;
  esac
done

# --- 8. Ergebnis in die .env ---------------------------------------------------------------------------
if [ "$DRY_RUN" -eq 1 ]; then
  plan "Nichts wurde verändert; CLOUDFLARE_TUNNEL_TOKEN würde in $ENV_FILE geschrieben."
  exit 0
fi

[ -f "$ENV_FILE" ] || (umask 077; : >"$ENV_FILE")
chmod 600 "$ENV_FILE"
env_set CLOUDFLARE_TUNNEL_TOKEN "$TUNNEL_TOKEN"
env_set CLOUDFLARE_DOMAINS "${DOMAIN_LIST[*]}"
chmod 600 "$ENV_FILE"
ok "CLOUDFLARE_TUNNEL_TOKEN in $ENV_FILE eingetragen (Rechte 600)"

printf '\n%sFertig.%s Erreichbar über den Tunnel: %s\n' "$C_BLD" "$C_OFF" "${DOMAIN_LIST[*]}"
printf 'Der API-Token wurde weder gespeichert noch in eine Datei geschrieben. Er wird nicht mehr gebraucht und\n'
printf 'kann bei Cloudflare gelöscht werden: https://dash.cloudflare.com/profile/api-tokens\n'
printf '(Für spätere Änderungen, z. B. eine weitere Domain, einfach einen neuen Token erstellen.)\n'
