#!/usr/bin/env bash
# =============================================================================
# VylarisGroupEurope – Installer
#
# Richtet das komplette System auf einem frischen Linux-Server ein:
#   1. installiert Abhängigkeiten + Docker
#   2. fragt, wie die Seite erreichbar sein soll:
#        1) eigene Domain mit automatischem HTTPS (Caddy + Let's Encrypt)
#        2) Cloudflare Tunnel (mehrere Domains, kein offener Port nötig)
#   3. fragt nach den Impressum-Daten (optional)
#   4. Modus 1: wartet, bis der DNS-A-Record auf DIESEN Server zeigt, startet App + PostgreSQL + Caddy
#      Modus 2: richtet per Cloudflare-API Tunnel + DNS ein und startet App + PostgreSQL + cloudflared
#   5. prüft, ob die Seite(n) über https erreichbar sind
#
# Aufruf (als root, im Projektordner):
#   sudo ./install.sh                       # Installation (interaktiv)
#   sudo ./install.sh update                # neueste Version holen + neu starten
#   sudo ./install.sh cloudflare            # Cloudflare-Tunnel erneut einrichten / Token erneuern
#   sudo ./install.sh --help                # alle Optionen
#
# Oder direkt von GitHub (klont das Projekt nach /opt/vylaris-europe):
#   curl -fsSL https://raw.githubusercontent.com/cubiqstudio/vylarisgroup-europe/main/install.sh | sudo bash
#
# Unterstützt: Debian/Ubuntu (apt) sowie Fedora/RHEL-Derivate (dnf/yum).
# =============================================================================
set -Eeuo pipefail

REPO_URL="${REPO_URL:-https://github.com/cubiqstudio/vylarisgroup-europe}"
BRANCH="${BRANCH:-main}"
INSTALL_DIR="${INSTALL_DIR:-/opt/vylaris-europe}"
ACME_PROD="https://acme-v02.api.letsencrypt.org/directory"
ACME_STAGING="https://acme-staging-v02.api.letsencrypt.org/directory"

DOMAIN="${DOMAIN:-}"
LE_EMAIL="${LE_EMAIL:-}"
ADMIN_EMAIL="${ADMIN_EMAIL:-}"
# Impressum-/Rechtsdaten (Anfangswerte; später im Admin unter Einstellungen → Rechtliches änderbar)
LEGAL_STREET="${LEGAL_STREET:-}"
LEGAL_ZIP_CITY="${LEGAL_ZIP_CITY:-}"
LEGAL_COUNTRY="${LEGAL_COUNTRY:-}"
LEGAL_PHONE="${LEGAL_PHONE:-}"
LEGAL_REGISTER="${LEGAL_REGISTER:-}"
LEGAL_VAT_ID="${LEGAL_VAT_ID:-}"
CONTACT_EMAIL="${CONTACT_EMAIL:-}"
ASSUME_YES="${ASSUME_YES:-0}"
USE_STAGING="${USE_STAGING:-0}"
SKIP_DNS_CHECK="${SKIP_DNS_CHECK:-0}"
NO_PULL=0
DNS_WAIT_MIN="${DNS_WAIT_MIN:-15}"
COMMAND="install"
# Zugangsart: caddy (eigene Domain, Let's Encrypt) oder cloudflare (Tunnel, mehrere Domains)
ACCESS_MODE="${ACCESS_MODE:-}"
CF_DOMAINS="${CLOUDFLARE_DOMAINS:-}"
CF_DEFAULT_DOMAINS="vylaris.eu vylaris.de vylaris.net"
CF_REPLACE=0
NET_CONTACT_EMAIL="${NET_CONTACT_EMAIL:-}"
HEALTH_TRIES="${HEALTH_TRIES:-60}"
HEALTH_SLEEP="${HEALTH_SLEEP:-5}"

PROJECT_DIR=""
# Pfad des Installers für "sudo …"-Hinweise: $0 taugt nicht, wenn das Skript per "curl | sudo bash" läuft
# (dann ist $0 nur "bash"). Vorläufig die Datei selbst (falls es eine echte ist), sonst die Kopie in
# $INSTALL_DIR; get_project setzt den endgültigen Wert.
if [ -n "${BASH_SOURCE[0]:-}" ] && [ "${BASH_SOURCE[0]}" = "$0" ] && [ -f "$0" ]; then
  SELF="$(cd "$(dirname "$0")" && pwd)/$(basename "$0")"
else
  SELF="$INSTALL_DIR/install.sh"
fi
ENV_FILE=""
PKG=""
TTY=""

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
hr()   { printf '%s\n' "------------------------------------------------------------"; }

on_error() { local code=$?; printf '%s✘ Abbruch in Zeile %s (Exit-Code %s).%s\n' "$C_RED" "${BASH_LINENO[0]:-?}" "$code" "$C_OFF" >&2; }
trap on_error ERR

usage() {
  cat <<'EOF'
VylarisGroupEurope – Installer

Verwendung: install.sh [install|update|cloudflare] [Optionen]

  install     Installation (Standard)
  update      neueste Version holen und neu starten
  cloudflare  Cloudflare-Tunnel erneut einrichten (z. B. weitere Domain, neuer Token)

Optionen:
  --mode <caddy|cloudflare>
                        Zugangsart: caddy = eigene Domain mit automatischem HTTPS (Let's Encrypt),
                        cloudflare = Cloudflare Tunnel (mehrere Domains, kein offener Port); sonst Abfrage
  --domain <name>       Domain (z. B. www.example.org, Modus caddy); sonst Abfrage
  --domains "a b c"     Domains für den Cloudflare Tunnel (Standard: vylaris.eu vylaris.de vylaris.net;
                        die erste ist die Hauptdomain, z. B. für SITE_URL und Admin-Links)
  --replace             Cloudflare: vorhandene DNS-Einträge gleichen Namens ersetzen
  --email <adresse>     E-Mail für Let's Encrypt (Ablauf-Hinweise); sonst Abfrage
  --admin-email <adr>   Login-E-Mail des Admin-Kontos; sonst Abfrage
  --branch <name>       Git-Branch beim Klonen (Standard: main)
  --staging             Let's-Encrypt-Testumgebung (Zertifikat ist NICHT vertrauenswürdig;
                        gut zum Ausprobieren ohne Rate-Limits)
  --skip-dns-check      DNS-Prüfung überspringen (z. B. hinter Cloudflare-Proxy)
  --yes, -y             Nicht nachfragen, Vorgaben/Umgebungsvariablen verwenden
  --help, -h            Diese Hilfe

Umgebungsvariablen: DOMAIN, LE_EMAIL, ADMIN_EMAIL, BRANCH, REPO_URL, INSTALL_DIR,
                    USE_STAGING=1, SKIP_DNS_CHECK=1, ASSUME_YES=1, DNS_WAIT_MIN,
                    ACCESS_MODE=caddy|cloudflare, CLOUDFLARE_DOMAINS

Cloudflare Tunnel: Den API-Token (Rechte: Account → Cloudflare Tunnel: Bearbeiten, Zone → DNS: Bearbeiten,
                    Zone → Zone: Lesen) fragt der Installer verdeckt ab bzw. liest ihn aus CLOUDFLARE_API_TOKEN.
                    Er wird nicht gespeichert; nach dem Setup kann er bei Cloudflare gelöscht werden.

Impressum-Daten (optional; ohne Rückfrage bei --yes bzw. ohne Terminal):
                    LEGAL_STREET, LEGAL_ZIP_CITY, LEGAL_COUNTRY, LEGAL_PHONE,
                    LEGAL_REGISTER, LEGAL_VAT_ID, CONTACT_EMAIL
  Sie dienen als Anfangswerte; spätere Änderungen im Admin-Dashboard
  (Einstellungen → Rechtliches) haben Vorrang.
EOF
}

