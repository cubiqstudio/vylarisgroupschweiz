import { handle, requireAdmin } from "@/lib/api";
import { auditActor } from "@/lib/verein/audit";
import { cancelEvent, duplicateEvent, sendEventReminders, setEventPublished } from "@/lib/verein/events-ops";
import { eventActionSchema } from "@/lib/verein/events-schemas";
import { adminOk, readJson, type IdContext } from "../../../../_lib/http";

export const dynamic = "force-dynamic";

/** Aktionen auf einem Anlass: veröffentlichen, zurückziehen, absagen, kopieren, Erinnerungen versenden. */
export const POST = handle(async (req: Request, { params }: IdContext) => {
  const admin = await requireAdmin(req);
  const { id } = await params;
  const input = eventActionSchema.parse(await readJson(req));
  switch (input.action) {
    case "publish":
      await setEventPublished(admin, id, true);
      return adminOk({ id });
    case "unpublish":
      await setEventPublished(admin, id, false);
      return adminOk({ id });
    case "cancel":
      return adminOk({ id, mail: await cancelEvent(admin, id, { reason: input.reason, notify: input.notify }) });
    case "duplicate": {
      const copy = await duplicateEvent(admin, id, input.startsAt);
      return adminOk({ id: copy.id }, 201);
    }
    case "reminders":
      return adminOk(await sendEventReminders({ eventId: id, actor: auditActor(admin) }));
  }
});
