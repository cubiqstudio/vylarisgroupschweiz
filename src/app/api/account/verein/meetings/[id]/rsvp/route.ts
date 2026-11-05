import { handle } from "@/lib/api";
import { requireActiveMember } from "@/lib/verein/guard";
import { saveRsvp } from "@/lib/verein/meetings-data";
import { rsvpSchema } from "@/lib/verein/meetings-schemas";
import { idSchema } from "@/lib/verein/validation";
import { adminOk, readJson, type IdContext } from "../../../../../_lib/http";

export const dynamic = "force-dynamic";

/** Rückmeldung des angemeldeten Mitglieds (nimmt teil / entschuldigt sich). Das Mitglied ergibt sich aus der Sitzung, nie aus der Anfrage. */
export const POST = handle(async (req: Request, ctx: IdContext) => {
  const { member } = await requireActiveMember(req);
  const id = idSchema.parse((await ctx.params).id);
  const input = rsvpSchema.parse(await readJson(req));
  const state = await saveRsvp(member.id, id, input);
  return adminOk({ rsvp: state.rsvp });
});