parse_args() {
  while [ $# -gt 0 ]; do
    case "$1" in
      install|update|cloudflare) COMMAND="$1" ;;
      --mode)          ACCESS_MODE="${2:?--mode braucht einen Wert}"; shift ;;
      --cloudflare)    ACCESS_MODE=cloudflare ;;
      --domains)       CF_DOMAINS="${2:?--domains braucht einen Wert}"; shift ;;
      --replace)       CF_REPLACE=1 ;;
      --domain)        DOMAIN="${2:?--domain braucht einen Wert}"; shift ;;
      --email)         LE_EMAIL="${2:?--email braucht einen Wert}"; shift ;;
      --admin-email)   ADMIN_EMAIL="${2:?--admin-email braucht einen Wert}"; shift ;;
      --branch)        BRANCH="${2:?--branch braucht einen Wert}"; shift ;;
      --staging)       USE_STAGING=1 ;;
      --skip-dns-check) SKIP_DNS_CHECK=1 ;;
      --no-pull)       NO_PULL=1 ;; # intern: nach dem Neustart des Skripts nicht erneut ziehen
      -y|--yes)        ASSUME_YES=1 ;;
      -h|--help)       usage; exit 0 ;;
      *) die "Unbekannte Option: $1 (siehe --help)" ;;
    esac
    shift
  done
}

# --- Interaktion (liest von /dev/tty, funktioniert auch bei "curl | bash") ------
init_tty() {
  if [ "$ASSUME_YES" != "1" ] && (: </dev/tty) 2>/dev/null; then TTY=/dev/tty; else TTY=""; fi
}

# ask "Frage" "Vorgabe" -> gibt die Antwort auf stdout aus
ask() {
  local prompt="$1" def="${2:-}" ans=""
  if [ -n "$TTY" ]; then
    if [ -n "$def" ]; then printf '%s [%s]: ' "$prompt" "$def" >"$TTY"; else printf '%s: ' "$prompt" >"$TTY"; fi
    IFS= read -r ans <"$TTY" || true
  fi
  printf '%s' "${ans:-$def}"
}

# confirm "Frage" "y|n" -> Exit 0 bei Ja
confirm() {
  local prompt="$1" def="${2:-y}" ans hint="[J/n]"
  [ "$def" = "n" ] && hint="[j/N]"
  if [ -z "$TTY" ]; then [ "$def" = "y" ]; return; fi
  printf '%s %s: ' "$prompt" "$hint" >"$TTY"
  IFS= read -r ans <"$TTY" || true
  ans="${ans:-$def}"
  case "${ans,,}" in j|ja|y|yes) return 0 ;; *) return 1 ;; esac
}

# --- Validierung ----------------------------------------------------------------
normalize_domain() {
  local d="${1,,}"
  d="${d//[[:space:]]/}"; d="${d#http://}"; d="${d#https://}"; d="${d%%/*}"; d="${d%%:*}"; d="${d%.}"
  printf '%s' "$d"
}
valid_domain() {
  local d="$1"
  [[ "$d" =~ ^([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+(xn--[a-z0-9-]{2,59}|[a-z]{2,63})$ ]] || return 1
  [[ "$d" =~ ^[0-9.]+$ ]] && return 1
  return 0
}
valid_email() { [[ "$1" =~ ^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$ ]]; }

# Freitext für die .env: keine Steuerzeichen/Zeilenumbrüche, Länge <= Maximum und keine Zeichen, die
# docker compose in .env-Dateien umdeuten würde (Anführungszeichen, Backslash, $, Backtick, #).
valid_text() { # valid_text WERT [MAX]
  local v="$1" max="${2:-200}"
  [ "${#v}" -le "$max" ] || return 1
  [[ "$v" == *[[:cntrl:]]* ]] && return 1
  case "$v" in *[\"\'\\\$\`\#]*) return 1 ;; esac
  return 0
}
trim() { local v="$1"; v="${v#"${v%%[![:space:]]*}"}"; v="${v%"${v##*[![:space:]]}"}"; printf '%s' "$v"; }

# --- Zufallswerte -----------------------------------------------------------------
rand_hex() { openssl rand -hex "$1"; }
gen_password() { # 20 Zeichen, erfüllt die Passwort-Policy (Groß/Klein/Ziffer)
  local p
  while :; do
    p=$(openssl rand -base64 48 | tr -dc 'A-Za-z0-9' | head -c 20 || true)
    [ "${#p}" -eq 20 ] && [[ $p =~ [a-z] && $p =~ [A-Z] && $p =~ [0-9] ]] && break
  done
  printf '%s' "$p"
}

# --- .env-Helfer -----------------------------------------------------------------
env_get() { { grep -E "^$1=" "$ENV_FILE" 2>/dev/null || true; } | tail -n1 | cut -d= -f2-; }
env_set() { # env_set KEY VALUE – ersetzt oder hängt an (ohne sed-Escaping-Probleme)
  local tmp; tmp=$(mktemp)
  K="$1" V="$2" awk 'BEGIN{k=ENVIRON["K"]; v=ENVIRON["V"]; d=0}
    index($0,k"=")==1 {print k"="v; d=1; next} {print}
    END{if(!d) print k"="v}' "$ENV_FILE" >"$tmp"
  cat "$tmp" >"$ENV_FILE"; rm -f "$tmp"
}

# --- System ----------------------------------------------------------------------
need_root() { [ "$(id -u)" -eq 0 ] || die "Bitte als root ausführen: sudo $SELF $*"; }

detect_pkg() {
  if   command -v apt-get >/dev/null 2>&1; then PKG=apt
  elif command -v dnf     >/dev/null 2>&1; then PKG=dnf
  elif command -v yum     >/dev/null 2>&1; then PKG=yum
  else die "Kein unterstützter Paketmanager (apt/dnf/yum). Bitte Docker, git, curl, openssl und dig manuell installieren."; fi
}

install_base_packages() {
  local need=0 c
  for c in curl git openssl dig ss ip awk; do command -v "$c" >/dev/null 2>&1 || need=1; done
  [ "$need" -eq 0 ] && { ok "Basis-Pakete vorhanden"; return; }
  log "Installiere Basis-Pakete (curl, git, openssl, dnsutils, iproute) …"
  case "$PKG" in
    apt)
      export DEBIAN_FRONTEND=noninteractive
      apt-get update -qq
      apt-get install -y -qq ca-certificates curl git openssl iproute2 gawk
      apt-get install -y -qq dnsutils 2>/dev/null || apt-get install -y -qq bind9-dnsutils
      ;;
    dnf) dnf install -y -q ca-certificates curl git openssl iproute gawk bind-utils ;;
    yum) yum install -y -q ca-certificates curl git openssl iproute gawk bind-utils ;;
  esac
  ok "Basis-Pakete installiert"
}

# jq braucht nur der Cloudflare-Modus (scripts/cloudflare-setup.sh)
ensure_jq() {
  command -v jq >/dev/null 2>&1 && return 0
  log "Installiere jq …"
  case "$PKG" in
    apt) export DEBIAN_FRONTEND=noninteractive; apt-get update -qq; apt-get install -y -qq jq ;;
    dnf) dnf install -y -q jq ;;
    yum) yum install -y -q jq ;;
  esac
  command -v jq >/dev/null 2>&1 || die "jq konnte nicht installiert werden – bitte manuell installieren."
}

