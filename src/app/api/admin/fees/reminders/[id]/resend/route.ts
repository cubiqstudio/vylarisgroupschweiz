import { handle, requireAdmin } from "@/lib/api";
import { resendLastReminder } from "@/lib/verein/fees-ops";
import { idSchema } from "@/lib/verein/validation";
import { adminOk, type IdContext } from "../../../../../_lib/http";

export const dynamic = "force-dynamic";

/** Letzte Mahnung einer Rechnung erneut zustellen (z. B. nach einem Mailfehler). */
export const POST = handle(async (req: Request, { params }: IdContext) => {
  const admin = await requireAdmin(req);
  const id = idSchema.parse((await params).id);
  return adminOk(await resendLastReminder(admin, id));
});
