import { ApiError, handle } from "@/lib/api";
import { getViewer } from "@/lib/auth";
import { adminOk } from "../../_lib/http";

export const dynamic = "force-dynamic";

export const GET = handle(async () => {
  const viewer = await getViewer();
  if (!viewer) throw new ApiError(401, "UNAUTHORIZED", "Nicht angemeldet.");
  return adminOk({ user: viewer });
});
