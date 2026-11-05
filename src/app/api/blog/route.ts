import { db } from "@/lib/db";
import { handle } from "@/lib/api";
import { publicOk } from "../_lib/http";

export const dynamic = "force-dynamic";

export const GET = handle(async () => {
  const posts = await db.blogPost.findMany({
    where: { published: true },
    select: {
      id: true,
      title: true,
      slug: true,
      excerpt: true,
      author: true,
      published: true,
      publishedAt: true,
      createdAt: true,
      updatedAt: true,
    },
    orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
  });
  return publicOk(posts);
});
