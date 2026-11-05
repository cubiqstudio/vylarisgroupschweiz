#!/usr/bin/env bash
# Testet die Cloudflare-Abläufe von install.sh (install, update, cloudflare, Caddy-Modus) ohne Docker, Root-Änderungen
# und Internet: docker/dig/ss/ip/curl werden durch Attrappen ersetzt, die Cloudflare-API durch den lokalen Mock.
# Aufruf:  scripts/test/test-install-cloudflare.sh   (als root; es wird nur in ein Temp-Verzeichnis geschrieben)
set -uo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$HERE/../.." && pwd)"
MOCK="$HERE/mock-cloudflare.py"
TOK="test-token-not-real"
REAL_CURL="$(command -v curl)"

[ "$(id -u)" -eq 0 ] || { echo "Bitte als root ausführen (install.sh verlangt das)." >&2; exit 2; }
for c in python3 jq curl openssl; do command -v "$c" >/dev/null || { echo "Benötigt: $c" >&2; exit 2; }; done

WORK=$(mktemp -d)
MOCK_PID=""
PASS=0; FAIL=0
cleanup() { [ -n "$MOCK_PID" ] && kill "$MOCK_PID" 2>/dev/null; rm -rf "$WORK"; }
trap cleanup EXIT

check() {
  local desc="$1"; shift
  if "$@" >/dev/null 2>&1; then PASS=$((PASS + 1)); printf '  ok   %s\n' "$desc"
  else FAIL=$((FAIL + 1)); printf '  FAIL %s\n' "$desc"; fi
}

# --- Attrappen -----------------------------------------------------------------------
FAKE="$WORK/fakebin"; mkdir -p "$FAKE"
DOCKER_LOG="$WORK/docker.log"
cat >"$FAKE/docker" <<STUB
#!/usr/bin/env bash
echo "docker \$*" >>"$DOCKER_LOG"
case "\$1" in
  --version) echo "Docker version 0.0.0-test, build test" ;;
  volume) exit 1 ;;
esac
exit 0
STUB
for c in dig ss ip systemctl; do printf '#!/usr/bin/env bash\nexit 0\n' >"$FAKE/$c"; done
# curl: Health-Checks (https://…/api/health) liefern 200, alles andere geht an das echte curl (Mock-API auf localhost)
cat >"$FAKE/curl" <<STUB
#!/usr/bin/env bash
for a in "\$@"; do
  case "\$a" in https://*/api/health) printf '200'; exit 0 ;; esac
