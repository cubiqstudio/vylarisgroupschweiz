import { db } from "@/lib/db";
import { handle } from "@/lib/api";
import { notFound, publicOk } from "../../_lib/http";

export const dynamic = "force-dynamic";

export const GET = handle(async (_req: Request, ctx: { params: Promise<{ slug: string }> }) => {
  const { slug } = await ctx.params;
  const post = await db.blogPost.findFirst({ where: { slug, published: true } });
  if (!post) notFound("Beitrag");
  return publicOk(post);
});
