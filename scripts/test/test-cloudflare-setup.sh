#!/usr/bin/env bash
# Testet scripts/cloudflare-setup.sh gegen den lokalen API-Mock (scripts/test/mock-cloudflare.py) – ohne Internet.
# Aufruf:  scripts/test/test-cloudflare-setup.sh
# Alle Tokens in diesem Test sind offensichtliche Dummy-Werte.
set -uo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SETUP="$HERE/../cloudflare-setup.sh"
MOCK="$HERE/mock-cloudflare.py"
TOK="test-token-not-real"
TOK_BAD="test-token-wrong-value"
TOK_NOTUNNEL="test-token-no-tunnel"
TOK_NODNS="test-token-no-dns"
TUNNEL_TOKEN_DUMMY="dGVzdC10dW5uZWwtdG9rZW4tbm90LXJlYWw=="

for c in python3 jq curl; do command -v "$c" >/dev/null || { echo "Benötigt: $c" >&2; exit 2; }; done

WORK=$(mktemp -d)
MOCK_PID=""
PASS=0; FAIL=0
cleanup() { [ -n "$MOCK_PID" ] && kill "$MOCK_PID" 2>/dev/null; rm -rf "$WORK"; }
trap cleanup EXIT

check() { # check "Beschreibung" Bedingung-als-Befehl…
  local desc="$1"; shift
  if "$@" >/dev/null 2>&1; then PASS=$((PASS + 1)); printf '  ok   %s\n' "$desc"
  else FAIL=$((FAIL + 1)); printf '  FAIL %s\n' "$desc"; fi
}

start_mock() { # start_mock [VERZÖGERUNG]
  [ -n "$MOCK_PID" ] && kill "$MOCK_PID" 2>/dev/null
  rm -f "$WORK/port"
  MOCK_DELAY="${1:-0}" python3 -I "$MOCK" "$WORK/port" &
  MOCK_PID=$!
  local _; for _ in $(seq 1 50); do [ -s "$WORK/port" ] && break; sleep 0.1; done
  [ -s "$WORK/port" ] || { echo "Mock startet nicht" >&2; exit 2; }
  BASE="http://127.0.0.1:$(cat "$WORK/port")"
}

state() { curl -s --noproxy '*' "$BASE/__state"; }
seed_dns() { curl -s --noproxy '*' -X POST -d "$1" "$BASE/__seed_dns" >/dev/null; }

OUT=""; RC=0
run_setup() { # run_setup TOKEN ARGS… → OUT, RC
  local tok="$1"; shift
  RC=0
  OUT=$(CLOUDFLARE_API_TOKEN="$tok" CLOUDFLARE_API_BASE="$BASE" NO_PROXY=127.0.0.1 no_proxy=127.0.0.1 \
    bash "$SETUP" --env-file "$ENVF" "$@" 2>&1 </dev/null) || RC=$?
}

no_secret_in() { ! grep -qF -- "$TOK" "$@" && ! grep -qF -- "$TOK_BAD" "$@"; }
out_clean() { ! printf '%s' "$OUT" | grep -qF -e "$TOK" -e "$TOK_BAD" -e "$TOK_NOTUNNEL" -e "$TOK_NODNS" -e "$TUNNEL_TOKEN_DUMMY"; }
out_has() { printf '%s' "$OUT" | grep -qF -- "$1"; }
jqs() { state | jq -e "$@"; }

ENVF="$WORK/env"

echo "1. Erstlauf"
start_mock
printf 'FOO=bar\n' >"$ENVF"; chmod 644 "$ENVF"
run_setup "$TOK"
check "Exit-Code 0" test "$RC" -eq 0
check "genau ein Tunnel 'vylaris-group'" jqs '(.tunnels | length) == 1 and ([.tunnels[].name] == ["vylaris-group"])'
check "6 DNS-Einträge (3 Domains x apex/www), alle CNAME proxied" \
  jqs '([.dns[][]] | length) == 6 and all(.dns[][]; .type == "CNAME" and .proxied == true and (.content | endswith(".cfargotunnel.com")))'
# shellcheck disable=SC2016 # jq-Ausdruck, keine Shell-Variablen
check "Ingress: 6 Hosts → http://app:3000 + 404" \
  jqs '(.configs | to_entries[0].value.ingress) as $i | ($i | length) == 7 and ($i[0:6] | all(.service == "http://app:3000")) and ($i[6] == {"service": "http_status:404"})'
check "keine Einträge/Ingress für vylaris.at" bash -c "! state_json=\$(curl -s --noproxy '*' '$BASE/__state') && false || ! printf '%s' \"\$state_json\" | grep -q 'vylaris.at'"
check ".env enthält CLOUDFLARE_TUNNEL_TOKEN" grep -q '^CLOUDFLARE_TUNNEL_TOKEN=.\+' "$ENVF"
check ".env behält bestehende Werte" grep -q '^FOO=bar$' "$ENVF"
check ".env hat Rechte 600" test "$(stat -c %a "$ENVF")" = 600
check "API-Token nicht in .env" no_secret_in "$ENVF"
check "API-Token/Tunnel-Token nicht in der Ausgabe" out_clean
check "Hinweis zum Löschen des Tokens" out_has "kann bei Cloudflare gelöscht werden"

