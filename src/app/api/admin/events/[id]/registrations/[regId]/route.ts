import { handle, requireAdmin } from "@/lib/api";
import { adminDeleteRegistration, adminRegistrationAction } from "@/lib/verein/events-ops";
import { registrationActionSchema } from "@/lib/verein/events-schemas";
import { adminOk, readJson } from "../../../../../_lib/http";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string; regId: string }> };

/** Aktion auf einer Anmeldung: absagen, von der Warteliste anmelden, wiederherstellen, Anwesenheit, Personen/Notiz. */
export const PATCH = handle(async (req: Request, { params }: Ctx) => {
  const admin = await requireAdmin(req);
  const { id, regId } = await params;
  const input = registrationActionSchema.parse(await readJson(req));
  return adminOk(await adminRegistrationAction(admin, id, regId, input));
});

/** Anmeldung samt Personendaten löschen. */
export const DELETE = handle(async (req: Request, { params }: Ctx) => {
  const admin = await requireAdmin(req);
  const { id, regId } = await params;
  await adminDeleteRegistration(admin, id, regId);
  return adminOk({ id: regId });
});
