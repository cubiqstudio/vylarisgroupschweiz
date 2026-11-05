"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { EyeOff, ExternalLink, Pencil, Send, Trash2 } from "lucide-react";
import { api, ApiClientError } from "@/lib/api-client";
import { buttonClass, Button } from "@/components/ui/button";
import { ConfirmDialog } from "./confirm-dialog";
import { Notice } from "./notice";

export function BlogRowActions({ id, slug, title, published }: { id: string; slug: string; title: string; published: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState<"toggle" | "delete" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  async function togglePublished() {
    setBusy("toggle");
    setError(null);
    try {
      await api(`/api/admin/blog/${id}`, { method: "PATCH", body: { published: !published } });
      router.refresh();
    } catch (e) {
      setError(e instanceof ApiClientError ? e.message : "Status konnte nicht geändert werden.");
    } finally {
      setBusy(null);
    }
  }

  async function remove() {
    setBusy("delete");
    setError(null);
    try {
      await api(`/api/admin/blog/${id}`, { method: "DELETE" });
      setConfirmOpen(false);
      router.refresh();
    } catch (e) {
      setError(e instanceof ApiClientError ? e.message : "Beitrag konnte nicht gelöscht werden.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flex flex-col items-start gap-2 lg:items-end">
      <div className="flex flex-wrap items-center gap-1.5">
        <Link href={`/admin/blog/${id}`} className={buttonClass("secondary", "sm")} aria-label={`«${title}» bearbeiten`}>
          <Pencil className="h-3.5 w-3.5" aria-hidden />
          Bearbeiten
        </Link>
        {published && (
          <a
            href={`/blog/${slug}`}
            target="_blank"
            rel="noopener noreferrer"
            className={buttonClass("ghost", "sm")}
            aria-label={`«${title}» ansehen (neuer Tab)`}
          >
            <ExternalLink className="h-3.5 w-3.5" aria-hidden />
            Ansehen
          </a>
        )}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={togglePublished}
          disabled={busy !== null}
          aria-label={`«${title}» ${published ? "zurückziehen" : "veröffentlichen"}`}
        >
          {published ? <EyeOff className="h-3.5 w-3.5" aria-hidden /> : <Send className="h-3.5 w-3.5" aria-hidden />}
          {busy === "toggle" ? "Wird gespeichert …" : published ? "Zurückziehen" : "Veröffentlichen"}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="text-rose-300 hover:bg-rose-500/10 hover:text-rose-200"
          onClick={() => {
            setError(null);
            setConfirmOpen(true);
          }}
          disabled={busy !== null}
          aria-label={`«${title}» löschen`}
        >
          <Trash2 className="h-3.5 w-3.5" aria-hidden />
          Löschen
        </Button>
      </div>
      {error && !confirmOpen && <Notice tone="error" className="w-full">{error}</Notice>}
      <ConfirmDialog
        open={confirmOpen}
        title="Beitrag löschen?"
        description={
          <>
            Der Beitrag <strong className="font-medium text-zinc-200">«{title}»</strong> wird endgültig gelöscht. Das lässt sich nicht
            rückgängig machen.
          </>
        }
        busy={busy === "delete"}
        error={confirmOpen ? error : null}
        onConfirm={remove}
        onCancel={() => setConfirmOpen(false)}
      />
    </div>
  );
}
