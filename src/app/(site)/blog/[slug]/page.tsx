import type { Metadata } from "next";
import { cache } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Calendar, Clock, User, MessageSquare } from "lucide-react";
import { db } from "@/lib/db";
import { blog } from "@/i18n/blog";
import { hasEnglish, localized } from "@/i18n";
import { authorName } from "@/i18n/labels";
import { getLocale, getMessages, getSite } from "@/i18n/server";
import { formatDate } from "@/lib/utils";
import { Container } from "@/components/ui/section";
import { Card } from "@/components/ui/card";
import { ButtonLink } from "@/components/ui/button";
import { Markdown } from "@/components/ui/markdown";
import { PostCard } from "@/components/blog/post-card";
import {
  POST_LIST_SELECT,
  readingMinutes,
  toListItems,
} from "@/components/blog/post-utils";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ slug: string }> };

const getPost = cache(async (slug: string) => {
  try {
    const post = await db.blogPost.findUnique({ where: { slug } });
    return post && post.published ? post : null;
  } catch (err) {
    console.error(
      "[blog] Beitrag konnte nicht geladen werden:",
      err instanceof Error ? err.message : "unbekannter Fehler",
    );
    return null;
  }
});

/** Auf der englischen Seite gibt es nur Beiträge mit englischem Inhalt (contentEn); alle anderen sind dort 404. */
async function getPostFor(slug: string, locale: "de" | "en") {
  const post = await getPost(slug);
  if (!post) return null;
  if (locale === "en" && !hasEnglish(post, "content")) return null;
  return post;
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const site = await getSite();
  const m = await getMessages(blog);
  const post = await getPostFor(slug, site.locale);
  if (!post) return { title: m.meta.notFound, robots: { index: false } };
  const title = localized(post, "title", site.locale);
  const excerpt = localized(post, "excerpt", site.locale);
  const date = post.publishedAt ?? post.createdAt;
  return {
    title,
    description: excerpt,
    alternates: { canonical: `/blog/${post.slug}` },
    authors: [{ name: authorName(post.author, site.locale) }],
    openGraph: {
      type: "article",
      title,
      description: excerpt,
      url: `/blog/${post.slug}`,
      siteName: site.name,
      locale: site.locale === "en" ? "en_US" : "de_DE",
      publishedTime: date.toISOString(),
      modifiedTime: post.updatedAt.toISOString(),
      authors: [authorName(post.author, site.locale)],
    },
  };
}

export default async function BlogPostPage({ params }: Params) {
  const { slug } = await params;
  const locale = await getLocale();
  const m = (await getMessages(blog)).post;
  const more = (await getMessages(blog)).more;
  const post = await getPostFor(slug, locale);
  if (!post) notFound();

  const title = localized(post, "title", locale);
  const excerpt = localized(post, "excerpt", locale);
  const content = localized(post, "content", locale);
  const date = post.publishedAt ?? post.createdAt;
  const minutes = readingMinutes(content);

  let others: ReturnType<typeof toListItems> = [];
  try {
    const rows = await db.blogPost.findMany({
      where: { published: true, NOT: { id: post.id } },
      select: POST_LIST_SELECT,
    });
    others = toListItems(rows, locale).slice(0, 2);
  } catch {
    others = [];
  }

  return (
    <>
      <article>
        <header className="relative overflow-hidden border-b border-zinc-900">
          <div
            className="bg-glow pointer-events-none absolute inset-0"
            aria-hidden
          />
          <div
            className="bg-grid pointer-events-none absolute inset-0"
            aria-hidden
          />
          <Container className="relative py-12 sm:py-16">
            <div className="mx-auto max-w-3xl">
              <Link
                href="/blog"
                className="inline-flex items-center gap-1.5 rounded text-sm text-zinc-400 transition-colors hover:text-white focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-emerald-400"
              >
                <ArrowLeft className="size-4" aria-hidden />
                {m.back}
              </Link>
              <h1 className="mt-6 text-4xl font-semibold tracking-tight text-white sm:text-5xl">
                {title}
              </h1>
              <p className="mt-5 text-lg leading-relaxed text-zinc-400">
                {excerpt}
              </p>
              <p className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-zinc-500">
                <span className="inline-flex items-center gap-1.5">
                  <Calendar className="size-4" aria-hidden />
                  <time dateTime={date.toISOString()}>
                    {formatDate(date, locale)}
                  </time>
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <User className="size-4" aria-hidden />
                  {authorName(post.author, locale)}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Clock className="size-4" aria-hidden />
                  {m.readingTime(minutes)}
                </span>
              </p>
            </div>
          </Container>
        </header>

        <Container className="py-12 sm:py-16">
          <div className="mx-auto max-w-3xl">
            <Markdown className="break-words [&_img]:h-auto [&_img]:max-w-full [&_table]:block [&_table]:overflow-x-auto">
              {content}
            </Markdown>
          </div>
        </Container>
      </article>

      <Container className="pb-16 sm:pb-24">
        <div className="mx-auto max-w-3xl space-y-12">
          <Card className="relative overflow-hidden p-6 sm:p-8">
            <div
              className="bg-glow pointer-events-none absolute inset-0 opacity-50"
              aria-hidden
            />
            <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-4">
                <MessageSquare
                  className="mt-1 size-6 shrink-0 text-emerald-400"
                  aria-hidden
                />
                <div>
                  <h2 className="text-lg font-semibold text-white">
                    {m.feedbackTitle}
                  </h2>
                  <p className="mt-1 text-sm leading-relaxed text-zinc-400">
                    {m.feedbackText}
                  </p>
                </div>
              </div>
              <ButtonLink href="/contact" className="shrink-0">
                {m.contact}
              </ButtonLink>
            </div>
          </Card>

          {others.length > 0 && (
            <section aria-labelledby="more-posts">
              <h2
                id="more-posts"
                className="text-xl font-semibold tracking-tight text-white"
              >
                {more}
              </h2>
              <ul className="mt-6 grid gap-6 sm:grid-cols-2">
                {others.map((p) => (
                  <li key={p.id}>
                    <PostCard post={p} headingLevel={3} />
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      </Container>
    </>
  );
}