install_docker() {
  if command -v docker >/dev/null 2>&1 && docker compose version >/dev/null 2>&1; then
    ok "Docker + Compose vorhanden ($(docker --version | cut -d, -f1))"
  else
    log "Installiere Docker (offizielles Installationsskript von get.docker.com) …"
    local tmp; tmp=$(mktemp)
    curl -fsSL https://get.docker.com -o "$tmp" || die "Download von get.docker.com fehlgeschlagen."
    sh "$tmp"; rm -f "$tmp"
    docker compose version >/dev/null 2>&1 || die "Docker Compose Plugin fehlt nach der Installation."
    ok "Docker installiert"
  fi
  systemctl enable --now docker >/dev/null 2>&1 || true
  docker info >/dev/null 2>&1 || die "Docker-Dienst läuft nicht (systemctl status docker)."
}

ensure_memory() { # Next.js-Build braucht ca. 1,5–2 GB RAM
  local mem swap
  mem=$(awk '/^MemTotal:/ {print $2}' /proc/meminfo); swap=$(awk '/^SwapTotal:/ {print $2}' /proc/meminfo)
  if [ "$mem" -lt 1800000 ] && [ "$swap" -eq 0 ] && [ ! -e /swapfile ]; then
    warn "Wenig Arbeitsspeicher ($((mem / 1024)) MB) und kein Swap – der Build könnte scheitern."
    if confirm "2-GB-Swap-Datei (/swapfile) anlegen?" y; then
      fallocate -l 2G /swapfile 2>/dev/null || dd if=/dev/zero of=/swapfile bs=1M count=2048 status=none
      chmod 600 /swapfile; mkswap /swapfile >/dev/null; swapon /swapfile
      grep -q '^/swapfile ' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
      ok "Swap aktiviert"
    fi
  fi
}

get_project() {
  local here=""
  if [ -n "${BASH_SOURCE[0]:-}" ] && [ -f "${BASH_SOURCE[0]}" ]; then here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"; fi
  if [ -n "$here" ] && [ -f "$here/docker-compose.yml" ] && [ -f "$here/Dockerfile" ]; then
    PROJECT_DIR="$here"
    ok "Projekt gefunden: $PROJECT_DIR"
  elif [ -d "$INSTALL_DIR/.git" ]; then
    PROJECT_DIR="$INSTALL_DIR"
    ok "Projekt gefunden: $PROJECT_DIR"
  else
    log "Lade Projekt von $REPO_URL (Branch $BRANCH) nach $INSTALL_DIR …"
    mkdir -p "$(dirname "$INSTALL_DIR")"
    GIT_TERMINAL_PROMPT=0 git clone --depth 1 --branch "$BRANCH" "$REPO_URL" "$INSTALL_DIR" \
      || die "Klonen fehlgeschlagen. Ist das Repository öffentlich und der Branch '$BRANCH' vorhanden? (Bei privaten Repos: selbst klonen und ./install.sh aus dem Klon starten.)"
    PROJECT_DIR="$INSTALL_DIR"
  fi
  SELF="$PROJECT_DIR/install.sh"
  [ -f "$PROJECT_DIR/docker-compose.https.yml" ] || die "docker-compose.https.yml fehlt im Projekt ($PROJECT_DIR) – ist der Branch aktuell?"
  ENV_FILE="$PROJECT_DIR/.env"
  cd "$PROJECT_DIR"
}

# --- Netzwerk / DNS ------------------------------------------------------------------
public_ip() {
  local u ip
  for u in https://api.ipify.org https://ipv4.icanhazip.com https://ifconfig.me/ip; do
    ip=$(curl -4 -fsS --max-time 8 "$u" 2>/dev/null | tr -d '[:space:]' || true)
    if [[ "$ip" =~ ^([0-9]{1,3}\.){3}[0-9]{1,3}$ ]]; then printf '%s' "$ip"; return 0; fi
  done
  return 1
}
local_ips4() { ip -4 -o addr show scope global 2>/dev/null | awk '{print $4}' | cut -d/ -f1; }
local_ips6() { ip -6 -o addr show scope global 2>/dev/null | awk '{print $4}' | cut -d/ -f1; }

# resolve <A|AAAA> <domain>: fragt öffentliche Resolver (aktuell) und danach das System
resolve() {
  local type="$1" d="$2" r out re
  if [ "$type" = A ]; then re='^[0-9]{1,3}(\.[0-9]{1,3}){3}$'; else re='^[0-9a-fA-F:]+:[0-9a-fA-F:]*$'; fi
  for r in 1.1.1.1 8.8.8.8 ""; do
    out=$({ dig +short +time=3 +tries=1 "$type" "$d" ${r:+@"$r"} 2>/dev/null || true; } | grep -E "$re" || true)
    if [ -n "$out" ]; then printf '%s\n' "$out"; return 0; fi
  done
  return 1
}

SERVER_IP=""
# Prüft: Zeigen ALLE A-Records auf diesen Server? Setzt DNS_FOUND.
DNS_FOUND=""
dns_points_here() {
  local d="$1" ip mine bad=0
  DNS_FOUND=$(resolve A "$d" || true)
  [ -n "$DNS_FOUND" ] || return 1
  mine=$(printf '%s\n%s\n' "$SERVER_IP" "$(local_ips4)")
  while IFS= read -r ip; do
    [ -z "$ip" ] && continue
    printf '%s\n' "$mine" | grep -qx "$ip" || bad=1
  done <<<"$DNS_FOUND"
  [ "$bad" -eq 0 ]
}

warn_aaaa() { # Let's Encrypt bevorzugt IPv6, wenn ein AAAA-Record existiert
  local d="$1" aaaa mine6 ip bad=0
  aaaa=$(resolve AAAA "$d" || true)
  [ -z "$aaaa" ] && return 0
  mine6=$(local_ips6)
  while IFS= read -r ip; do
    [ -z "$ip" ] && continue
    printf '%s\n' "$mine6" | grep -qix "$ip" || bad=1
  done <<<"$aaaa"
  if [ "$bad" -eq 1 ]; then
    warn "Für $d existiert ein AAAA-Record (IPv6: $(printf '%s' "$aaaa" | tr '\n' ' ')), der NICHT zu diesem Server gehört."
    warn "Let's Encrypt nutzt IPv6 bevorzugt – das Zertifikat würde scheitern. Entferne den AAAA-Record oder richte IPv6 hier ein."
    confirm "Trotzdem fortfahren?" n || die "Abgebrochen wegen AAAA-Record."
  fi
}

