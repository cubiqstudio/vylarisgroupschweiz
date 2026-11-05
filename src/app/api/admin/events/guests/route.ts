import { assertRole, handle, requireAdmin } from "@/lib/api";
import { REGISTRATION_STATUS_LABEL, labelOf } from "@/lib/verein/constants";
import { csvResponse } from "@/lib/verein/csv";
import { formatDateTimeCh } from "@/lib/verein/dates";
import { deleteGuestRegistrations, discloseGuestData } from "@/lib/verein/events-guests";
import { guestEmailSchema } from "@/lib/verein/events-schemas";
import { adminOk, readJson } from "../../../_lib/http";

export const dynamic = "force-dynamic";

const CSV_HEADERS = ["Anlass", "Datum des Anlasses", "Name", "E-Mail-Adresse", "Personen", "Status", "Bemerkung", "Einwilligung", "Angemeldet"] as const;

/**
 * Auskunft über alle Gast-Anmeldungen zu einer E-Mail-Adresse (revDSG Art. 25), über alle Anlässe. `?email=…`, mit `&format=csv` als Datei.
 * Enthält Namen und E-Mail-Adressen: nur mit Leserecht auf «Mitglieder» (wie die Teilnehmerliste); jede Auskunft steht im Änderungsprotokoll.
 */
export const GET = handle(async (req: Request) => {
  const admin = await requireAdmin(req);
  assertRole(admin, "members", "read");
  const params = new URL(req.url).searchParams;
  const { email } = guestEmailSchema.parse({ email: params.get("email") ?? "" });
  const rows = await discloseGuestData(admin, email);
  if (params.get("format") === "csv") {
    return csvResponse(
      "Gast-Auskunft",
      CSV_HEADERS,
      rows.map((r) => [r.eventTitle, r.startsAt, r.guestName, r.guestEmail, r.seats, labelOf(REGISTRATION_STATUS_LABEL, r.status), r.note, r.consentAt ? formatDateTimeCh(r.consentAt) : "", r.createdAt]),
    );
  }
  return adminOk({
    items: rows.map((r) => ({
      id: r.id,
      eventId: r.eventId,
      eventTitle: r.eventTitle,
      startsAt: r.startsAt.toISOString(),
      guestName: r.guestName,
      guestEmail: r.guestEmail,
      seats: r.seats,
      status: r.status,
      statusLabel: labelOf(REGISTRATION_STATUS_LABEL, r.status),
      note: r.note,
      consentAt: r.consentAt?.toISOString() ?? null,
      createdAt: r.createdAt.toISOString(),
    })),
  });
});

/** Löscht alle Gast-Anmeldungen zu einer E-Mail-Adresse samt Personendaten (Anfrage der betroffenen Person). Recht «Anlässe ändern». */
export const DELETE = handle(async (req: Request) => {
  const admin = await requireAdmin(req);
  const { email } = guestEmailSchema.parse(await readJson(req));
  return adminOk(await deleteGuestRegistrations(admin, email));
});
