import { PILL } from "@/components/admin/core/styles";
import { cn } from "@/lib/utils";
import {
  DOCUMENT_CATEGORY_LABEL,
  DOCUMENT_VISIBILITY_LABEL,
  DOCUMENT_VISIBILITY_TONE,
  TONE_CLASS,
  type DocumentCategory,
  type DocumentVisibility,
} from "@/lib/verein/constants";

export function CategoryPill({ category }: { category: string }) {
  return <span className={cn(PILL, TONE_CLASS.zinc)}>{DOCUMENT_CATEGORY_LABEL[category as DocumentCategory] ?? category}</span>;
}

export function VisibilityPill({ visibility }: { visibility: string }) {
  const known = visibility in DOCUMENT_VISIBILITY_LABEL;
  return (
    <span className={cn(PILL, known ? TONE_CLASS[DOCUMENT_VISIBILITY_TONE[visibility as DocumentVisibility]] : TONE_CLASS.zinc)}>
      {DOCUMENT_VISIBILITY_LABEL[visibility as DocumentVisibility] ?? visibility}
    </span>
  );
}

export function ArchivedPill() {
  return <span className={cn(PILL, TONE_CLASS.amber)}>Archiviert</span>;
}