wait_for_dns() {
  local d="$1" start now waited=0 ans
  if [ "$SKIP_DNS_CHECK" = "1" ]; then warn "DNS-Prüfung übersprungen (--skip-dns-check)."; return 0; fi
  SERVER_IP=$(public_ip || true)
  [ -n "$SERVER_IP" ] || { warn "Öffentliche IP konnte nicht ermittelt werden."; SERVER_IP=$(local_ips4 | head -n1); }
  [ -n "$SERVER_IP" ] || die "Keine IPv4-Adresse gefunden."
  hr
  printf '%sDNS-Einstellung%s\n' "$C_BLD" "$C_OFF"
  printf '  Lege bei deinem Domain-Anbieter diesen Eintrag an:\n\n'
  printf '      Typ: A     Name: %s     Wert: %s%s%s\n\n' "$d" "$C_BLD" "$SERVER_IP" "$C_OFF"
  printf '  (Steht der Server hinter NAT/Router, muss Port 80 und 443 zu ihm weitergeleitet werden.)\n'
  hr
  start=$(date +%s)
  while :; do
    if dns_points_here "$d"; then
      ok "DNS passt: $d → $(printf '%s' "$DNS_FOUND" | tr '\n' ' ')(dieser Server)"
      warn_aaaa "$d"
      return 0
    fi
    if [ -n "$DNS_FOUND" ]; then warn "$d zeigt aktuell auf: $(printf '%s' "$DNS_FOUND" | tr '\n' ' ')– erwartet: $SERVER_IP"
    else warn "Für $d wurde noch kein A-Record gefunden."; fi

    if [ -z "$TTY" ]; then
      now=$(date +%s); waited=$(( (now - start) / 60 ))
      [ "$waited" -ge "$DNS_WAIT_MIN" ] && die "DNS zeigt nach ${DNS_WAIT_MIN} Minuten nicht auf diesen Server. Später erneut starten oder --skip-dns-check verwenden."
      log "Prüfe in 20 Sekunden erneut … (${waited}/${DNS_WAIT_MIN} min)"; sleep 20; continue
    fi
    ans=$(ask "[Enter] erneut prüfen · [a] automatisch warten (bis ${DNS_WAIT_MIN} min) · [f] trotzdem fortfahren · [q] abbrechen" "")
    case "${ans,,}" in
      q) die "Abgebrochen." ;;
      f) warn "Fahre ohne bestätigten A-Record fort – die Zertifikatsausstellung kann scheitern."; return 0 ;;
      a)
        start=$(date +%s)
        while :; do
          now=$(date +%s); waited=$(( (now - start) / 60 ))
          if dns_points_here "$d"; then ok "DNS passt: $d → $(printf '%s' "$DNS_FOUND" | tr '\n' ' ')"; warn_aaaa "$d"; return 0; fi
          [ "$waited" -ge "$DNS_WAIT_MIN" ] && { warn "Zeitlimit erreicht."; break; }
          printf '  … warte auf DNS (%s/%s min, aktuell: %s)\n' "$waited" "$DNS_WAIT_MIN" "${DNS_FOUND:-kein Eintrag}"; sleep 20
        done ;;
      *) : ;;
    esac
  done
}

check_ports() {
  if docker ps --format '{{.Names}}' 2>/dev/null | grep -qx 'vylaris-europe-caddy'; then return 0; fi
  local p info
  for p in 80 443; do
    info=$(ss -ltnpH "sport = :$p" 2>/dev/null | head -n1 || true)
    if [ -n "$info" ]; then
      die "Port $p ist bereits belegt: $info
   Stoppe den Dienst (z. B. 'systemctl stop nginx apache2') und starte den Installer erneut."
    fi
  done
  ok "Ports 80 und 443 sind frei"
}

open_firewall() {
  if command -v ufw >/dev/null 2>&1 && ufw status 2>/dev/null | grep -q '^Status: active'; then
    ufw allow 80/tcp >/dev/null; ufw allow 443/tcp >/dev/null; ufw allow 443/udp >/dev/null
    ok "ufw: Ports 80/443 freigegeben"
  fi
  if command -v firewall-cmd >/dev/null 2>&1 && firewall-cmd --state >/dev/null 2>&1; then
    firewall-cmd --permanent --add-service=http --add-service=https >/dev/null
    firewall-cmd --permanent --add-port=443/udp >/dev/null
    firewall-cmd --reload >/dev/null
    ok "firewalld: Ports 80/443 freigegeben"
  fi
}

# --- Zugangsart (Caddy oder Cloudflare Tunnel) -----------------------------------------
# Modus einer bestehenden Installation aus COMPOSE_FILE ableiten (leer = unbekannt/neu)
current_mode() {
  [ -f "$ENV_FILE" ] || return 0
  case "$(env_get COMPOSE_FILE)" in
    *docker-compose.cloudflare.yml*) printf 'cloudflare' ;;
    *docker-compose.https.yml*)      printf 'caddy' ;;
  esac
}

choose_mode() {
  local cur ans def=1
  cur=$(current_mode)
  [ "$cur" = "cloudflare" ] && def=2
  case "${ACCESS_MODE,,}" in
    1|caddy)       ACCESS_MODE=caddy ;;
    2|cloudflare)  ACCESS_MODE=cloudflare ;;
    "")
      if [ -n "$TTY" ]; then
        hr; printf '%sWie soll die Seite erreichbar sein?%s\n' "$C_BLD" "$C_OFF" >"$TTY"
        printf '  1) Eigene Domain mit automatischem HTTPS (Caddy, Let'"'"'s Encrypt)\n' >"$TTY"
        printf '  2) Cloudflare Tunnel (mehrere Domains: vylaris.eu/.de/.net, kein offener Port nötig)\n' >"$TTY"
        while :; do
          ans=$(ask "Auswahl" "$def")
          case "$ans" in 1) ACCESS_MODE=caddy; break ;; 2) ACCESS_MODE=cloudflare; break ;; *) warn "Bitte 1 oder 2 eingeben." ;; esac
        done
      else
        ACCESS_MODE="${cur:-caddy}"
      fi ;;
    *) die "Unbekannter Modus '$ACCESS_MODE' (erlaubt: caddy, cloudflare)." ;;
  esac
  if [ "$ACCESS_MODE" = "cloudflare" ]; then
    [ -f "$PROJECT_DIR/docker-compose.cloudflare.yml" ] && [ -f "$PROJECT_DIR/scripts/cloudflare-setup.sh" ] \
      || die "docker-compose.cloudflare.yml bzw. scripts/cloudflare-setup.sh fehlt im Projekt ($PROJECT_DIR) – ist der Branch aktuell?"
    ensure_jq
    load_cf_domains
  fi
}

# Domains des Cloudflare-Tunnels: Option/Umgebung > .env > Standard. Die erste ist die Hauptseite.
load_cf_domains() {
  local d list=()
  [ -n "$CF_DOMAINS" ] || { [ -f "$ENV_FILE" ] && CF_DOMAINS=$(env_get CLOUDFLARE_DOMAINS); }
  [ -n "${CF_DOMAINS// /}" ] || CF_DOMAINS="$CF_DEFAULT_DOMAINS"
  for d in ${CF_DOMAINS//,/ }; do
    d=$(normalize_domain "$d"); d="${d#www.}"
    valid_domain "$d" || die "'$d' ist keine gültige Domain (--domains)."
    list+=("$d")
  done
  [ "${#list[@]}" -gt 0 ] || die "Keine Domain für den Cloudflare Tunnel angegeben."
  CF_DOMAINS="${list[*]}"
  DOMAIN="${list[0]}"
}

# Interaktiv: Domains des Tunnels bestätigen oder ändern (Enter = Vorgabe). Ohne Terminal/--yes bleibt die Vorgabe.
ask_cf_domains() {
  local ans
  [ -n "$TTY" ] && [ "$ASSUME_YES" != "1" ] || return 0
  hr
  {
    printf '%sDomains für den Cloudflare Tunnel%s\n' "$C_BLD" "$C_OFF"
    printf '  Alle Domains laufen über DENSELBEN Tunnel zur selben App. Die erste ist die Hauptdomain (SITE_URL, Links des Teams); den Admin-Bereich gibt es auf allen.\n'
    printf '  Voraussetzung: Jede Domain ist bei Cloudflare angelegt und aktiv (Nameserver bei der Registrierung auf\n'
    printf '  Cloudflare umgestellt; im Cloudflare-Dashboard steht die Domain auf "Aktiv").\n'
    printf '  vylaris.at ist noch offline – bitte erst eintragen, wenn die Seite fertig ist\n'
    printf '  (dann in src/lib/sites.ts "online: true" setzen und neu bereitstellen).\n'
  } >"$TTY"
  ans=$(ask "Domains (mit Leerzeichen getrennt)" "$CF_DOMAINS")
  CF_DOMAINS="$ans"
  load_cf_domains
  case " $CF_DOMAINS " in *" vylaris.at "*) warn "vylaris.at zeigt nur eine Offline-Seite, bis es in src/lib/sites.ts auf online gesetzt ist." ;; esac
}

