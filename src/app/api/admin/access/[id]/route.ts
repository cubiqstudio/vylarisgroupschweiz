import { handle, requireAdmin } from "@/lib/api";
import { deleteAccessAccount, updateAccessAccount } from "@/lib/verein/access-data";
import { accessPatchSchema } from "@/lib/verein/access-schemas";
import { adminOk, parsePatch, type IdContext } from "../../../_lib/http";

export const dynamic = "force-dynamic";

/** Name, Rollen oder verknüpftes Mitglied ändern. Schutzregeln (letzter Vollzugriff, eigene Rolle, Inhaber) prüft updateAccessAccount. */
export const PATCH = handle(async (req: Request, ctx: IdContext) => {
  const admin = await requireAdmin(req);
  const { id } = await ctx.params;
  const patch = await parsePatch(req, accessPatchSchema.partial());
  await updateAccessAccount(admin, id, patch);
  return adminOk({ id });
});

export const DELETE = handle(async (req: Request, ctx: IdContext) => {
  const admin = await requireAdmin(req);
  const { id } = await ctx.params;
  await deleteAccessAccount(admin, id);
  return adminOk({ id });
});
