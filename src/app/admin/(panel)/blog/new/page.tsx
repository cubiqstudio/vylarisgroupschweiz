import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireModulePage } from "@/lib/verein/guard";
import { ContentHeader } from "@/components/admin/content/page-header";
import { BlogEditor } from "@/components/admin/content/blog-editor";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Neuer Beitrag" };

export default async function NewBlogPostPage() {
  const admin = await requireModulePage("website");

  return (
    <div>
      <Link href="/admin/blog" className="mb-4 inline-flex items-center gap-1.5 text-sm text-zinc-400 hover:text-zinc-200">
        <ArrowLeft className="h-4 w-4" aria-hidden />
        Alle Beiträge
      </Link>
      <ContentHeader
        title="Neuer Beitrag"
        description="Speichere zunächst als Entwurf. Auf der Website erscheint der Beitrag erst nach dem Veröffentlichen."
      />
      <BlogEditor defaultAuthor={admin.name} />
    </div>
  );
}
