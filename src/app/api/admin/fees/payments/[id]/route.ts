import { handle, requireAdmin } from "@/lib/api";
import { deletePayment } from "@/lib/verein/fees-data";
import { idSchema } from "@/lib/verein/validation";
import { adminOk, type IdContext } from "../../../../_lib/http";

export const dynamic = "force-dynamic";

/** Zahlung löschen (samt Buchung, solange das Geschäftsjahr offen ist). */
export const DELETE = handle(async (req: Request, { params }: IdContext) => {
  const admin = await requireAdmin(req);
  const id = idSchema.parse((await params).id);
  await deletePayment(admin, id);
  return adminOk({ id });
});
