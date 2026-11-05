import type { Metadata } from "next";
import { FileText, Plus } from "lucide-react";
import { db } from "@/lib/db";
import { requireAdminPage } from "@/lib/auth";
import { formatDate } from "@/lib/utils";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ContentHeader } from "@/components/admin/content/page-header";
import { PostStatusBadge } from "@/components/admin/content/badges";
import { BlogRowActions } from "@/components/admin/content/blog-row-actions";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Blog verwalten" };

export default async function AdminBlogPage() {
  await requireAdminPage();

  const posts = await db.blogPost.findMany({
    select: { id: true, title: true, slug: true, published: true, author: true, publishedAt: true, createdAt: true, updatedAt: true },
    orderBy: [{ createdAt: "desc" }],
  });
  const publishedCount = posts.filter((p) => p.published).length;

  return (
    <div>
      <ContentHeader
        title="Blog"
        description={
          posts.length > 0
            ? `${posts.length} ${posts.length === 1 ? "Beitrag" : "Beiträge"}, davon ${publishedCount} veröffentlicht und ${posts.length - publishedCount} ${posts.length - publishedCount === 1 ? "Entwurf" : "Entwürfe"}.`
            : "Schreibe Neuigkeiten, Hintergründe und Release-Notizen für die öffentliche Website."
        }
        actions={
          <ButtonLink href="/admin/blog/new">
            <Plus className="h-4 w-4" aria-hidden />
            Neuer Beitrag
          </ButtonLink>
        }
      />

      {posts.length === 0 ? (
        <Card className="flex flex-col items-center px-6 py-16 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-zinc-800/80 text-zinc-400 ring-1 ring-inset ring-zinc-700">
            <FileText className="h-5 w-5" aria-hidden />
          </span>
          <h2 className="mt-4 text-lg font-semibold text-white">Noch keine Beiträge</h2>
          <p className="mt-1.5 max-w-sm text-sm text-zinc-400">
            Lege deinen ersten Beitrag als Entwurf an. Veröffentlicht wird erst, wenn du es ausdrücklich möchtest.
          </p>
          <ButtonLink href="/admin/blog/new" className="mt-6">
            <Plus className="h-4 w-4" aria-hidden />
            Ersten Beitrag schreiben
          </ButtonLink>
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <div
            className="hidden border-b border-zinc-800 bg-zinc-900/60 px-5 py-3 text-xs font-medium uppercase tracking-wider text-zinc-500 lg:grid lg:grid-cols-[minmax(0,1fr)_auto] lg:gap-6"
            aria-hidden
          >
            <span>Beitrag</span>
            <span className="text-right">Aktionen</span>
          </div>
          <ul className="divide-y divide-zinc-800">
            {posts.map((post) => (
              <li key={post.id} className="flex flex-col gap-4 px-4 py-4 sm:px-5 lg:grid lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center lg:gap-6">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <PostStatusBadge published={post.published} />
                    <h2 className="min-w-0 truncate text-sm font-semibold text-white sm:text-base">{post.title}</h2>
                  </div>
                  <p className="mt-1.5 truncate font-mono text-xs text-zinc-500">/blog/{post.slug}</p>
                  <p className="mt-1.5 text-xs text-zinc-400">
                    {post.author}
                    <span className="mx-1.5 text-zinc-700" aria-hidden>
                      ·
                    </span>
                    {post.published && post.publishedAt ? (
                      <>Veröffentlicht am {formatDate(post.publishedAt)}</>
                    ) : (
                      <>Erstellt am {formatDate(post.createdAt)}</>
                    )}
                    {post.updatedAt.getTime() - post.createdAt.getTime() > 60_000 && (
                      <>
                        <span className="mx-1.5 text-zinc-700" aria-hidden>
                          ·
                        </span>
                        Bearbeitet am {formatDate(post.updatedAt)}
                      </>
                    )}
                  </p>
                </div>
                <BlogRowActions id={post.id} slug={post.slug} title={post.title} published={post.published} />
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
