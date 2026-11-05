import { db } from "@/lib/db";
import { ApiError, handle } from "@/lib/api";
import { requireUser } from "@/lib/account";
import { adminOk } from "../../_lib/http";
import { detectImageType, MAX_AVATAR_BYTES } from "@/lib/avatar";

export const dynamic = "force-dynamic";

/** Profilbild hochladen (nur Teammitglieder). Erwartet den rohen Bildinhalt als Body (PNG, JPEG oder WebP). */
export const POST = handle(async (req: Request) => {
  const current = await requireUser(req);
  const user = await db.user.findUnique({ where: { id: current.id }, select: { isTeam: true } });
  if (!user?.isTeam) throw new ApiError(403, "FORBIDDEN", "Profilbilder sind Teammitgliedern vorbehalten.");

  const declared = Number(req.headers.get("content-length") ?? "0");
  if (declared > MAX_AVATAR_BYTES) throw new ApiError(413, "TOO_LARGE", "Das Bild ist zu gross (maximal 300 KB).");
  const bytes = new Uint8Array(await req.arrayBuffer());
  if (bytes.byteLength === 0) throw new ApiError(400, "EMPTY", "Es wurde kein Bild übermittelt.");
  if (bytes.byteLength > MAX_AVATAR_BYTES) throw new ApiError(413, "TOO_LARGE", "Das Bild ist zu gross (maximal 300 KB).");
  const type = detectImageType(bytes);
  if (!type) throw new ApiError(415, "UNSUPPORTED", "Bitte ein PNG-, JPEG- oder WebP-Bild verwenden.");

  await db.user.update({ where: { id: current.id }, data: { avatar: bytes, avatarType: type } });
  return adminOk({ hasAvatar: true });
});

export const DELETE = handle(async (req: Request) => {
  const current = await requireUser(req);
  await db.user.update({ where: { id: current.id }, data: { avatar: null, avatarType: null } });
  return adminOk({ hasAvatar: false });
});
