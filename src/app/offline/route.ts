// Wird von der Middleware für Domains angezeigt, die (noch) nicht online sind (z. B. vylaris.at).
export const dynamic = "force-dynamic";

export function GET() {
  const html = `<!doctype html><html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>Noch nicht online</title><style>body{margin:0;min-height:100vh;display:grid;place-items:center;font-family:system-ui,sans-serif;background:#f5f9fe;color:#101010;text-align:center;padding:24px}h1{font-size:1.6rem;margin:0 0 .5rem}p{margin:0;color:#444}</style></head><body><main><h1>Diese Seite ist noch nicht online.</h1><p>Wir arbeiten daran.</p></main></body></html>`;
  return new Response(html, {
    status: 503,
    headers: { "Content-Type": "text/html; charset=utf-8", "Retry-After": "3600", "Cache-Control": "no-store", "X-Robots-Tag": "noindex" },
  });
}
