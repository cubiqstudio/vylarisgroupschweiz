import { assertSameOrigin, handle } from "@/lib/api";
import { SESSION_COOKIE, sessionCookieOptions } from "@/lib/session";
import { adminOk } from "../../_lib/http";

export const dynamic = "force-dynamic";

export const POST = handle(async (req: Request) => {
  assertSameOrigin(req);
  const res = adminOk({ loggedOut: true });
  res.cookies.set(SESSION_COOKIE, "", { ...sessionCookieOptions(), maxAge: 0 });
  return res;
});
