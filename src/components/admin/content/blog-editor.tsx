"use client";

import { useCallback, useDeferredValue, useEffect, useId, useMemo, useRef, useState } from "react";
import type { KeyboardEvent } from "react";
import { useRouter } from "next/navigation";
import { ExternalLink, Eye, HelpCircle, Pencil, Save, Send, Trash2, Undo2, Wand2 } from "lucide-react";
import { api, ApiClientError } from "@/lib/api-client";
import { cn, slugify } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, Input, Textarea } from "@/components/ui/form";
import { Markdown } from "@/components/ui/markdown";
import { ConfirmDialog } from "./confirm-dialog";
import { EnglishSection } from "@/components/admin/core/english-section";
import { Notice } from "./notice";
import { PostStatusBadge } from "./badges";

export type EditorPost = {
  id: string;
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  author: string;
  published: boolean;
  titleEn: string | null;
  excerptEn: string | null;
  contentEn: string | null;
};

type Fields = {
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  author: string;
  titleEn: string;
  excerptEn: string;
  contentEn: string;
};
type Busy = "draft" | "publish" | "unpublish" | "save" | "delete" | null;
type Tab = "write" | "preview";

const EXCERPT_MAX = 400;
const EXCERPT_EN_MAX = 400;
const FIELD_ORDER: (keyof Fields)[] = ["title", "slug", "author", "excerpt", "content", "titleEn", "excerptEn", "contentEn"];
const FIELD_IDS: Record<keyof Fields, string> = {
  title: "post-title",
  slug: "post-slug",
  author: "post-author",
  excerpt: "post-excerpt",
  content: "post-content",
  titleEn: "post-title-en",
  excerptEn: "post-excerpt-en",
  contentEn: "post-content-en",
};

const snapshot = (f: Fields) => JSON.stringify([f.title, f.slug, f.excerpt, f.content, f.author, f.titleEn, f.excerptEn, f.contentEn]);

const initialFields = (post: EditorPost | undefined, defaultAuthor: string): Fields => ({
  title: post?.title ?? "",
  slug: post?.slug ?? "",
  excerpt: post?.excerpt ?? "",
  content: post?.content ?? "",
  author: post?.author ?? defaultAuthor,
  titleEn: post?.titleEn ?? "",
  excerptEn: post?.excerptEn ?? "",
  contentEn: post?.contentEn ?? "",
});

const HELP: { label: string; code: string }[] = [
  { label: "Überschriften", code: "## Abschnitt\n### Unterabschnitt" },
  { label: "Hervorhebung", code: "**fett**, *kursiv*, `Code`" },
  { label: "Listen", code: "- Punkt\n- Punkt\n\n1. Schritt\n2. Schritt" },
  { label: "Links", code: "[Linktext](https://example.org)" },
  { label: "Zitate", code: "> Zitierter Text" },
  { label: "Codeblock", code: "```\ndocker compose up -d\n```" },
];

