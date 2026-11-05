import { handle, parseJson, requireAdmin } from "@/lib/api";
import { db } from "@/lib/db";
import { auditActor, diffObjects, logAudit } from "@/lib/verein/audit";
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
  const admin = await requireAdmin(req);
  const input = await parseJson(req, legalSettingsSchema);
  const previous = await getLegalSettings();
  await saveLegalSettings(input);
  const diff = diffObjects(previous as unknown as Record<string, unknown>, (await getLegalSettings()) as unknown as Record<string, unknown>);
  const changed = Object.keys(diff.after);
  if (changed.length > 0) {
    await logAudit(db, {
      actor: auditActor(admin),
      action: "settings.legal",
      objectType: "SiteSetting",
      objectId: "legal",
      summary: `Rechtliches (Impressum, Datenschutz) geändert (${changed.join(", ")})`,
      ...diff,
    });
  }
  const [legal, state] = await Promise.all([getLegalSettings(), getLegal()]);
  return adminOk({ legal, isComplete: state.isComplete });
});
