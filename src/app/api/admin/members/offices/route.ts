import { handle, requireAdmin } from "@/lib/api";
import { createOffice } from "@/lib/verein/members-data";
import { officeCreateSchema } from "@/lib/verein/members-schemas";
import { adminOk, readJson } from "../../../_lib/http";

export const dynamic = "force-dynamic";

/** Amt vergeben (Mitglied, Amt, von/bis). Mehrfachbesetzung eines Einzelamts wird als Hinweis zurückgemeldet, nicht verboten. */
export const POST = handle(async (req: Request) => {
  const admin = await requireAdmin(req);
  const input = officeCreateSchema.parse(await readJson(req));
  const { office, warning } = await createOffice(admin, input);
  return adminOk({ id: office.id, warning: warning ?? null }, 201);
});