export function BlogEditor({
  post,
  defaultAuthor,
  initialNotice,
}: {
  post?: EditorPost;
  defaultAuthor: string;
  initialNotice?: string;
}) {
  const router = useRouter();
  const uid = useId();
  const isEdit = Boolean(post);

  const [fields, setFields] = useState<Fields>(() => initialFields(post, defaultAuthor));
  const [slugTouched, setSlugTouched] = useState(isEdit);
  const [published, setPublished] = useState(post?.published ?? false);
  const [savedSlug, setSavedSlug] = useState(post?.slug ?? "");
  const [baseline, setBaseline] = useState(() => snapshot(initialFields(post, defaultAuthor)));
  const [errors, setErrors] = useState<Partial<Record<keyof Fields, string>>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(initialNotice ?? null);
  const [busy, setBusy] = useState<Busy>(null);
  const [tab, setTab] = useState<Tab>("write");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const dirty = snapshot(fields) !== baseline;
  const dirtyRef = useRef(dirty);
  dirtyRef.current = dirty;
  const leaving = useRef(false);

  const previewSource = useDeferredValue(fields.content);

  function set<K extends keyof Fields>(key: K, value: Fields[K]) {
    setFields((f) => ({ ...f, [key]: value }));
    setSuccess(null);
    if (errors[key]) setErrors((e) => ({ ...e, [key]: undefined }));
  }

  function onTitle(value: string) {
    setFields((f) => ({ ...f, title: value, slug: slugTouched ? f.slug : slugify(value) }));
    setSuccess(null);
    setErrors((e) => ({ ...e, title: undefined, ...(slugTouched ? {} : { slug: undefined }) }));
  }

  // Warnung bei Reload/Tab schließen und bei Klicks auf interne Links, solange ungespeicherte Änderungen existieren.
  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (!dirtyRef.current || leaving.current) return;
      e.preventDefault();
      e.returnValue = "";
    };
    const onClick = (e: MouseEvent) => {
      if (!dirtyRef.current || leaving.current || e.defaultPrevented) return;
      if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!a || (a.target && a.target !== "_self") || a.hasAttribute("download")) return;
      const url = new URL(a.href, window.location.href);
      if (url.origin !== window.location.origin) return;
      if (url.pathname === window.location.pathname && url.search === window.location.search) return;
      if (!window.confirm("Du hast ungespeicherte Änderungen. Die Seite wirklich verlassen?")) {
        e.preventDefault();
        e.stopPropagation();
      }
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    document.addEventListener("click", onClick, true);
    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload);
      document.removeEventListener("click", onClick, true);
    };
  }, []);

  const focusFirstError = useCallback((errs: Partial<Record<keyof Fields, string>>) => {
    const first = FIELD_ORDER.find((k) => errs[k]);
    if (!first) return;
    if (first === "content") setTab("write");
    requestAnimationFrame(() => document.getElementById(`${uid}${FIELD_IDS[first]}`)?.focus());
  }, [uid]);

  async function save(target: boolean, kind: Exclude<Busy, "delete" | null>) {
    setBusy(kind);
    setFormError(null);
    setSuccess(null);
    setErrors({});
    const body = {
      title: fields.title.trim(),
      slug: fields.slug.trim(),
      excerpt: fields.excerpt.trim(),
      content: fields.content,
      author: fields.author.trim(),
      // Leere englische Felder werden serverseitig als null gespeichert.
      titleEn: fields.titleEn.trim(),
      excerptEn: fields.excerptEn.trim(),
      contentEn: fields.contentEn,
      published: target,
    };
    try {
      if (post) {
        await api(`/api/admin/blog/${post.id}`, { method: "PATCH", body });
        setPublished(target);
        setSavedSlug(body.slug);
        setBaseline(snapshot(fields));
        router.refresh();
        setSuccess(
          kind === "publish"
            ? "Beitrag veröffentlicht."
            : kind === "unpublish"
              ? "Veröffentlichung zurückgezogen. Der Beitrag ist wieder ein Entwurf."
              : kind === "draft"
                ? "Entwurf gespeichert."
                : "Änderungen gespeichert.",
        );
      } else {
        const created = await api<{ id: string }>("/api/admin/blog", { method: "POST", body });
        leaving.current = true;
        router.replace(`/admin/blog/${created.id}?created=${target ? "published" : "draft"}`);
        router.refresh();
        return;
      }
    } catch (e) {
      if (e instanceof ApiClientError) {
        if (e.code === "CONFLICT") {
          const errs = { slug: "Dieser Slug ist bereits vergeben. Wähle eine andere URL-Kennung, z. B. durch einen Zusatz wie „-2“." };
          setErrors(errs);
          setFormError("Der Beitrag wurde nicht gespeichert, weil der Slug bereits verwendet wird.");
          focusFirstError(errs);
        } else if (e.fields && Object.keys(e.fields).length > 0) {
          const errs: Partial<Record<keyof Fields, string>> = {};
          for (const k of FIELD_ORDER) if (e.fields[k]) errs[k] = e.fields[k];
          setErrors(errs);
          setFormError("Bitte korrigiere die markierten Felder.");
          focusFirstError(errs);
        } else {
          setFormError(e.message);
        }
      } else {
        setFormError("Unerwarteter Fehler beim Speichern.");
      }
    } finally {
      if (!leaving.current) setBusy((b) => (b === kind ? null : b));
    }
  }

  async function remove() {
    if (!post) return;
    setBusy("delete");
    setDeleteError(null);
    try {
      await api(`/api/admin/blog/${post.id}`, { method: "DELETE" });
      leaving.current = true;
      router.replace("/admin/blog");
      router.refresh();
    } catch (e) {
      setDeleteError(e instanceof ApiClientError ? e.message : "Beitrag konnte nicht gelöscht werden.");
      setBusy(null);
    }
  }

  function onTabKey(e: KeyboardEvent<HTMLDivElement>) {
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight" && e.key !== "Home" && e.key !== "End") return;
    e.preventDefault();
    const next: Tab = e.key === "ArrowLeft" || e.key === "Home" ? "write" : "preview";
    setTab(next);
    document.getElementById(`${uid}tab-${next}`)?.focus();
  }

  const charCount = fields.excerpt.length;
  const disabled = busy !== null;
  const derivedSlug = useMemo(() => slugify(fields.title), [fields.title]);
  const id = (k: keyof Fields) => `${uid}${FIELD_IDS[k]}`;

  return (
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        save(published, published ? "save" : "draft");
      }}
      className="space-y-6"
    >
      <Card className="p-5 sm:p-6">
        <div className="grid gap-5 md:grid-cols-2">
          <Field label="Titel" htmlFor={id("title")} error={errors.title} className="md:col-span-2">
            <Input
              id={id("title")}
              value={fields.title}
              onChange={(e) => onTitle(e.target.value)}
              maxLength={160}
              autoComplete="off"
              aria-invalid={Boolean(errors.title)}
              placeholder="Worum geht es in diesem Beitrag?"
              className="h-11 text-base"
            />
          </Field>

          <Field
            label="Slug (URL-Kennung)"
            htmlFor={id("slug")}
            error={errors.slug}
            hint={fields.slug ? `Adresse auf der Website: /blog/${fields.slug}` : "Wird automatisch aus dem Titel erzeugt."}
          >
            <div className="flex gap-2">
              <Input
                id={id("slug")}
                value={fields.slug}
                onChange={(e) => {
                  setSlugTouched(true);
                  set("slug", e.target.value);
                }}
                maxLength={80}
                autoComplete="off"
                spellCheck={false}
                aria-invalid={Boolean(errors.slug)}
                className="font-mono"
              />
              {slugTouched && fields.slug !== derivedSlug && derivedSlug && (
                <Button
                  type="button"
                  variant="secondary"
                  className="shrink-0 px-3"
                  onClick={() => {
                    setSlugTouched(false);
                    set("slug", derivedSlug);
                  }}
                  title="Slug aus dem Titel neu erzeugen"
                  aria-label="Slug aus dem Titel neu erzeugen"
                >
                  <Wand2 className="h-4 w-4" aria-hidden />
                </Button>
              )}
            </div>
          </Field>

          <Field label="Autor" htmlFor={id("author")} error={errors.author}>
            <Input
              id={id("author")}
              value={fields.author}
              onChange={(e) => set("author", e.target.value)}
              maxLength={80}
              autoComplete="off"
              aria-invalid={Boolean(errors.author)}
            />
          </Field>

          <Field label="Auszug" htmlFor={id("excerpt")} error={errors.excerpt} className="md:col-span-2">
            <Textarea
              id={id("excerpt")}
              value={fields.excerpt}
              onChange={(e) => set("excerpt", e.target.value)}
              rows={3}
              maxLength={EXCERPT_MAX}
              aria-invalid={Boolean(errors.excerpt)}
              aria-describedby={`${uid}excerpt-count`}
              placeholder="Ein bis zwei Sätze für Blog-Übersicht und Suchmaschinen."
            />
            <p
              id={`${uid}excerpt-count`}
              className={cn("text-right text-xs tabular-nums", charCount >= EXCERPT_MAX - 20 ? "text-amber-400" : "text-zinc-500")}
            >
              {charCount} / {EXCERPT_MAX} Zeichen
            </p>
          </Field>
        </div>
      </Card>

      <div>
        <div className="mb-2 flex flex-wrap items-end justify-between gap-3">
          <label htmlFor={id("content")} className="text-sm font-medium text-zinc-300">
            Inhalt <span className="font-normal text-zinc-500">(Markdown)</span>
          </label>
          <div
            role="tablist"
            aria-label="Editor-Ansicht"
            onKeyDown={onTabKey}
            className="inline-flex rounded-lg border border-zinc-800 bg-zinc-950 p-0.5 lg:hidden"
          >
            {(
              [
                ["write", "Schreiben", Pencil],
                ["preview", "Vorschau", Eye],
              ] as const
            ).map(([key, text, Icon]) => (
              <button
                key={key}
                type="button"
                role="tab"
                id={`${uid}tab-${key}`}
                aria-selected={tab === key}
                aria-controls={`${uid}pane-${key}`}
                tabIndex={tab === key ? 0 : -1}
                onClick={() => setTab(key)}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                  tab === key ? "bg-zinc-800 text-white" : "text-zinc-400 hover:text-zinc-200",
                )}
              >
                <Icon className="h-3.5 w-3.5" aria-hidden />
                {text}
              </button>
            ))}
          </div>
          <span className="hidden text-sm font-medium text-zinc-300 lg:block lg:w-[calc(50%-0.5rem)]">Vorschau</span>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <div
            id={`${uid}pane-write`}
            role="tabpanel"
            aria-labelledby={`${uid}tab-write`}
            className={cn(tab === "preview" && "hidden", "lg:block")}
          >
            <Textarea
              id={id("content")}
              value={fields.content}
              onChange={(e) => set("content", e.target.value)}
              spellCheck
              aria-invalid={Boolean(errors.content)}
              aria-describedby={errors.content ? `${uid}content-error` : undefined}
              placeholder={"## Überschrift\n\nSchreibe hier deinen Beitrag in Markdown …"}
              className="h-[26rem] resize-y font-mono text-[13px] leading-6 lg:h-[36rem]"
            />
            {errors.content && (
              <p id={`${uid}content-error`} role="alert" className="mt-1.5 text-xs text-rose-400">
                {errors.content}
              </p>
            )}
          </div>
          <div
            id={`${uid}pane-preview`}
            role="tabpanel"
            aria-labelledby={`${uid}tab-preview`}
            className={cn(tab === "write" && "hidden", "lg:block")}
          >
            <div className="h-[26rem] overflow-y-auto rounded-lg border border-zinc-800 bg-zinc-900/40 p-5 lg:h-[36rem]">
              {previewSource.trim() ? (
                <Markdown>{previewSource}</Markdown>
              ) : (
                <p className="text-sm text-zinc-500">Sobald du Text schreibst, erscheint hier die Vorschau so, wie sie auf der Website aussehen wird.</p>
              )}
            </div>
          </div>
        </div>

        <details className="group mt-3 rounded-lg border border-zinc-800 bg-zinc-900/30">
          <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-2.5 text-sm text-zinc-400 hover:text-zinc-200 [&::-webkit-details-marker]:hidden">
            <HelpCircle className="h-4 w-4" aria-hidden />
            Markdown-Hilfe
          </summary>
          <dl className="grid gap-x-6 gap-y-4 border-t border-zinc-800 px-4 py-4 sm:grid-cols-2 lg:grid-cols-3">
            {HELP.map((h) => (
              <div key={h.label}>
                <dt className="text-xs font-medium uppercase tracking-wider text-zinc-500">{h.label}</dt>
                <dd className="mt-1.5">
                  <pre className="overflow-x-auto rounded-md border border-zinc-800 bg-zinc-950 px-3 py-2 font-mono text-xs leading-5 text-zinc-300">{h.code}</pre>
                </dd>
              </div>
            ))}
          </dl>
        </details>
      </div>

      <EnglishSection
        filled={Boolean(post?.titleEn || post?.excerptEn || post?.contentEn)}
        hasError={Boolean(errors.titleEn || errors.excerptEn || errors.contentEn)}
        hint="Ohne englischen Inhalt erscheint der Beitrag auf vylaris.net nicht. Titel, Auszug und Inhalt (Markdown) sollten vollständig übersetzt sein."
      >
        <Field label="Titel (Englisch)" htmlFor={id("titleEn")} error={errors.titleEn}>
          <Input
            id={id("titleEn")}
            value={fields.titleEn}
            onChange={(e) => set("titleEn", e.target.value)}
            maxLength={160}
            autoComplete="off"
            lang="en"
            aria-invalid={Boolean(errors.titleEn)}
          />
        </Field>
        <Field label="Auszug (Englisch)" htmlFor={id("excerptEn")} error={errors.excerptEn}>
          <Textarea
            id={id("excerptEn")}
            value={fields.excerptEn}
            onChange={(e) => set("excerptEn", e.target.value)}
            rows={3}
            maxLength={EXCERPT_EN_MAX}
            lang="en"
            aria-invalid={Boolean(errors.excerptEn)}
          />
          <p className={cn("text-right text-xs tabular-nums", fields.excerptEn.length >= EXCERPT_EN_MAX - 20 ? "text-amber-400" : "text-zinc-500")}>
            {fields.excerptEn.length} / {EXCERPT_EN_MAX} Zeichen
          </p>
        </Field>
        <Field label="Inhalt (Englisch, Markdown)" htmlFor={id("contentEn")} error={errors.contentEn}>
          <Textarea
            id={id("contentEn")}
            value={fields.contentEn}
            onChange={(e) => set("contentEn", e.target.value)}
            lang="en"
            aria-invalid={Boolean(errors.contentEn)}
            className="h-[26rem] resize-y font-mono text-[13px] leading-6"
          />
        </Field>
      </EnglishSection>

      <div className="z-10 lg:sticky lg:bottom-3">
        <Card className="space-y-3 bg-zinc-900/90 p-4 shadow-2xl shadow-black/40">
          {(formError || success) && (
            <div className="space-y-2">
              {formError && <Notice tone="error">{formError}</Notice>}
              {success && !formError && <Notice tone="success">{success}</Notice>}
            </div>
          )}
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-sm">
              <PostStatusBadge published={published} />
              {dirty ? (
                <span className="inline-flex items-center gap-1.5 text-amber-300">
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-400" aria-hidden />
                  Ungespeicherte Änderungen
                </span>
              ) : (
                isEdit && <span className="text-zinc-500">Alles gespeichert</span>
              )}
              {published && post && (
                <a
                  href={`/blog/${savedSlug}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-emerald-300 underline-offset-4 hover:underline"
                >
                  Beitrag ansehen
                  <ExternalLink className="h-3.5 w-3.5" aria-hidden />
                  <span className="sr-only">(öffnet in neuem Tab)</span>
                </a>
              )}
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
              {isEdit && (
                <Button
                  type="button"
                  variant="ghost"
                  className="text-rose-300 hover:bg-rose-500/10 hover:text-rose-200 sm:mr-auto"
                  disabled={disabled}
                  onClick={() => {
                    setDeleteError(null);
                    setConfirmOpen(true);
                  }}
                >
                  <Trash2 className="h-4 w-4" aria-hidden />
                  Löschen
                </Button>
              )}
              {published ? (
                <>
                  <Button type="button" variant="secondary" disabled={disabled} onClick={() => save(false, "unpublish")}>
                    <Undo2 className="h-4 w-4" aria-hidden />
                    {busy === "unpublish" ? "Wird zurückgezogen …" : "Veröffentlichung zurückziehen"}
                  </Button>
                  <Button type="submit" disabled={disabled}>
                    <Save className="h-4 w-4" aria-hidden />
                    {busy === "save" ? "Wird gespeichert …" : "Änderungen speichern"}
                  </Button>
                </>
              ) : (
                <>
                  <Button type="submit" variant="secondary" disabled={disabled}>
                    <Save className="h-4 w-4" aria-hidden />
                    {busy === "draft" ? "Wird gespeichert …" : "Als Entwurf speichern"}
                  </Button>
                  <Button type="button" disabled={disabled} onClick={() => save(true, "publish")}>
                    <Send className="h-4 w-4" aria-hidden />
                    {busy === "publish" ? "Wird veröffentlicht …" : "Speichern & veröffentlichen"}
                  </Button>
                </>
              )}
            </div>
          </div>
        </Card>
      </div>

      {post && (
        <ConfirmDialog
          open={confirmOpen}
          title="Beitrag löschen?"
          description={
            <>
              Der Beitrag <strong className="font-medium text-zinc-200">„{post.title}“</strong> wird endgültig gelöscht
              {published ? " und ist auf der Website nicht mehr erreichbar" : ""}. Das lässt sich nicht rückgängig machen.
            </>
          }
          busy={busy === "delete"}
          error={deleteError}
          onConfirm={remove}
          onCancel={() => setConfirmOpen(false)}
        />
      )}
    </form>
  );
}
