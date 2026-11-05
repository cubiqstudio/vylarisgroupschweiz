import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifySession } from "@/lib/session";
import { SITE } from "@/lib/sites";

/** Öffentliche Basis-URL aus den Proxy-Headern (im Standalone-Modus ist req.url sonst ggf. der interne Host, z. B. 0.0.0.0). */
function publicUrl(req: NextRequest, path: string): URL {
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  const proto = req.headers.get("x-forwarded-proto")?.split(",")[0]?.trim() ?? req.nextUrl.protocol.replace(":", "");
  return new URL(path, host ? `${proto}://${host}` : req.url);
}

/** Interne Umschreibung auf einen anderen Pfad derselben Anfrage (gleicher Ursprung, kein Proxy-Aufruf). */
function rewriteTo(req: NextRequest, path: string) {
  const url = req.nextUrl.clone();
  url.pathname = path;
  return NextResponse.rewrite(url);
}

const unauthorized = () => NextResponse.json({ error: { code: "UNAUTHORIZED", message: "Nicht angemeldet." } }, { status: 401 });

// Aufgaben:
//  - www.vylaris.ch → vylaris.ch (eine kanonische Adresse).
//  - /admin/* und /api/admin/* → nur Admin-Sitzungen. Sonst 404/401.
//  - /account/* und /api/account/* → jede gültige Sitzung (Details prüft der jeweilige Handler gegen die DB).
export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const host = (req.headers.get("x-forwarded-host") ?? req.headers.get("host"))?.split(",")[0]?.trim();

  if (host && host.toLowerCase().replace(/:\d+$/, "") === `www.${SITE.domain}`) {
    const u = publicUrl(req, pathname);
    u.host = u.host.replace(/^www\./i, "");
    u.search = req.nextUrl.search;
    return NextResponse.redirect(u, 308);
  }

  const isApi = pathname.startsWith("/api/");
  const isAdmin = pathname === "/admin" || pathname.startsWith("/admin/") || pathname.startsWith("/api/admin");
  const isAccount = pathname === "/account" || pathname.startsWith("/account/") || pathname.startsWith("/api/account");
  if (!isAdmin && !isAccount) return NextResponse.next();

  const session = await verifySession(req.cookies.get(SESSION_COOKIE)?.value);

  if (isAdmin) {
    if (session?.kind === "admin") {
      const res = NextResponse.next();
      res.headers.set("Cache-Control", "no-store");
      return res;
    }
    if (isApi) return unauthorized();
    return rewriteTo(req, "/__nicht-gefunden");
  }

  // /account
  if (session) {
    const res = NextResponse.next();
    res.headers.set("Cache-Control", "no-store");
    return res;
  }
  if (isApi) return unauthorized();
  const url = publicUrl(req, "/login");
  url.searchParams.set("next", pathname);
  return NextResponse.redirect(url);
}

export const config = { matcher: ["/((?!_next/static|_next/image|favicon.ico|images/|api/health).*)"] };
