import { db } from "@/lib/db";
import { getViewer } from "@/lib/auth";

export const dynamic = "force-dynamic";

/** Profilbild eines Teammitglieds – nur für angemeldete Personen sichtbar. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const viewer = await getViewer();
  if (!viewer) return new Response(null, { status: 404 });
  const { id } = await params;
  const u = await db.user.findUnique({ where: { id }, select: { avatar: true, avatarType: true, isTeam: true, disabled: true } });
  if (!u?.avatar || !u.avatarType || !u.isTeam || u.disabled) return new Response(null, { status: 404 });
  return new Response(new Uint8Array(u.avatar), {
    headers: {
      "Content-Type": u.avatarType,
      "Cache-Control": "private, max-age=300",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; sandbox",
    },
  });
}
