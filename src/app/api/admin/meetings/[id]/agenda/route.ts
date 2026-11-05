import { handle, requireAdmin } from "@/lib/api";
import { createAgendaItem } from "@/lib/verein/meetings-data";
import { agendaCreateSchema } from "@/lib/verein/meetings-schemas";
import { idSchema } from "@/lib/verein/validation";
import { adminOk, readJson, type IdContext } from "../../../../_lib/http";

export const dynamic = "force-dynamic";

/** Traktandum am Ende der Liste hinzufügen. */
export const POST = handle(async (req: Request, ctx: IdContext) => {
  const admin = await requireAdmin(req);
  const id = idSchema.parse((await ctx.params).id);
  const input = agendaCreateSchema.parse(await readJson(req));
  const item = await createAgendaItem(admin, id, input);
  return adminOk({ id: item.id }, 201);
});
