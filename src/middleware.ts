import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifySession } from "@/lib/session";
import { isKnownHost, siteForHost } from "@/lib/sites";

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

const unauthorized = (locale: "de" | "en" = "de") =>
  NextResponse.json(
    { error: { code: "UNAUTHORIZED", message: locale === "en" ? "You are not signed in." : "Nicht angemeldet." } },
    { status: 401 },
  );

// Aufgaben:
//  - Domains, die noch nicht online sind (vylaris.at), zeigen nur eine Offline-Seite (503).
//  - Englische Pfad-Aliase: /imprint → /impressum, /privacy → /datenschutz.
//  - /admin/* und /api/admin/* → nur Admin-Sitzungen (auf allen Domains, die online sind). Sonst 404/401.
//  - /account/* und /api/account/* → jede gültige Sitzung (Details prüft der jeweilige Handler gegen die DB).
export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  const site = siteForHost(host);
  const known = isKnownHost(host);

  if (known && !site.online) {
    if (pathname === "/api/health") return NextResponse.next();
    return rewriteTo(req, "/offline");
  }

  // www.<domain> → <domain> (eine kanonische Adresse je Domain)
  if (known && host && /^www\./i.test(host.split(",")[0]!.trim())) {
    const u = publicUrl(req, pathname);
    u.host = u.host.replace(/^www\./i, "");
    u.search = req.nextUrl.search;
    return NextResponse.redirect(u, 308);
  }

  if (pathname === "/imprint") return rewriteTo(req, "/impressum");
  if (pathname === "/privacy") return rewriteTo(req, "/datenschutz");

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
    if (isApi) return unauthorized(site.locale);
    return rewriteTo(req, "/__nicht-gefunden");
  }

  // /account
  if (session) {
    const res = NextResponse.next();
    res.headers.set("Cache-Control", "no-store");
    return res;
  }
  if (isApi) return unauthorized(site.locale);
  const url = publicUrl(req, "/login");
  url.searchParams.set("next", pathname);
  return NextResponse.redirect(url);
}

export const config = { matcher: ["/((?!_next/static|_next/image|favicon.ico|images/|api/health).*)"] };