# Kontakt-E-Mail für die Legal Notice von vylaris.net (nur wenn die Domain dabei ist)
ask_net_contact() {
  case " $CF_DOMAINS " in *" vylaris.net "*) ;; *) return 0 ;; esac
  [ -n "$NET_CONTACT_EMAIL" ] || { [ -f "$ENV_FILE" ] && NET_CONTACT_EMAIL=$(env_get NET_CONTACT_EMAIL); }
  [ -n "$TTY" ] && [ "$ASSUME_YES" != "1" ] || return 0
  hr
  printf '%sKontakt-E-Mail für vylaris.net%s\n  Diese Adresse steht in der Legal Notice und der Privacy Policy von vylaris.net.\n' "$C_BLD" "$C_OFF" >"$TTY"
  while :; do
    NET_CONTACT_EMAIL=$(ask "E-Mail-Adresse" "${NET_CONTACT_EMAIL:-contact@vylaris.net}")
    valid_email "$NET_CONTACT_EMAIL" && break
    warn "Bitte eine gültige E-Mail-Adresse angeben."
  done
}

# Anleitung: Cloudflare-API-Token erstellen (nur für dieses Setup nötig)
print_cf_token_guide() {
  {
    printf '%sSo erstellst du den Cloudflare-API-Token%s (dauert etwa 2 Minuten)\n\n' "$C_BLD" "$C_OFF"
    printf '  1. Öffne  https://dash.cloudflare.com/profile/api-tokens  (mit dem Cloudflare-Konto anmelden, in dem die Domains liegen).\n'
    printf '  2. Klicke auf "Token erstellen" und bei "Benutzerdefinierten Token erstellen" auf "Los geht'"'"'s".\n'
    printf '  3. Name:  vylaris-tunnel-setup\n'
    printf '  4. Berechtigungen – drei Zeilen ("+ Weiter hinzufügen" für jede weitere):\n'
    printf '       Konto     │ Cloudflare Tunnel │ Bearbeiten\n'
    printf '       Zone      │ DNS               │ Bearbeiten\n'
    printf '       Zone      │ Zone              │ Lesen\n'
    printf '  5. Kontoressourcen:  Einschließen → dein Konto.\n'
    printf '     Zonenressourcen:  Einschließen → Bestimmte Zone → je eine Zeile für %s\n' "$CF_DOMAINS"
    printf '  6. Optional: unter "TTL" ein Ablaufdatum setzen (z. B. morgen) – der Token wird nur jetzt gebraucht.\n'
    printf '  7. "Weiter zur Zusammenfassung" → "Token erstellen" → den angezeigten Token KOPIEREN\n'
    printf '     (er wird nur einmal angezeigt).\n\n'
    printf '  Der Token wird hier nur für dieses Setup verwendet, nicht gespeichert und nirgends ausgegeben.\n'
    printf '  Danach kannst du ihn bei Cloudflare löschen. Der Tunnel läuft weiter mit seinem eigenen,\n'
    printf '  getrennten Tunnel-Token.\n\n'
  } >"$TTY"
}

# --- Konfiguration -----------------------------------------------------------------
collect_config() {
  local existing_domain=""
  [ -f "$ENV_FILE" ] && existing_domain=$(env_get DOMAIN)

  hr; printf '%sKonfiguration%s\n' "$C_BLD" "$C_OFF"
  if [ "$ACCESS_MODE" = "cloudflare" ]; then
    # Keine Let's-Encrypt-Abfrage: Zertifikate stellt Cloudflare aus.
    ask_cf_domains
    ask_net_contact
    log "Cloudflare Tunnel für: $CF_DOMAINS (Hauptdomain: $DOMAIN)"
  else
    while :; do
      [ -n "$DOMAIN" ] || DOMAIN=$(ask "Domain für die Website (z. B. www.example.org)" "$existing_domain")
      DOMAIN=$(normalize_domain "$DOMAIN")
      if valid_domain "$DOMAIN"; then break; fi
      warn "'$DOMAIN' ist keine gültige Domain (IP-Adressen und localhost gehen nicht – Let's Encrypt braucht einen Domainnamen)."
      [ -z "$TTY" ] && die "Ungültige Domain."
      DOMAIN=""
    done

    while :; do
      [ -n "$LE_EMAIL" ] || LE_EMAIL=$(ask "E-Mail für Let's-Encrypt-Hinweise (Zertifikat-Ablauf)" "$( [ -f "$ENV_FILE" ] && env_get ACME_EMAIL )")
      if valid_email "$LE_EMAIL"; then break; fi
      warn "Bitte eine gültige E-Mail-Adresse angeben."
      [ -z "$TTY" ] && die "Ungültige E-Mail."
      LE_EMAIL=""
    done
  fi

  local admin_def="${ADMIN_EMAIL:-}"
  [ -z "$admin_def" ] && [ -f "$ENV_FILE" ] && admin_def=$(env_get ADMIN_EMAIL)
  [ -z "$admin_def" ] || [ "$admin_def" = "lucas.wilms@vylaris.example" ] && admin_def="lucas.wilms@${DOMAIN#www.}"
  while :; do
    ADMIN_EMAIL=$(ask "Login-E-Mail für das Admin-Konto" "$admin_def")
    if valid_email "$ADMIN_EMAIL"; then break; fi
    warn "Bitte eine gültige E-Mail-Adresse angeben."
    [ -z "$TTY" ] && die "Ungültige Admin-E-Mail."
  done
}

# legal_ask VARNAME "Frage" MAX [text|email]
# Fragt ein Impressum-Feld ab (interaktiv) bzw. übernimmt den Wert aus Umgebung/.env (nicht-interaktiv),
# prüft ihn und schreibt ihn zurück nach VARNAME. Optional: leer ist erlaubt; "-" leert ein Feld.
# Werte werden nie ausgewertet (kein eval) – nur per printf -v zugewiesen.
legal_ask() {
  local var="$1" label="$2" max="$3" kind="${4:-text}" def val
  def="${!var:-}"
  while :; do
    if [ -n "$TTY" ]; then
      val=$(ask "$label" "$def")
      [ "$val" = "-" ] && val=""
    else
      val="$def"
    fi
    if [[ "$val" == *[[:cntrl:]]* ]]; then
      warn "$label: Steuerzeichen und Zeilenumbrüche sind nicht erlaubt."
    else
      val=$(trim "$val")
      if [ -z "$val" ]; then break; fi
      if [ "$kind" = "email" ]; then
        if valid_email "$val" && [ "${#val}" -le "$max" ]; then break; fi
        warn "$label: bitte eine gültige E-Mail-Adresse angeben (max. $max Zeichen)."
      elif valid_text "$val" "$max"; then
        break
      else
        warn "$label: höchstens $max Zeichen; Anführungszeichen, Backslash, \$, Backtick und # sind nicht erlaubt."
      fi
    fi
    [ -z "$TTY" ] && die "Ungültiger Wert für $label (Umgebungsvariable bzw. .env prüfen)."
  done
  printf -v "$var" '%s' "$val"
}

