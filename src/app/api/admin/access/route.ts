import { handle, parseJson, requireAdmin } from "@/lib/api";
import { createAccessAccount, listAccessAccounts } from "@/lib/verein/access-data";
import { accessCreateSchema } from "@/lib/verein/access-schemas";
import { adminOk } from "../../_lib/http";

export const dynamic = "force-dynamic";

/** Zugänge und Rollen (Modul «system»): Liste. Nie mit Passwort-Hash. */
export const GET = handle(async (req: Request) => {
  await requireAdmin(req);
  const rows = await listAccessAccounts();
  return adminOk(rows.map((r) => ({ ...r, lastLoginAt: r.lastLoginAt?.toISOString() ?? null, createdAt: r.createdAt.toISOString() })));
});

/** Legt einen Zugang an. Das Startpasswort wird genau einmal zurückgegeben; die Person muss es bei der ersten Anmeldung ändern. */
export const POST = handle(async (req: Request) => {
  const admin = await requireAdmin(req);
  const input = await parseJson(req, accessCreateSchema);
  const created = await createAccessAccount(admin, input);
  return adminOk(created, 201);
});
