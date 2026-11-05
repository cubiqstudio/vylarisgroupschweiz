#!/usr/bin/env python3
"""Minimaler Mock der Cloudflare-API für scripts/test/test-cloudflare-setup.sh (ohne Internet).

Unterstützt genau die Endpunkte, die scripts/cloudflare-setup.sh benutzt. Der Zustand liegt im Speicher.
Test-Hilfen (ohne Authentifizierung):
  GET  /__state          kompletter Zustand + Anzahl der Schreibzugriffe
  POST /__seed_dns       {"zone":"vylaris.ch","type":"A","name":"vylaris.ch","content":"192.0.2.10"}
Gültige Tokens (Dummy-Werte):
  test-token-not-real        alles erlaubt
  test-token-no-tunnel       403 auf allen Tunnel-Endpunkten
  test-token-no-dns          403 auf allen DNS-Endpunkten
Jeder andere Token führt zu 401. MOCK_DELAY (Sekunden) verzögert jede Antwort.
"""
import json
import os
import sys
import time
import uuid
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs, urlparse

ACCOUNT = "acc0123456789abcdef0123456789abcd"
ZONES = {n: {"id": "zone-" + n.replace(".", "-"), "name": n, "status": "active", "account": {"id": ACCOUNT}}
         for n in ("vylaris.ch",)}
VALID = {"test-token-not-real": set(), "test-token-no-tunnel": {"tunnel"}, "test-token-no-dns": {"dns"}}
DELAY = float(os.environ.get("MOCK_DELAY", "0"))

STATE = {"tunnels": {}, "configs": {}, "dns": {}, "writes": 0, "requests": []}


def ok(result):
    return 200, {"success": True, "errors": [], "messages": [], "result": result}


def err(code, status, message):
    return status, {"success": False, "errors": [{"code": code, "message": message}], "messages": [], "result": None}


class Handler(BaseHTTPRequestHandler):
    def log_message(self, *a):  # still
        pass

    def _send(self, status, body):
        data = json.dumps(body).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def _body(self):
        n = int(self.headers.get("Content-Length") or 0)
        return json.loads(self.rfile.read(n) or b"{}") if n else {}

    def _handle(self, method):
        if DELAY:
            time.sleep(DELAY)
        u = urlparse(self.path)
        path, q = u.path, {k: v[0] for k, v in parse_qs(u.query).items()}

        if path == "/__state":
            return self._send(200, STATE)
        if path == "/__seed_dns" and method == "POST":
            b = self._body()
            rec = {"id": "rec-" + uuid.uuid4().hex[:8], "type": b["type"], "name": b["name"], "content": b["content"],
                   "proxied": b.get("proxied", False)}
            STATE["dns"].setdefault(ZONES[b["zone"]]["id"], []).append(rec)
            return self._send(200, rec)

        # Header-Prüfung (nur Bearer-Token)
        auth = self.headers.get("Authorization", "")
        token = auth[7:] if auth.startswith("Bearer ") else ""
        STATE["requests"].append(f"{method} {path}")
        if token not in VALID:
            return self._send(*err(1000, 401, "Invalid API Token"))
        denied = VALID[token]

        if method != "GET":
            STATE["writes"] += 1

        if path == "/user/tokens/verify":
            return self._send(*ok({"id": "tok1", "status": "active"}))

        if path == "/zones" and method == "GET":
            name = q.get("name")
            return self._send(*ok([z for n, z in ZONES.items() if name in (None, n)]))

        parts = path.strip("/").split("/")

        # --- Tunnel ---
        if parts[0] == "accounts" and len(parts) >= 3 and parts[2] == "cfd_tunnel":
            if "tunnel" in denied:
                return self._send(*err(10000, 403, "Authentication error"))
            if len(parts) == 3 and method == "GET":
                name = q.get("name")
                return self._send(*ok([t for t in STATE["tunnels"].values() if name in (None, t["name"])]))
            if len(parts) == 3 and method == "POST":
                b = self._body()
                tid = str(uuid.uuid4())
                t = {"id": tid, "name": b["name"], "config_src": b.get("config_src", "local"), "deleted_at": None,
                     "token": "dGVzdC10dW5uZWwtdG9rZW4tbm90LXJlYWw" + "=="}
                STATE["tunnels"][tid] = t
                return self._send(*ok(t))
            tid = parts[3]
            if tid not in STATE["tunnels"]:
                return self._send(*err(1003, 404, "Tunnel not found"))
            if parts[4:] == ["token"]:
                return self._send(*ok(STATE["tunnels"][tid]["token"]))
            if parts[4:] == ["configurations"]:
                if method == "GET":
                    return self._send(*ok({"tunnel_id": tid, "config": STATE["configs"].get(tid)}))
                if method == "PUT":
                    STATE["configs"][tid] = self._body()["config"]
                    return self._send(*ok({"tunnel_id": tid, "config": STATE["configs"][tid]}))

        # --- DNS ---
        if parts[0] == "zones" and len(parts) >= 3 and parts[2] == "dns_records":
            if "dns" in denied:
                return self._send(*err(10000, 403, "Authentication error"))
            zid = parts[1]
            recs = STATE["dns"].setdefault(zid, [])
            if len(parts) == 3 and method == "GET":
                name = q.get("name")
                return self._send(*ok([r for r in recs if name in (None, r["name"])]))
            if len(parts) == 3 and method == "POST":
                b = self._body()
                if b["type"] == "CNAME" and any(r["name"] == b["name"] for r in recs):
                    return self._send(*err(81053, 400, "An A, AAAA, or CNAME record with that host already exists."))
                rec = dict(b, id="rec-" + uuid.uuid4().hex[:8])
                recs.append(rec)
                return self._send(*ok(rec))
            if len(parts) == 4:
                rec = next((r for r in recs if r["id"] == parts[3]), None)
                if rec is None:
                    return self._send(*err(81044, 404, "Record does not exist."))
                if method in ("PUT", "PATCH"):
                    rec.update(self._body())
                    return self._send(*ok(rec))
                if method == "DELETE":
                    recs.remove(rec)
                    return self._send(*ok({"id": rec["id"]}))

        return self._send(*err(7003, 404, f"No route for {method} {path}"))

    def do_GET(self): self._handle("GET")
    def do_POST(self): self._handle("POST")
    def do_PUT(self): self._handle("PUT")
    def do_PATCH(self): self._handle("PATCH")
    def do_DELETE(self): self._handle("DELETE")


def main():
    port_file = sys.argv[1] if len(sys.argv) > 1 else None
    srv = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
    if port_file:
        with open(port_file, "w") as f:
            f.write(str(srv.server_address[1]))
    srv.serve_forever()


if __name__ == "__main__":
    main()