done
exec "$REAL_CURL" "\$@"
STUB
chmod +x "$FAKE"/*

# --- Projektkopie (ohne .git: kein Pull beim Update) ------------------------------------
PROJ="$WORK/proj"
mkdir -p "$PROJ/scripts" "$PROJ/docker"
cp "$ROOT"/install.sh "$ROOT"/docker-compose.yml "$ROOT"/docker-compose.https.yml "$ROOT"/docker-compose.cloudflare.yml \
   "$ROOT"/.env.production.example "$PROJ/"
cp "$ROOT/scripts/cloudflare-setup.sh" "$PROJ/scripts/"
cp "$ROOT/docker/Caddyfile" "$PROJ/docker/"
: >"$PROJ/Dockerfile"

start_mock() {
  [ -n "$MOCK_PID" ] && kill "$MOCK_PID" 2>/dev/null
  rm -f "$WORK/port"
  python3 -I "$MOCK" "$WORK/port" &
  MOCK_PID=$!
  local _; for _ in $(seq 1 50); do [ -s "$WORK/port" ] && break; sleep 0.1; done
  BASE="http://127.0.0.1:$(cat "$WORK/port")"
}
state() { curl -s --noproxy '*' "$BASE/__state"; }

OUT=""; RC=0
# inst ARGS… : install.sh mit Attrappen starten (ensure_memory entfällt, damit keine Swap-Datei angelegt wird)
inst() {
  : >"$DOCKER_LOG"; RC=0
  OUT=$(PATH="$FAKE:$PATH" CLOUDFLARE_API_TOKEN="${TEST_API_TOKEN-$TOK}" CLOUDFLARE_API_BASE="$BASE" NO_PROXY=127.0.0.1 no_proxy=127.0.0.1 \
    HEALTH_TRIES=2 HEALTH_SLEEP=0 \
    bash -c 'source "$1"; shift; ensure_memory() { :; }; main "$@"' install.sh "$PROJ/install.sh" "$@" 2>&1 </dev/null) || RC=$?
}
envget() { grep -E "^$1=" "$PROJ/.env" | tail -n1 | cut -d= -f2-; }
out_has() { printf '%s' "$OUT" | grep -qF -- "$1"; }
docker_has() { grep -qF -- "$1" "$DOCKER_LOG"; }
docker_lacks() { ! grep -qF -- "$1" "$DOCKER_LOG"; }
secrets_absent() { ! printf '%s' "$OUT" | grep -qF -e "$TOK" -e "$(envget CLOUDFLARE_TUNNEL_TOKEN)" && ! grep -qF -- "$TOK" "$PROJ/.env"; }

echo "A. Installation im Cloudflare-Modus"
start_mock
inst --yes --mode cloudflare --admin-email admin@vylaris.eu
check "Exit-Code 0" test "$RC" -eq 0
check "COMPOSE_FILE = Basis + Cloudflare-Overlay" test "$(envget COMPOSE_FILE)" = "docker-compose.yml:docker-compose.cloudflare.yml"
check "DOMAIN/SITE_URL = vylaris.eu" bash -c "[ \"$(envget DOMAIN)\" = vylaris.eu ] && [ \"$(envget SITE_URL)\" = https://vylaris.eu ]"
check "COOKIE_SECURE=true, APP_BIND=127.0.0.1" bash -c "[ \"$(envget COOKIE_SECURE)\" = true ] && [ \"$(envget APP_BIND)\" = 127.0.0.1 ]"
check "CLOUDFLARE_TUNNEL_TOKEN und CLOUDFLARE_DOMAINS gesetzt" bash -c "[ -n \"$(envget CLOUDFLARE_TUNNEL_TOKEN)\" ] && [ \"$(envget CLOUDFLARE_DOMAINS)\" = 'vylaris.eu vylaris.de vylaris.net' ]"
check ".env hat Rechte 600" test "$(stat -c %a "$PROJ/.env")" = 600
check "Container mit --build --remove-orphans gestartet" docker_has "compose up -d --build --remove-orphans"
check "Mock: 6 DNS-Einträge, 1 Tunnel, kein vylaris.at" bash -c "state_json=\$(curl -s --noproxy '*' '$BASE/__state'); echo \"\$state_json\" | jq -e '([.dns[][]] | length) == 6 and (.tunnels | length) == 1' && ! echo \"\$state_json\" | grep -q 'vylaris.at'"
check "Zusammenfassung nennt alle drei Adressen" bash -c "printf '%s' \"\$1\" | grep -q 'https://vylaris.eu' && printf '%s' \"\$1\" | grep -q 'https://vylaris.de' && printf '%s' \"\$1\" | grep -q 'https://vylaris.net'" _ "$OUT"
check "Hinweis: vylaris.at offline" out_has "vylaris.at ist noch offline"
check "keine Caddy-/DNS-/Port-Prüfung" bash -c "! printf '%s' \"\$1\" | grep -qE 'DNS-Einstellung|Ports 80 und 443'" _ "$OUT"
check "Token weder in Ausgabe noch in .env" secrets_absent
check "SEED_BASE_DOMAIN = Hauptdomain" test "$(envget SEED_BASE_DOMAIN)" = vylaris.eu
check "Hinweise nennen den Installer-Pfad statt \$0 (sudo …/install.sh update)" out_has "sudo $PROJ/install.sh update"
check "kein falscher Hinweis, /admin gebe es nur auf der Hauptdomain" bash -c "! printf '%s' \"\$1\" | grep -q 'gibt es nur auf'" _ "$OUT"

echo "B. Update im Cloudflare-Modus"
inst update
check "Exit-Code 0" test "$RC" -eq 0
check "Container neu gestartet (Cloudflare-Overlay bleibt)" docker_has "compose up -d --build --remove-orphans"
check "keine neue API-Abfrage nötig (kein Token verlangt)" bash -c "! printf '%s' \"\$1\" | grep -q 'Cloudflare-API-Token'" _ "$OUT"
check "COMPOSE_FILE unverändert" test "$(envget COMPOSE_FILE)" = "docker-compose.yml:docker-compose.cloudflare.yml"

echo "C. Zweiter Aufruf von 'install.sh cloudflare' (idempotent)"
W1=$(state | jq '.writes')
inst cloudflare
check "Exit-Code 0" test "$RC" -eq 0
check "keine Schreibzugriffe an der API" test "$(state | jq '.writes')" = "$W1"
check "Token nicht in der Ausgabe" secrets_absent

echo "D. Caddy-Modus unverändert (Neuinstallation)"
rm -f "$PROJ/.env"
inst --yes --mode caddy --domain www.example.org --email admin@example.org --admin-email admin@example.org --skip-dns-check --staging
check "Exit-Code 0" test "$RC" -eq 0
check "COMPOSE_FILE = Basis + HTTPS-Overlay" test "$(envget COMPOSE_FILE)" = "docker-compose.yml:docker-compose.https.yml"
check "ACME_EMAIL und DOMAIN gesetzt" bash -c "[ \"$(envget ACME_EMAIL)\" = admin@example.org ] && [ \"$(envget DOMAIN)\" = www.example.org ]"
check "Start ohne --remove-orphans" docker_lacks "remove-orphans"
check "Ports werden geprüft" out_has "Ports 80 und 443 sind frei"
check "kein Cloudflare-Token verlangt" bash -c "! printf '%s' \"\$1\" | grep -qi 'Cloudflare-API-Token'" _ "$OUT"

echo "E. Update im Caddy-Modus unverändert"
inst update
check "Exit-Code 0" test "$RC" -eq 0
check "Start ohne --remove-orphans" docker_lacks "remove-orphans"

echo "F. Umstellen von Caddy auf Cloudflare per 'install.sh cloudflare'"
start_mock
inst cloudflare
check "Exit-Code 0" test "$RC" -eq 0
check "COMPOSE_FILE umgestellt" test "$(envget COMPOSE_FILE)" = "docker-compose.yml:docker-compose.cloudflare.yml"
check "Caddy wird als Waise entfernt (--remove-orphans)" docker_has "--remove-orphans"
check "Hinweis auf Umstellung" out_has "Caddy gestoppt"

echo "G. Konflikt mit vorhandenem DNS-Eintrag (nicht interaktiv)"
start_mock
rm -f "$PROJ/.env"
curl -s --noproxy '*' -X POST -d '{"zone":"vylaris.net","type":"A","name":"www.vylaris.net","content":"192.0.2.55"}' "$BASE/__seed_dns" >/dev/null
inst --yes --mode cloudflare --admin-email admin@vylaris.eu
check "bricht ab (Exit-Code ≠ 0)" test "$RC" -ne 0
check "Meldung nennt den Konflikt" out_has "www.vylaris.net: A 192.0.2.55"
check "COMPOSE_FILE nicht auf Cloudflare umgestellt" bash -c "! grep -q '^COMPOSE_FILE=.*cloudflare' '$PROJ/.env'"
check "Container nicht gestartet" docker_lacks "compose up"
inst --yes --mode cloudflare --admin-email admin@vylaris.eu --replace
check "mit --replace: Exit-Code 0" test "$RC" -eq 0

echo "H. Ohne Token (nicht interaktiv)"
start_mock
rm -f "$PROJ/.env"
TEST_API_TOKEN="" inst --yes --mode cloudflare --admin-email admin@vylaris.eu
check "Abbruch mit klarer Meldung" bash -c "[ $RC -ne 0 ] && printf '%s' \"\$1\" | grep -q 'CLOUDFLARE_API_TOKEN'" _ "$OUT"
check "Container nicht gestartet" docker_lacks "compose up"

echo
echo "Ergebnis: $PASS bestanden, $FAIL fehlgeschlagen"
[ "$FAIL" -eq 0 ]
