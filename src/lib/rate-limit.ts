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
 * Client-IP aus den Proxy-Headern (reine Funktion, testbar). Der Eintrag wird von RECHTS gezählt: Jeder vertrauenswürdige Proxy hängt die
 * Adresse seines Gegenübers hinten an; was Clients vorne in X-Forwarded-For schreiben, hat keinen Einfluss.
 *  - cloudflare: CF-Connecting-IP (setzt Cloudflare selbst), sonst der letzte X-Forwarded-For-Eintrag.
 *  - sonst: der `hops`-te Eintrag von rechts (Standard 1 = ein vertrauenswürdiger Proxy, z. B. Caddy; hält die Kette kürzer, der erste).
 */
export function pickClientIp(h: { forwardedFor: string | null; cfConnectingIp: string | null; realIp: string | null; trustProxy: string; hops: number }): string {
  const entries = (h.forwardedFor ?? "").split(",").map((e) => e.trim()).filter(Boolean);
  if (h.trustProxy.toLowerCase() === "cloudflare") {
    const cf = h.cfConnectingIp?.trim();
    if (cf) return cf;
    return entries[entries.length - 1] || h.realIp || "unknown";
  }
  if (entries.length > 0) {
    const hops = Number.isInteger(h.hops) && h.hops >= 1 ? h.hops : 1;
    return entries[Math.max(0, entries.length - hops)]!;
  }
  return h.realIp ?? "unknown";
}

/**
 * Client-IP für Rate-Limits. Welchem Header man trauen darf, hängt vom Betrieb ab:
 *  - TRUST_PROXY=cloudflare: Betrieb hinter Cloudflare Tunnel (CF-Connecting-IP).
 *  - TRUST_PROXY_HOPS (Standard 1): Anzahl vertrauenswürdiger Proxys vor der App; gezählt wird X-Forwarded-For von rechts.
 * Der Proxy muss die Adresse seines Gegenübers anhängen oder den Header ersetzen. Reicht er einen vom Client gesetzten Header
 * unverändert durch (und hängt nichts an), lassen sich die IP-Limits umgehen.
 */
export function clientIp(req: Request): string {
  return pickClientIp({
    forwardedFor: req.headers.get("x-forwarded-for"),
    cfConnectingIp: req.headers.get("cf-connecting-ip"),
    realIp: req.headers.get("x-real-ip"),
    trustProxy: process.env.TRUST_PROXY ?? "",
    hops: Number(process.env.TRUST_PROXY_HOPS ?? "1"),
  });
}
