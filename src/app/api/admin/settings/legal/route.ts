import { handle, parseJson, requireAdmin } from "@/lib/api";
import { getLegal } from "@/lib/legal";
import { getLegalSettings, saveLegalSettings } from "@/lib/settings";
import { legalSettingsSchema } from "@/lib/validation";
import { adminOk } from "../../../_lib/http";

export const dynamic = "force-dynamic";

export const GET = handle(async (req: Request) => {
  await requireAdmin(req);
  const [legal, state] = await Promise.all([getLegalSettings(), getLegal()]);
  return adminOk({ legal, isComplete: state.isComplete });
});

export const PUT = handle(async (req: Request) => {
  await requireAdmin(req);
  const input = await parseJson(req, legalSettingsSchema);
  await saveLegalSettings(input);
  const [legal, state] = await Promise.all([getLegalSettings(), getLegal()]);
  return adminOk({ legal, isComplete: state.isComplete });
});
