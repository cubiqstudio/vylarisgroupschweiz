import { db } from "@/lib/db";
import { handle, parseJson, requireAdmin } from "@/lib/api";
import { blogCreateSchema } from "@/lib/validation";
import { adminOk } from "../../_lib/http";

export const dynamic = "force-dynamic";

export const GET = handle(async (req: Request) => {
  await requireAdmin(req);
  const posts = await db.blogPost.findMany({
    select: {
      id: true,
      title: true,
      slug: true,
      excerpt: true,
      published: true,
      author: true,
      publishedAt: true,
      createdAt: true,
      updatedAt: true,
    },
    orderBy: [{ createdAt: "desc" }],
  });
  return adminOk(posts);
});

export const POST = handle(async (req: Request) => {
  await requireAdmin(req);
  const input = await parseJson(req, blogCreateSchema);
  const post = await db.blogPost.create({
    data: { ...input, publishedAt: input.published ? new Date() : null },
  });
  return adminOk(post, 201);
});