echo "2. Zweiter Lauf (idempotent)"
W1=$(state | jq '.writes')
run_setup "$TOK"
check "Exit-Code 0" test "$RC" -eq 0
check "keine Schreibzugriffe" test "$(state | jq '.writes')" = "$W1"
check "weiterhin 1 Tunnel und 6 Einträge" jqs '(.tunnels | length) == 1 and ([.dns[][]] | length) == 6'
check "Token nicht in der Ausgabe" out_clean

echo "3. Konflikt mit vorhandenem A-Record"
start_mock
rm -f "$ENVF"
seed_dns '{"zone":"vylaris.de","type":"A","name":"vylaris.de","content":"192.0.2.10","proxied":true}'
run_setup "$TOK"
check "Exit-Code 3" test "$RC" -eq 3
check "Meldung nennt Eintrag und --replace" bash -c "printf '%s' \"\$1\" | grep -q 'vylaris.de: A 192.0.2.10' && printf '%s' \"\$1\" | grep -q -- '--replace'" _ "$OUT"
check "nichts geändert (kein Tunnel, keine Schreibzugriffe)" jqs '(.tunnels | length) == 0 and .writes == 0'
check "keine .env geschrieben" test ! -e "$ENVF"
run_setup "$TOK" --replace
check "mit --replace: Exit-Code 0" test "$RC" -eq 0
check "A-Record ersetzt, 6 CNAME-Einträge" jqs '([.dns[][]] | length) == 6 and all(.dns[][]; .type == "CNAME")'

echo "4. Falscher Token"
start_mock
run_setup "$TOK_BAD"
check "Exit-Code ≠ 0" test "$RC" -ne 0
check "verständliche Meldung" out_has "lehnt den API-Token ab"
check "nichts geändert" jqs '.writes == 0'
check "Token nicht in der Ausgabe" out_clean

echo "5. Fehlende Berechtigung"
start_mock
run_setup "$TOK_NOTUNNEL"
check "Tunnel-Recht fehlt: Exit-Code ≠ 0" test "$RC" -ne 0
check "Meldung nennt das benötigte Recht" out_has "Account → Cloudflare Tunnel: Bearbeiten"
check "Token nicht in der Ausgabe" out_clean
start_mock
run_setup "$TOK_NODNS"
check "DNS-Recht fehlt: Exit-Code ≠ 0" test "$RC" -ne 0
check "Meldung nennt das benötigte Recht" out_has "Zone → DNS: Bearbeiten"
check "nichts geändert" jqs '.writes == 0'

echo "6. --dry-run"
start_mock
rm -f "$ENVF"
run_setup "$TOK" --dry-run
check "Exit-Code 0" test "$RC" -eq 0
check "keine Schreibzugriffe" jqs '.writes == 0 and (.tunnels | length) == 0'
check "keine .env angelegt" test ! -e "$ENVF"
check "Ausgabe nennt geplante Änderungen" out_has "[Probelauf]"
check "Token nicht in der Ausgabe" out_clean

echo "7. Token taucht nicht in der Prozessliste auf"
start_mock 0.15
rm -f "$ENVF"
LEAK=0
# Der Token steht in einer Datei, damit die Suche ihn nicht selbst in einer Kommandozeile trägt.
printf '%s' "$TOK" >"$WORK/tok.pattern"
CLOUDFLARE_API_TOKEN="$TOK" CLOUDFLARE_API_BASE="$BASE" NO_PROXY=127.0.0.1 bash "$SETUP" --env-file "$ENVF" >"$WORK/bg.out" 2>&1 </dev/null &
BG=$!
SAMPLES=0
while kill -0 "$BG" 2>/dev/null; do
  SAMPLES=$((SAMPLES + 1))
  # shellcheck disable=SC2009 # bewusst die komplette Prozessliste durchsuchen
  if ps -eww -o args= | grep -qF -f "$WORK/tok.pattern"; then LEAK=1; fi
  for f in /proc/[0-9]*/cmdline; do
    { tr '\0' ' ' <"$f" | grep -qF -f "$WORK/tok.pattern"; } 2>/dev/null && LEAK=1
  done
  sleep 0.05
done
wait "$BG"; BGRC=$?
check "Lauf erfolgreich" test "$BGRC" -eq 0
check "mehrere Stichproben genommen ($SAMPLES)" test "$SAMPLES" -ge 3
check "Token in keiner Kommandozeile (ps und /proc)" test "$LEAK" -eq 0
check "Token nicht in Ausgabe und .env" no_secret_in "$WORK/bg.out" "$ENVF"

echo
echo "Ergebnis: $PASS bestanden, $FAIL fehlgeschlagen"
[ "$FAIL" -eq 0 ]
