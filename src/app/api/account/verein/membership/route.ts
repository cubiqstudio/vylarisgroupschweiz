import { handle } from "@/lib/api";
import { getPortalMember, updateOwnProfile } from "@/lib/verein/members-data";
import { portalProfilePatchSchema } from "@/lib/verein/members-schemas";
import { requireMember } from "@/lib/verein/guard";
import { adminOk, notFound, parsePatch } from "../../../_lib/http";

export const dynamic = "force-dynamic";

/** Eigene Mitgliedsdaten. Es gibt keine ID in der Anfrage: massgeblich ist nur das mit der Sitzung verknüpfte Mitglied. */
export const GET = handle(async (req: Request) => {
  const { member } = await requireMember(req);
  const data = await getPortalMember(member.id);
  if (!data) notFound("Mitglied");
  return adminOk({ member: data });
});

/** Anschrift, Telefon und bevorzugten Kontaktweg selbst ändern. */
export const PATCH = handle(async (req: Request) => {
  const { member } = await requireMember(req);
  const patch = await parsePatch(req, portalProfilePatchSchema);
  await updateOwnProfile(member, patch);
  const data = await getPortalMember(member.id);
  return adminOk({ member: data });
});
