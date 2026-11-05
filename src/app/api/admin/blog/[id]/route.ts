import { db } from "@/lib/db";
import { handle, requireAdmin } from "@/lib/api";
import { blogUpdateSchema } from "@/lib/validation";
import { adminOk, notFound, parsePatch, type IdContext } from "../../../_lib/http";

export const dynamic = "force-dynamic";

export const GET = handle(async (req: Request, ctx: IdContext) => {
  await requireAdmin(req);
  const { id } = await ctx.params;
  const post = await db.blogPost.findUnique({ where: { id } });
  if (!post) notFound("Beitrag");
  return adminOk(post);
});

export const PATCH = handle(async (req: Request, ctx: IdContext) => {
  await requireAdmin(req);
  const { id } = await ctx.params;
  const data = await parsePatch(req, blogUpdateSchema);

  const existing = await db.blogPost.findUnique({ where: { id }, select: { publishedAt: true } });
  if (!existing) notFound("Beitrag");

  // Erstveröffentlichung setzt publishedAt; ein späteres Depublizieren behält das ursprüngliche Datum.
  const publishedAt = data.published === true && !existing.publishedAt ? new Date() : undefined;

  const post = await db.blogPost.update({
    where: { id },
    data: { ...data, ...(publishedAt ? { publishedAt } : {}) },
  });
  return adminOk(post);
});

export const DELETE = handle(async (req: Request, ctx: IdContext) => {
  await requireAdmin(req);
  const { id } = await ctx.params;
  await db.blogPost.delete({ where: { id } });
  return adminOk({ id });
});