# Impressum & Rechtliches: Anfangswerte für LEGAL_*/CONTACT_EMAIL in der .env.
# Vorgaben: Umgebungsvariable > bestehende .env > Standard. Die Längen entsprechen den Limits im Admin.
collect_legal() {
  local var
  for var in LEGAL_STREET LEGAL_ZIP_CITY LEGAL_COUNTRY LEGAL_PHONE LEGAL_REGISTER LEGAL_VAT_ID CONTACT_EMAIL; do
    if [ -z "${!var:-}" ] && [ -f "$ENV_FILE" ]; then printf -v "$var" '%s' "$(env_get "$var")"; fi
  done
  [ -n "$LEGAL_COUNTRY" ] || LEGAL_COUNTRY="Deutschland"
  [ -n "$CONTACT_EMAIL" ] || CONTACT_EMAIL="$LE_EMAIL"

  hr; printf '%sImpressum & Rechtliches%s\n' "$C_BLD" "$C_OFF"
  if [ -n "$TTY" ]; then
    printf '  Optional – Enter übernimmt die Vorgabe bzw. überspringt das Feld, "-" leert es.\n'
    printf '  Diese Werte dienen als Anfangswerte für Impressum und Datenschutz. Spätere Änderungen\n'
    printf '  erfolgen im Admin-Dashboard unter Einstellungen → Rechtliches und haben Vorrang.\n'
  else
    log "Impressum-Daten aus Umgebungsvariablen bzw. bestehender .env (später im Admin änderbar)."
  fi
  legal_ask LEGAL_STREET     "Straße und Hausnummer" 160
  legal_ask LEGAL_ZIP_CITY   "PLZ und Ort" 120
  legal_ask LEGAL_COUNTRY    "Land" 80
  legal_ask LEGAL_PHONE      "Telefon" 60
  legal_ask LEGAL_REGISTER   "Handelsregister / Register-Nr. (optional)" 200
  legal_ask LEGAL_VAT_ID     "USt-IdNr. (optional)" 40
  legal_ask CONTACT_EMAIL    "Kontakt-E-Mail für das Impressum" 200 email
  [ -n "$LEGAL_COUNTRY" ] || LEGAL_COUNTRY="Deutschland"

  if [ -z "$LEGAL_STREET" ] || [ -z "$LEGAL_ZIP_CITY" ] || [ -z "$CONTACT_EMAIL" ]; then
    warn "Anschrift oder Kontakt-E-Mail fehlen – Impressum und Datenschutz zeigen so lange "Angabe ergänzen" (Ergänzen: Admin → Einstellungen → Rechtliches)."
  else
    ok "Impressum-Daten erfasst"
  fi
}

ADMIN_PASSWORD_NEW=""
write_env() {
  if [ ! -f "$ENV_FILE" ]; then
    (umask 077; cp "$PROJECT_DIR/.env.production.example" "$ENV_FILE")
    ok ".env aus Vorlage erstellt"
  else
    ok "Vorhandene .env wird weiterverwendet (Geheimnisse bleiben erhalten)"
  fi
  chmod 600 "$ENV_FILE"

  # Bestehende Datenbank + fehlendes Passwort = Zugriff würde scheitern
  if [ -z "$(env_get POSTGRES_PASSWORD)" ] && docker volume inspect vylaris_pgdata >/dev/null 2>&1; then
    die "Es existiert bereits ein Datenbank-Volume (vylaris_pgdata), aber in .env fehlt POSTGRES_PASSWORD.
   Trage das ursprüngliche Passwort in $ENV_FILE ein, sonst kann die App die Datenbank nicht öffnen."
  fi

  [ -n "$(env_get AUTH_SECRET)" ]        || env_set AUTH_SECRET "$(rand_hex 32)"
  [ -n "$(env_get POSTGRES_PASSWORD)" ]  || env_set POSTGRES_PASSWORD "$(rand_hex 24)"
  if [ -z "$(env_get ADMIN_PASSWORD)" ]; then ADMIN_PASSWORD_NEW=$(gen_password); env_set ADMIN_PASSWORD "$ADMIN_PASSWORD_NEW"; fi

  env_set DOMAIN "$DOMAIN"
  [ "$ACCESS_MODE" = "cloudflare" ] || env_set ACME_EMAIL "$LE_EMAIL"
  env_set ADMIN_EMAIL "$ADMIN_EMAIL"
  env_set LEGAL_STREET "$LEGAL_STREET"
  env_set LEGAL_ZIP_CITY "$LEGAL_ZIP_CITY"
  env_set LEGAL_COUNTRY "$LEGAL_COUNTRY"
  env_set LEGAL_PHONE "$LEGAL_PHONE"
  env_set LEGAL_REGISTER "$LEGAL_REGISTER"
  env_set LEGAL_VAT_ID "$LEGAL_VAT_ID"
  env_set CONTACT_EMAIL "$CONTACT_EMAIL"
  env_set SITE_URL "https://$DOMAIN"
  env_set COOKIE_SECURE "true"
  # Basis-Domain der Beispieldienste im Seed (der Seed legt sie nur beim ersten Start an); eine
  # bewusst gesetzte eigene Vorgabe bleibt erhalten.
  case "$(env_get SEED_BASE_DOMAIN)" in ""|vylaris.example) env_set SEED_BASE_DOMAIN "${DOMAIN#www.}" ;; esac
  env_set APP_BIND "127.0.0.1"
  if [ "$ACCESS_MODE" = "cloudflare" ]; then
    env_set CLOUDFLARE_DOMAINS "$CF_DOMAINS"
    [ -z "$NET_CONTACT_EMAIL" ] || env_set NET_CONTACT_EMAIL "$NET_CONTACT_EMAIL"
    # COMPOSE_FILE wird erst nach erfolgreichem Cloudflare-Setup umgestellt (siehe run_cloudflare_setup)
  else
    env_set COMPOSE_FILE "docker-compose.yml:docker-compose.https.yml"
    if [ "$USE_STAGING" = "1" ]; then env_set ACME_CA "$ACME_STAGING"; else env_set ACME_CA "$ACME_PROD"; fi
  fi
}

# --- Cloudflare Tunnel ---------------------------------------------------------------------
# Führt scripts/cloudflare-setup.sh aus. Der API-Token wird verdeckt abgefragt (bzw. aus CLOUDFLARE_API_TOKEN
# gelesen), nur per Umgebung an das Skript übergeben und nirgends gespeichert oder ausgegeben.
run_cloudflare_setup() {
  local tok="${CLOUDFLARE_API_TOKEN:-}" rc args
  unset CLOUDFLARE_API_TOKEN
  if [ -z "$tok" ]; then
    [ -n "$TTY" ] || die "Kein Cloudflare-API-Token: CLOUDFLARE_API_TOKEN setzen oder den Installer in einem Terminal starten."
    hr
    print_cf_token_guide
    if ! confirm "Token erstellt und kopiert? (n = Anleitung später mit 'sudo $SELF cloudflare' erneut)" y; then
      die "Abgebrochen. Erstelle den Token und starte danach: sudo $SELF cloudflare"
    fi
    printf 'Token einfügen (Eingabe bleibt unsichtbar), dann Enter: ' >"$TTY"
    IFS= read -rs tok <"$TTY" || true
    printf '\n' >"$TTY"
    tok="${tok//[[:space:]]/}"
    [ -n "$tok" ] || die "Kein Token eingegeben."
    [ "${#tok}" -ge 30 ] || die "Das sieht nicht wie ein Cloudflare-API-Token aus (zu kurz). Bitte den ganzen Token kopieren."
  fi

  args=(--env-file "$ENV_FILE" --domains "$CF_DOMAINS")
  [ "$CF_REPLACE" = "1" ] && args+=(--replace)
  log "Richte den Cloudflare Tunnel ein …"
  rc=0
  CLOUDFLARE_API_TOKEN="$tok" bash "$PROJECT_DIR/scripts/cloudflare-setup.sh" "${args[@]}" || rc=$?
  if [ "$rc" -eq 3 ]; then
    # Konflikt mit vorhandenen DNS-Einträgen: nur nach ausdrücklicher Bestätigung ersetzen
    if confirm "Vorhandene DNS-Einträge (siehe oben) durch den Tunnel ersetzen?" n; then
      rc=0
      CLOUDFLARE_API_TOKEN="$tok" bash "$PROJECT_DIR/scripts/cloudflare-setup.sh" "${args[@]}" --replace || rc=$?
    else
      tok=""
      die "Abgebrochen: Es wurde nichts geändert. Mit --replace (oder nach manuellem Löschen der Einträge) erneut starten."
    fi
  fi
  tok=""
  [ "$rc" -eq 0 ] || die "Das Cloudflare-Setup ist fehlgeschlagen (siehe Meldungen oben). Nach der Korrektur: sudo $SELF cloudflare"
  [ -n "$(env_get CLOUDFLARE_TUNNEL_TOKEN)" ] || die "CLOUDFLARE_TUNNEL_TOKEN fehlt nach dem Setup in $ENV_FILE."

  env_set DOMAIN "$DOMAIN"
  env_set SITE_URL "https://$DOMAIN"
  env_set COOKIE_SECURE "true"
  env_set APP_BIND "127.0.0.1"
  env_set CLOUDFLARE_DOMAINS "$CF_DOMAINS"
  env_set COMPOSE_FILE "docker-compose.yml:docker-compose.cloudflare.yml"
  chmod 600 "$ENV_FILE"
}

