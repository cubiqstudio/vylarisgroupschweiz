import { handle, requireAdmin } from "@/lib/api";
import { resetAccessPassword } from "@/lib/verein/access-data";
import { adminOk, type IdContext } from "../../../../_lib/http";

export const dynamic = "force-dynamic";

/** Setzt das Passwort eines Zugangs zurück (neues Startpasswort, einmal sichtbar; bestehende Sitzungen enden). */
export const POST = handle(async (req: Request, ctx: IdContext) => {
  const admin = await requireAdmin(req);
  const { id } = await ctx.params;
  return adminOk(await resetAccessPassword(admin, id));
});
