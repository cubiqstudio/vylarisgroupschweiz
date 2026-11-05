import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { handle } from "@/lib/api";

export const dynamic = "force-dynamic";

// Für den Docker-Healthcheck: prüft, ob die Datenbank antwortet.
export const GET = handle(async () => {
  try {
    await db.adminUser.findFirst({ select: { id: true } });
  } catch (e) {
    console.error("[health] Datenbank nicht erreichbar", e instanceof Error ? e.message : e);
    return NextResponse.json(
      { data: { status: "error", db: false } },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
  return NextResponse.json({ data: { status: "ok", db: true } }, { headers: { "Cache-Control": "no-store" } });
});