# --- Deploy ---------------------------------------------------------------------------
deploy() {
  log "Baue und starte die Container (der erste Build dauert einige Minuten) …"
  if [ "$ACCESS_MODE" = "cloudflare" ] || docker ps -a --format '{{.Names}}' 2>/dev/null | grep -qx 'vylaris-europe-cloudflared'; then
    # --remove-orphans: beim Wechsel zwischen Caddy und Cloudflare Tunnel wird der nicht mehr benötigte
    # Container (Caddy bzw. cloudflared) entfernt; bei reinen Caddy-Installationen bleibt alles wie bisher.
    docker compose up -d --build --remove-orphans
  else
    docker compose up -d --build
  fi
}

curl_https() { # liefert HTTP-Code oder 000
  local k=(); [ "$USE_STAGING" = "1" ] && k=(-k)
  curl -sS "${k[@]}" -o /dev/null -w '%{http_code}' --max-time 10 "https://$DOMAIN/api/health" 2>/dev/null || true
}

wait_for_https() {
  log "Warte auf App und Zertifikat (bis zu 5 Minuten) …"
  local i code
  for i in $(seq 1 60); do
    code=$(curl_https)
    if [ "$code" = "200" ]; then ok "https://$DOMAIN antwortet (HTTP 200)"; return 0; fi
    printf '  … Versuch %s/60 (Antwort: %s)\r' "$i" "${code:-000}"
    sleep 5
  done
  printf '\n'
  warn "https://$DOMAIN ist nach 5 Minuten noch nicht erreichbar. Letzte Logs:"
  docker compose logs --tail 25 caddy 2>&1 | sed 's/^/   caddy | /' || true
  docker compose logs --tail 15 app 2>&1 | sed 's/^/   app   | /' || true
  cat <<EOF

Häufige Ursachen:
  • A-Record zeigt noch nicht auf diesen Server (DNS-Cache braucht evtl. länger)
  • Port 80/443 ist in der Cloud-Firewall/Security-Group des Anbieters gesperrt
  • Cloudflare-Proxy (orange Wolke) ist aktiv → für die Ausstellung auf "nur DNS" stellen
  • Let's-Encrypt-Limit erreicht → ./install.sh --staging zum Testen verwenden
Danach einfach erneut starten:  sudo $SELF   (bereits Erledigtes wird übersprungen)
EOF
  return 1
}

curl_domain() { # liefert HTTP-Code oder 000
  curl -sS -o /dev/null -w '%{http_code}' --max-time 10 "https://$1/api/health" 2>/dev/null || true
}

# Prüft alle Cloudflare-Domains über die öffentliche Adresse (mit Wiederholungen: Tunnel und DNS brauchen etwas Zeit).
# Nur die Hauptseite ist Pflicht; fehlende Nebendomains führen zu einer Warnung.
wait_for_cloudflare() {
  local i d code pending=() next=() primary_missing=0
  IFS=' ' read -ra pending <<<"$CF_DOMAINS"
  log "Warte, bis die Seiten über Cloudflare erreichbar sind (bis zu $((HEALTH_TRIES * HEALTH_SLEEP / 60 + 1)) Minuten) …"
  for i in $(seq 1 "$HEALTH_TRIES"); do
    next=()
    for d in "${pending[@]}"; do
      code=$(curl_domain "$d")
      if [ "$code" = "200" ]; then ok "https://$d antwortet (HTTP 200)"; else next+=("$d"); fi
    done
    pending=("${next[@]+"${next[@]}"}")
    [ "${#pending[@]}" -eq 0 ] && return 0
    printf '  … Versuch %s/%s, noch offen: %s\r' "$i" "$HEALTH_TRIES" "${pending[*]}"
    sleep "$HEALTH_SLEEP"
  done
  printf '\n'
  for d in "${pending[@]}"; do
    warn "https://$d ist noch nicht erreichbar."
    [ "$d" = "$DOMAIN" ] && primary_missing=1
  done
  docker compose logs --tail 15 cloudflared 2>&1 | sed 's/^/   cloudflared | /' || true
  docker compose logs --tail 10 app 2>&1 | sed 's/^/   app         | /' || true
  cat <<EOF

Häufige Ursachen:
  • Der Tunnel hat sich noch nicht verbunden (Logs oben: "Registered tunnel connection")
  • Die Domain ist bei Cloudflare noch nicht aktiv (Nameserver der Registrierung auf Cloudflare gestellt?)
  • Der DNS-Cache braucht noch einen Moment – in ein paar Minuten erneut prüfen
Danach einfach erneut starten:  sudo $SELF cloudflare   (bereits Erledigtes wird übersprungen)
EOF
  [ "$primary_missing" -eq 0 ]
}

cert_info() {
  [ "$USE_STAGING" = "1" ] && { warn "Staging-Zertifikat: Browser zeigen eine Warnung (gewollt). Für das echte Zertifikat ohne --staging erneut ausführen."; return 0; }
  local out
  out=$(echo | openssl s_client -connect "$DOMAIN:443" -servername "$DOMAIN" 2>/dev/null | openssl x509 -noout -issuer -enddate 2>/dev/null || true)
  [ -n "$out" ] && printf '%s\n' "$out" | sed 's/^/  /'
}

