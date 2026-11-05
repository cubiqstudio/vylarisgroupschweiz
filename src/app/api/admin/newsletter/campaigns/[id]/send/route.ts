import { handle, requireAdmin } from "@/lib/api";
import { sendCampaign } from "@/lib/newsletter";
import { adminOk, type IdContext } from "../../../../../_lib/http";

export const dynamic = "force-dynamic";

/** Startet den Versand im Hintergrund und antwortet sofort mit 202 und den aktuellen Zählern. */
export const POST = handle(async (req: Request, ctx: IdContext) => {
  await requireAdmin(req);
  const { id } = await ctx.params;
  return adminOk(await sendCampaign(id), 202);
});
