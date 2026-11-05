import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { db } from "@/lib/db";
import { requireModulePage } from "@/lib/verein/guard";
import { formatDateTime } from "@/lib/utils";
import { ContentHeader } from "@/components/admin/content/page-header";
import { BlogEditor } from "@/components/admin/content/blog-editor";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Beitrag bearbeiten" };

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ created?: string | string[] }>;
};

export default async function EditBlogPostPage({ params, searchParams }: Props) {
  const admin = await requireModulePage("website");
  const { id } = await params;
  const { created } = await searchParams;

  const post = await db.blogPost.findUnique({ where: { id } });
  if (!post) notFound();

  const flag = Array.isArray(created) ? created[0] : created;
  const initialNotice = flag === "published" ? "Beitrag angelegt und veröffentlicht." : flag === "draft" ? "Entwurf angelegt." : undefined;

  return (
    <div>
      <Link href="/admin/blog" className="mb-4 inline-flex items-center gap-1.5 text-sm text-zinc-400 hover:text-zinc-200">
        <ArrowLeft className="h-4 w-4" aria-hidden />
        Alle Beiträge
      </Link>
      <ContentHeader
        title="Beitrag bearbeiten"
        description={`Zuletzt geändert am ${formatDateTime(post.updatedAt)}.`}
      />
      <BlogEditor
        key={post.id}
        defaultAuthor={admin.name}
        initialNotice={initialNotice}
        post={{
          id: post.id,
          title: post.title,
          slug: post.slug,
          excerpt: post.excerpt,
          content: post.content,
          author: post.author,
          published: post.published,
        }}
      />
    </div>
  );
}