summary() {
  hr
  printf '%s✔ Installation abgeschlossen%s\n\n' "$C_GRN$C_BLD" "$C_OFF"
  if [ "$ACCESS_MODE" = "cloudflare" ]; then
    local d
    printf '  Adressen (alle über den Cloudflare Tunnel, dieselbe App und Datenbank):\n'
    for d in $CF_DOMAINS; do
      if [ "$d" = "$DOMAIN" ]; then printf '    https://%s   (Hauptdomain)\n' "$d"; else printf '    https://%s\n' "$d"; fi
    done
    case " $CF_DOMAINS " in *" vylaris.at "*) ;; *) printf '    vylaris.at ist noch offline (kein Tunnel-Hostname, kein DNS-Eintrag).\n' ;; esac
    printf '\n'
    printf '  Login:    https://%s/login   (Admins und Website-Nutzer; der Admin-Bereich /admin ist auf allen Domains erreichbar)\n' "$DOMAIN"
    printf '  Status:   https://%s/status\n' "$DOMAIN"
    printf '  Hinweis:  Die Anmeldung gilt je Domain getrennt (Cookies sind domaingebunden); Konten und Daten sind gemeinsam.\n\n'
    printf '  Der Cloudflare-API-Token wurde nicht gespeichert. Du kannst ihn jetzt bei Cloudflare löschen:\n'
    printf '  https://dash.cloudflare.com/profile/api-tokens\n\n'
  else
    printf '  Website:  https://%s\n' "$DOMAIN"
    printf '  Login:    https://%s/login   (Admins und Website-Nutzer – /admin ist ohne Admin-Anmeldung nicht erreichbar)\n' "$DOMAIN"
    printf '  Status:   https://%s/status\n\n' "$DOMAIN"
    cert_info
    printf '\n'
  fi
  if [ -n "$ADMIN_PASSWORD_NEW" ]; then
    printf '%s  Admin-Zugangsdaten (jetzt notieren – danach im Admin unter "Konto" ändern):%s\n' "$C_BLD" "$C_OFF"
    printf '    E-Mail:   %s\n    Passwort: %s\n\n' "$ADMIN_EMAIL" "$ADMIN_PASSWORD_NEW"
    printf '  Das Start-Passwort steht auch in %s (Rechte 600).\n' "$ENV_FILE"
  else
    printf '  Admin-E-Mail: %s (Passwort: siehe ADMIN_PASSWORD in %s bzw. bereits geändert)\n' "$ADMIN_EMAIL" "$ENV_FILE"
  fi
  cat <<EOF

Nächste Schritte (siehe README, Abschnitt "Vor dem Go-Live"):
  1. Anmelden unter https://$DOMAIN/login (mit den Admin-Zugangsdaten oben) – du landest im Admin-Dashboard.
  2. Admin → Einstellungen → E-Mail (SMTP): Mailserver eintragen und eine Testmail senden.
  3. Danach die Registrierung für Website-Nutzer aktivieren (nur mit funktionierendem Mailversand möglich).
  4. Admin → Einstellungen → Rechtliches: Impressum-Daten prüfen/ergänzen (Anfangswerte kamen aus dem Installer).
  5. Beispieldienste und Zitate im Admin bzw. mit Lucas Wilms abstimmen.
  6. Backups: docker compose exec db pg_dump -U vylaris vylaris > backup.sql

Wichtig: AUTH_SECRET in $ENV_FILE nicht mehr ändern – es verschlüsselt auch das SMTP-Passwort
in der Datenbank (bei Änderung muss es im Admin neu eingegeben werden).

Nützlich:
  Logs:      cd $PROJECT_DIR && docker compose logs -f
  Update:    sudo $SELF update
  Cloudflare: sudo $SELF cloudflare   (Tunnel/DNS erneut einrichten, z. B. weitere Domain)
  Stoppen:   cd $PROJECT_DIR && docker compose down      (Daten bleiben im Volume erhalten)
EOF
  hr
}

# --- Abläufe ----------------------------------------------------------------------------
do_install() {
  need_root "$@"
  printf '%sVylarisGroupEurope – Installation%s\n' "$C_BLD" "$C_OFF"; hr
  detect_pkg
  install_base_packages
  install_docker
  get_project
  choose_mode
  collect_config
  collect_legal
  ensure_memory
  if [ "$ACCESS_MODE" = "caddy" ]; then
    check_ports
    wait_for_dns "$DOMAIN"
    open_firewall
  fi
  write_env
  if [ "$ACCESS_MODE" = "cloudflare" ]; then
    run_cloudflare_setup
    deploy
    wait_for_cloudflare || exit 1
  else
    deploy
    wait_for_https || exit 1
  fi
  summary
}

# Cloudflare Tunnel (erneut) einrichten: Tunnel/DNS per API, danach Container neu starten
do_cloudflare() {
  need_root "$@"
  printf '%sVylarisGroupEurope – Cloudflare Tunnel%s\n' "$C_BLD" "$C_OFF"; hr
  detect_pkg; install_base_packages; install_docker; get_project
  [ -f "$ENV_FILE" ] || die "Keine .env gefunden – bitte zuerst './install.sh' ausführen."
  local was; was=$(current_mode)
  ACCESS_MODE=cloudflare
  choose_mode
  if [ "$was" = "caddy" ]; then
    warn "Diese Installation läuft bisher mit Caddy/Let's Encrypt. Beim Umstellen wird Caddy gestoppt und entfernt."
    confirm "Auf Cloudflare Tunnel umstellen?" y || die "Abgebrochen."
  fi
  ADMIN_EMAIL=$(env_get ADMIN_EMAIL)
  ask_cf_domains
  ask_net_contact
  [ -z "$NET_CONTACT_EMAIL" ] || env_set NET_CONTACT_EMAIL "$NET_CONTACT_EMAIL"
  run_cloudflare_setup
  deploy
  wait_for_cloudflare || exit 1
  summary
}

do_update() {
  need_root "$@"
  detect_pkg; install_base_packages; install_docker; get_project
  [ -f "$ENV_FILE" ] || die "Keine .env gefunden – bitte zuerst './install.sh' ausführen."
  DOMAIN=$(env_get DOMAIN); [ -n "$DOMAIN" ] || die "DOMAIN fehlt in .env."
  ADMIN_EMAIL=$(env_get ADMIN_EMAIL)
  ACCESS_MODE=$(current_mode); ACCESS_MODE="${ACCESS_MODE:-caddy}"
  if [ "$ACCESS_MODE" = "cloudflare" ]; then
    CF_DOMAINS=$(env_get CLOUDFLARE_DOMAINS); CF_DOMAINS="${CF_DOMAINS:-$CF_DEFAULT_DOMAINS}"
  fi
  [ "$(env_get ACME_CA)" = "$ACME_STAGING" ] && USE_STAGING=1
  if [ -d "$PROJECT_DIR/.git" ] && [ "$NO_PULL" != "1" ]; then
    local before after
    log "Hole neueste Version …"
    before=$(git -C "$PROJECT_DIR" rev-parse HEAD)
    git -C "$PROJECT_DIR" fetch --quiet origin "$BRANCH" || die "git fetch fehlgeschlagen."
    git -C "$PROJECT_DIR" merge --ff-only FETCH_HEAD || die "Das Update konnte nicht eingespielt werden (lokale Änderungen oder abweichender Verlauf). Prüfen mit: git -C $PROJECT_DIR status"
    after=$(git -C "$PROJECT_DIR" rev-parse HEAD)
    if [ "$before" != "$after" ]; then
      # install.sh kann sich durch den Pull selbst geändert haben: mit der neuen Version neu starten,
      # statt in der geänderten Datei an der alten Stelle weiterzulesen.
      log "Neue Version geladen – starte den Installer neu …"
      exec bash "$PROJECT_DIR/install.sh" update --no-pull
    fi
    ok "Bereits auf dem neuesten Stand"
  fi
  deploy
  if [ "$ACCESS_MODE" = "cloudflare" ]; then wait_for_cloudflare || exit 1; else wait_for_https || exit 1; fi
  ok "Update abgeschlossen"
}

main() {
  parse_args "$@"
  init_tty
  case "$COMMAND" in
    install)    do_install "$@" ;;
    update)     do_update "$@" ;;
    cloudflare) do_cloudflare "$@" ;;
  esac
}

# Nur ausführen, wenn direkt gestartet (nicht beim Einlesen per "source")
if [ "${BASH_SOURCE[0]:-$0}" = "$0" ]; then main "$@"; exit $?; fi
