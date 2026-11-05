import { db } from "@/lib/db";
import { handle } from "@/lib/api";
import { publicOk } from "../_lib/http";

export const dynamic = "force-dynamic";

export const GET = handle(async (req: Request) => {
  const { searchParams } = new URL(req.url);
  const category = searchParams.get("category")?.trim();
  const featured = searchParams.get("featured");

  const services = await db.saasService.findMany({
    where: {
      ...(category ? { category } : {}),
      ...(featured === "1" || featured === "true" ? { featured: true } : {}),
    },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });
  return publicOk(services);
});
