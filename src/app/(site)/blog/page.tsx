import type { Metadata } from "next";
import { FileText, AlertTriangle } from "lucide-react";
import { db } from "@/lib/db";
import { Container, PageHeader } from "@/components/ui/section";
import { Card } from "@/components/ui/card";
import { ButtonLink } from "@/components/ui/button";
import { PostCard } from "@/components/blog/post-card";
import {
  POST_LIST_SELECT,
  toListItems,
  type PostListItem,
} from "@/components/blog/post-utils";
import { blog } from "@/i18n/blog";
import { getLocale, getMessages, getSite } from "@/i18n/server";
import type { Locale } from "@/i18n";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const site = await getSite();
  const m = await getMessages(blog);
  return {
    title: m.meta.title,
    description: m.meta.description(site.name),
    alternates: { canonical: "/blog" },
  };
}

async function loadPosts(
  locale: Locale,
): Promise<{ posts: PostListItem[]; failed: boolean }> {
  try {
    const rows = await db.blogPost.findMany({
      where: { published: true },
      select: POST_LIST_SELECT,
    });
    return { posts: toListItems(rows, locale), failed: false };
  } catch (err) {
    console.error(
      "[blog] Beiträge konnten nicht geladen werden:",
      err instanceof Error ? err.message : "unbekannter Fehler",
    );
    return { posts: [], failed: true };
  }
}

export default async function BlogPage() {
  const locale = await getLocale();
  const site = await getSite();
  const m = await getMessages(blog);
  const { posts, failed } = await loadPosts(locale);
  const [latest, ...rest] = posts;

  return (
    <>
      <PageHeader
        eyebrow={m.hero.eyebrow}
        title={m.hero.title}
        description={m.hero.description(site.name)}
      />
      <Container className="py-12 sm:py-16">
        {failed ? (
          <Card className="mx-auto max-w-xl p-8 text-center" role="alert">
            <AlertTriangle
              className="mx-auto size-8 text-amber-400"
              aria-hidden
            />
            <h2 className="mt-4 text-lg font-semibold text-white">
              {m.failed.title}
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-zinc-400">
              {m.failed.text}
            </p>
          </Card>
        ) : !latest ? (
          <Card className="mx-auto max-w-xl p-8 text-center sm:p-12">
            <FileText className="mx-auto size-8 text-zinc-500" aria-hidden />
            <h2 className="mt-4 text-lg font-semibold text-white">
              {m.empty.title}
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-zinc-400">
              {m.empty.text}
            </p>
            <ButtonLink href="/status" variant="secondary" className="mt-6">
              {m.empty.status}
            </ButtonLink>
          </Card>
        ) : (
          <div className="space-y-6">
            <PostCard post={latest} featured />
            {rest.length > 0 && (
              <>
                <h2 className="sr-only">{m.more}</h2>
                <ul className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                  {rest.map((post) => (
                    <li key={post.id}>
                      <PostCard post={post} />
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
        )}
      </Container>
    </>
  );
}
