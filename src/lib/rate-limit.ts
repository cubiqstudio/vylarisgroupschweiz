// Einfacher In-Memory-Limiter (pro Prozess). Für Mehr-Instanz-Betrieb ggf. durch Redis/Reverse-Proxy ersetzen.
type Bucket = { count: number; resetAt: number };
const buckets = new Map<string, Bucket>();

export function rateLimit(key: string, limit: number, windowMs: number): { ok: boolean; retryAfter: number } {
  const now = Date.now();
  if (buckets.size > 5000) {
    for (const [k, b] of buckets) if (b.resetAt <= now) buckets.delete(k);
  }
  const b = buckets.get(key);
  if (!b || b.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, retryAfter: 0 };
  }
  b.count += 1;
  if (b.count > limit) return { ok: false, retryAfter: Math.ceil((b.resetAt - now) / 1000) };
  return { ok: true, retryAfter: 0 };
}

export function resetRateLimit(key: string) {
  buckets.delete(key);
}

/**
 * Client-IP für Rate-Limits. Welchem Header man trauen darf, hängt vom Betrieb ab (Umgebungsvariable TRUST_PROXY):
 *  - "cloudflare": Betrieb hinter Cloudflare Tunnel. Cloudflare setzt CF-Connecting-IP selbst (Clients können ihn nicht vorgeben).
 *    Fehlt er, zählt der LETZTE X-Forwarded-For-Eintrag (den hängt der nächste Proxy an).
 *  - sonst (Caddy/Direktbetrieb): Caddy ersetzt X-Forwarded-For durch die echte Client-IP; der erste Eintrag zählt.
 */
export function clientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  if ((process.env.TRUST_PROXY ?? "").toLowerCase() === "cloudflare") {
    const cf = req.headers.get("cf-connecting-ip")?.trim();
    if (cf) return cf;
    const last = fwd?.split(",").pop()?.trim();
    return last || req.headers.get("x-real-ip") || "unknown";
  }
  if (fwd) return fwd.split(",")[0]!.trim();
  return req.headers.get("x-real-ip") ?? "unknown";
}
