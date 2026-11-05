import Link from "next/link";
import { ArrowRight, Calendar, User } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { blog } from "@/i18n/blog";
import { authorName } from "@/i18n/labels";
import { getLocale, getMessages } from "@/i18n/server";
import { cn, formatDate } from "@/lib/utils";
import type { PostListItem } from "./post-utils";

function Meta({ post, locale }: { post: PostListItem; locale: "de" | "en" }) {
  return (
    <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-zinc-500">
      <span className="inline-flex items-center gap-1.5">
        <Calendar className="size-3.5" aria-hidden />
        <time dateTime={post.date.toISOString()}>
          {formatDate(post.date, locale)}
        </time>
      </span>
      <span className="inline-flex items-center gap-1.5">
        <User className="size-3.5" aria-hidden />
        {authorName(post.author, locale)}
      </span>
    </p>
  );
}

export async function PostCard({
  post,
  featured = false,
  headingLevel = 2,
}: {
  post: PostListItem;
  featured?: boolean;
  headingLevel?: 2 | 3;
}) {
  const locale = await getLocale();
  const m = (await getMessages(blog)).card;
  const Heading = headingLevel === 3 ? "h3" : "h2";
  return (
    <Card
      className={cn(
        "group relative flex h-full flex-col overflow-hidden transition-colors hover:border-zinc-700 hover:bg-zinc-900/80",
        "focus-within:border-emerald-400/50",
        featured ? "p-6 sm:p-10" : "p-6",
      )}
    >
      {featured && (
        <div
          className="bg-glow pointer-events-none absolute inset-0 opacity-60"
          aria-hidden
        />
      )}
      <article className="relative flex h-full flex-col">
        {featured && (
          <Badge className="mb-5 w-fit bg-emerald-500/10 text-emerald-300 ring-emerald-500/30">
            {m.latest}
          </Badge>
        )}
        <Meta post={post} locale={locale} />
        <Heading
          className={cn(
            "mt-3 font-semibold tracking-tight text-white",
            featured ? "max-w-3xl text-3xl sm:text-4xl" : "text-xl",
          )}
        >
          <Link
            href={`/blog/${post.slug}`}
            className="rounded after:absolute after:inset-0 after:content-[''] focus-visible:outline-none focus-visible:after:rounded-2xl focus-visible:after:ring-2 focus-visible:after:ring-emerald-400"
          >
            {post.title}
          </Link>
        </Heading>
        <p
          className={cn(
            "mt-3 leading-relaxed text-zinc-400",
            featured ? "max-w-2xl text-lg" : "text-sm",
          )}
        >
          {post.excerpt}
        </p>
        <span className="mt-6 inline-flex items-center gap-1.5 pt-1 text-sm font-medium text-emerald-400 group-hover:text-emerald-300">
          {m.readMore}
          <ArrowRight
            className="size-4 transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none"
            aria-hidden
          />
        </span>
      </article>
    </Card>
  );
}
