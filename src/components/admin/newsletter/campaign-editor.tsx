"use client";

import Link from "next/link";
import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  Bold,
  Eye,
  Heading2,
  HelpCircle,
  Italic,
  Link2,
  List,
  Loader2,
  Monitor,
  Pencil,
  Quote,
  RotateCw,
  Save,
  Send,
  Smartphone,
  Trash2,
} from "lucide-react";
import { api, ApiClientError } from "@/lib/api-client";
import { cn, formatDateTime } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/form";
import { ConfirmDialog } from "@/components/admin/core/confirm-dialog";
import { Notice } from "@/components/admin/core/notice";
import { useToast } from "@/components/admin/core/toast";
import { CampaignStatusPill, SendProgress } from "./status-pill";
import type { CampaignDetail, CampaignFailure } from "./types";

type Tab = "write" | "preview";
type Device = "desktop" | "mobile";
type Busy = "save" | "test" | "send" | "delete" | null;
type FieldErrors = Partial<Record<"subject" | "preheader" | "content", string>>;
type Texts = { subject: string; preheader: string; content: string };
type Progress = { recipientCount: number; sentCount: number; failedCount: number };

const SUBJECT_MAX = 150;
const PREHEADER_MAX = 200;
/** Ein SENDING-Stand ohne Lebenszeichen länger als das gilt als unterbrochen (Spiegel von STALE_AFTER_MS im Server). */
const STALL_MS = 2 * 60_000;
const POLL_MS = 2000;

const HELP: { label: string; code: string }[] = [
  { label: "Überschriften", code: "## Abschnitt\n### Unterabschnitt" },
  { label: "Hervorhebung", code: "**fett**, *kursiv*, ~~durchgestrichen~~, `Code`" },
  { label: "Listen", code: "- Punkt\n- Punkt\n\n1. Schritt\n2. Schritt" },
  { label: "Links", code: "[Linktext](https://example.org)" },
  { label: "Zitate", code: "> Zitierter Text" },
  { label: "Trennlinie", code: "---" },
];

const snapshot = (t: Texts) => JSON.stringify([t.subject, t.preheader, t.content]);

export function CampaignEditor({
  campaign,
  activeCount,
  mailConfigured,
  enabled,
  defaultTestEmail,
}: {
  campaign?: CampaignDetail;
  activeCount: number;
  mailConfigured: boolean;
  enabled: boolean;
  defaultTestEmail: string;
}) {
  const router = useRouter();
  const toast = useToast();
  const uid = useId();
  const contentRef = useRef<HTMLTextAreaElement>(null);

  const [id, setId] = useState<string | null>(campaign?.id ?? null);
  const [status, setStatus] = useState(campaign?.status ?? "DRAFT");
  const [subject, setSubject] = useState(campaign?.subject ?? "");
  const [preheader, setPreheader] = useState(campaign?.preheader ?? "");
  const [content, setContent] = useState(campaign?.content ?? "");
  const [baseline, setBaseline] = useState(() =>
    snapshot({
      subject: campaign?.subject ?? "",
      preheader: campaign?.preheader ?? "",
      content: campaign?.content ?? "",
    }),
  );
  const [progress, setProgress] = useState<Progress>({
    recipientCount: campaign?.recipientCount ?? 0,
    sentCount: campaign?.sentCount ?? 0,
    failedCount: campaign?.failedCount ?? 0,
  });
  const [failures, setFailures] = useState<CampaignFailure[]>(campaign?.failures ?? []);
  const [sentAt, setSentAt] = useState<string | null>(campaign?.sentAt ?? null);
  const [stalled, setStalled] = useState(false);

  const readOnly = status !== "DRAFT";
  const [tab, setTab] = useState<Tab>(readOnly ? "preview" : "write");
  const [device, setDevice] = useState<Device>("desktop");
  const [previewHtml, setPreviewHtml] = useState("");
  const [previewState, setPreviewState] = useState<"idle" | "loading" | "error">("idle");

  const [busy, setBusy] = useState<Busy>(null);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [testEmail, setTestEmail] = useState(defaultTestEmail);
  const [testError, setTestError] = useState<string | null>(null);
  const [confirmSend, setConfirmSend] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const texts: Texts = { subject, preheader, content };
  const dirty = !readOnly && snapshot(texts) !== baseline;
  const sendBlocker = !mailConfigured
    ? "Es ist kein Mailserver eingerichtet."
    : !enabled
      ? "Der Newsletter ist ausgeschaltet."
      : activeCount === 0
        ? "Es gibt noch keine aktiven Abonnenten."
        : null;

  // Warnung bei ungespeicherten Änderungen
  useEffect(() => {
    if (!dirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);

  // Vorschau (Server rendert die echte Mail; Anzeige im abgeschotteten iframe)
  useEffect(() => {
    if (tab !== "preview") return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setPreviewState("loading");
      try {
        const res = await api<{ html: string }>("/api/admin/newsletter/preview", {
          method: "POST",
          body: { subject, preheader, content },
          signal: controller.signal,
        });
        setPreviewHtml(res.html);
        setPreviewState("idle");
      } catch {
        if (controller.signal.aborted) return;
        setPreviewState("error");
      }
    }, 350);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [tab, subject, preheader, content]);

  // Fortschritt während des Versands
  useEffect(() => {
    if (status !== "SENDING" || !id) return;
    let stop = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const tick = async () => {
      try {
        const c = await api<CampaignDetail>(`/api/admin/newsletter/campaigns/${id}`);
        if (stop) return;
        setProgress({ recipientCount: c.recipientCount, sentCount: c.sentCount, failedCount: c.failedCount });
        setFailures(c.failures);
        setSentAt(c.sentAt);
        if (c.status !== "SENDING") {
          setStatus(c.status);
          setStalled(false);
          if (c.status === "SENT") toast.success("Die Kampagne wurde versendet.");
          else toast.error("Der Versand ist fehlgeschlagen oder wurde abgebrochen.");
          router.refresh();
          return;
        }
        setStalled(Date.now() - Date.parse(c.updatedAt) > STALL_MS);
      } catch {
        /* kurzer Ausfall: im nächsten Takt erneut versuchen */
      }
      if (!stop) timer = setTimeout(tick, POLL_MS);
    };
    timer = setTimeout(tick, 0);
    return () => {
      stop = true;
      if (timer) clearTimeout(timer);
    };
  }, [status, id, router, toast]);

  const applyError = useCallback((err: unknown, fallback: string) => {
    if (err instanceof ApiClientError) {
      const f = err.fields ?? {};
      setErrors({
        subject: f.subject,
        preheader: f.preheader,
        content: f.content,
      });
      setFormError(Object.keys(f).length > 0 ? "Bitte prüfe die markierten Felder." : err.message);
    } else {
      setFormError(fallback);
    }
  }, []);

  /** Speichert den Entwurf (legt ihn bei Bedarf an). Liefert die Kampagnen-ID oder null bei Fehler. */
  async function persist(): Promise<string | null> {
    setErrors({});
    setFormError(null);
    try {
      const body = { subject, preheader, content };
      if (!id) {
        const created = await api<{ id: string }>("/api/admin/newsletter/campaigns", { method: "POST", body });
        setId(created.id);
        setBaseline(snapshot(texts));
        window.history.replaceState(window.history.state, "", `/admin/newsletter/campaigns/${created.id}`);
        return created.id;
      }
      if (dirty) {
        await api(`/api/admin/newsletter/campaigns/${id}`, { method: "PATCH", body });
        setBaseline(snapshot(texts));
      }
      return id;
    } catch (err) {
      applyError(err, "Der Entwurf konnte nicht gespeichert werden.");
      return null;
    }
  }

  async function saveDraft() {
    if (busy) return;
    setBusy("save");
    const saved = await persist();
    setBusy(null);
    if (saved) toast.success("Entwurf gespeichert.");
  }

  async function sendTest() {
    if (busy) return;
    setTestError(null);
    if (!/^\S+@\S+\.\S+$/.test(testEmail.trim())) {
      setTestError("Bitte eine gültige E-Mail-Adresse angeben.");
      return;
    }
    setBusy("test");
    try {
      const saved = readOnly ? id : await persist();
      if (!saved) return;
      await api(`/api/admin/newsletter/campaigns/${saved}/test`, { method: "POST", body: { to: testEmail.trim() } });
      toast.success(`Testmail an ${testEmail.trim()} gesendet.`);
    } catch (err) {
      setTestError(err instanceof ApiClientError ? (err.fields?.to ?? err.message) : "Die Testmail konnte nicht gesendet werden.");
    } finally {
      setBusy(null);
    }
  }

  async function startSend() {
    if (busy) return;
    setBusy("send");
    try {
      const saved = readOnly ? id : await persist();
      if (!saved) {
        setConfirmSend(false);
        return;
      }
      const res = await api<Progress & { status: string }>(`/api/admin/newsletter/campaigns/${saved}/send`, { method: "POST" });
      setProgress({ recipientCount: res.recipientCount, sentCount: res.sentCount, failedCount: res.failedCount });
      setStatus("SENDING");
      setStalled(false);
      setConfirmSend(false);
      toast.success(`Versand an ${res.recipientCount} Abonnenten gestartet.`);
    } catch (err) {
      setConfirmSend(false);
      const message = err instanceof ApiClientError ? err.message : "Der Versand konnte nicht gestartet werden.";
      setFormError(message);
      toast.error(message);
    } finally {
      setBusy(null);
    }
  }

  async function deleteDraft() {
    if (!id || busy) return;
    setBusy("delete");
    try {
      await api(`/api/admin/newsletter/campaigns/${id}`, { method: "DELETE" });
      toast.success("Entwurf gelöscht.");
      router.push("/admin/newsletter");
      router.refresh();
    } catch (err) {
      setConfirmDelete(false);
      toast.error(err instanceof ApiClientError ? err.message : "Der Entwurf konnte nicht gelöscht werden.");
      setBusy(null);
    }
  }

  /** Umschliesst die Auswahl im Textfeld mit Markdown-Zeichen bzw. setzt ein Präfix am Zeilenanfang. */
  function format(kind: "bold" | "italic" | "link" | "list" | "heading" | "quote") {
    const el = contentRef.current;
    if (!el || readOnly) return;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const selected = content.slice(start, end);
    let insert: string;
    let selStart: number;
    let selEnd: number;
    if (kind === "bold" || kind === "italic") {
      const mark = kind === "bold" ? "**" : "*";
      const text = selected || (kind === "bold" ? "fetter Text" : "kursiver Text");
      insert = `${mark}${text}${mark}`;
      selStart = start + mark.length;
      selEnd = selStart + text.length;
    } else if (kind === "link") {
      const text = selected || "Linktext";
      insert = `[${text}](https://)`;
      selStart = start + text.length + 3;
      selEnd = selStart + "https://".length;
    } else {
      const prefix = kind === "list" ? "- " : kind === "heading" ? "## " : "> ";
      const lineStart = content.lastIndexOf("\n", start - 1) + 1;
      const block = content.slice(lineStart, end) || (kind === "heading" ? "Überschrift" : kind === "list" ? "Punkt" : "Zitat");
      const lines = block.split("\n").map((l) => prefix + l).join("\n");
      setContent(content.slice(0, lineStart) + lines + content.slice(end));
      requestAnimationFrame(() => {
        el.focus();
        el.setSelectionRange(lineStart + lines.length, lineStart + lines.length);
      });
      return;
    }
    setContent(content.slice(0, start) + insert + content.slice(end));
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(selStart, selEnd);
    });
  }

  const sendLabel = `Jetzt an ${activeCount.toLocaleString("de-CH")} Abonnenten senden`;
  const total = progress.recipientCount;
  const done = progress.sentCount + progress.failedCount;

  const toolbar = useMemo(
    () =>
      [
        { kind: "heading", label: "Überschrift", Icon: Heading2 },
        { kind: "bold", label: "Fett", Icon: Bold },
        { kind: "italic", label: "Kursiv", Icon: Italic },
        { kind: "link", label: "Link einfügen", Icon: Link2 },
        { kind: "list", label: "Aufzählung", Icon: List },
        { kind: "quote", label: "Zitat", Icon: Quote },
      ] as const,
    [],
  );

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_21rem] lg:items-start">
      <div className="min-w-0 space-y-4">
        {formError && <Notice variant="error">{formError}</Notice>}

        <Card className="p-4 sm:p-5">
          <div className="grid gap-4">
            <Field label="Betreff" htmlFor={`${uid}-subject`} error={errors.subject} hint={`${subject.length}/${SUBJECT_MAX} Zeichen`}>
              <Input
                id={`${uid}-subject`}
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                maxLength={SUBJECT_MAX}
                readOnly={readOnly}
                aria-invalid={Boolean(errors.subject)}
                placeholder="z. B. Neues bei der VylarisGroup"
                autoComplete="off"
              />
            </Field>
            <Field
              label="Vorschautext (Preheader)"
              htmlFor={`${uid}-preheader`}
              error={errors.preheader}
              hint={`Erscheint im Posteingang neben dem Betreff. ${preheader.length}/${PREHEADER_MAX} Zeichen`}
            >
              <Input
                id={`${uid}-preheader`}
                value={preheader}
                onChange={(e) => setPreheader(e.target.value)}
                maxLength={PREHEADER_MAX}
                readOnly={readOnly}
                aria-invalid={Boolean(errors.preheader)}
                autoComplete="off"
              />
            </Field>
          </div>
        </Card>

        <Card className="overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-800 bg-zinc-950 px-3 py-2">
            <div role="tablist" aria-label="Ansicht" className="inline-flex rounded-lg bg-zinc-900 p-0.5 ring-1 ring-inset ring-zinc-800">
              {(
                [
                  ["write", readOnly ? "Inhalt" : "Schreiben", Pencil],
                  ["preview", "Vorschau", Eye],
                ] as const
              ).map(([key, label, Icon]) => (
                <button
                  key={key}
                  type="button"
                  role="tab"
                  id={`${uid}-tab-${key}`}
                  aria-selected={tab === key}
                  aria-controls={`${uid}-panel-${key}`}
                  onClick={() => setTab(key)}
                  className={cn(
                    "inline-flex h-8 items-center gap-1.5 rounded-md px-3 text-sm font-medium transition-colors",
                    tab === key ? "bg-surface text-white shadow-sm" : "text-zinc-500 hover:text-zinc-200",
                  )}
                >
                  <Icon className="size-3.5" aria-hidden />
                  {label}
                </button>
              ))}
            </div>

            {tab === "write" && !readOnly && (
              <div className="flex flex-wrap items-center gap-0.5" role="toolbar" aria-label="Formatierung">
                {toolbar.map(({ kind, label, Icon }) => (
                  <button
                    key={kind}
                    type="button"
                    onClick={() => format(kind)}
                    title={label}
                    aria-label={label}
                    className="rounded-md p-2 text-zinc-500 transition-colors hover:bg-zinc-900 hover:text-white"
                  >
                    <Icon className="size-4" aria-hidden />
                  </button>
                ))}
              </div>
            )}

            {tab === "preview" && (
              <div className="flex items-center gap-1" role="group" aria-label="Vorschau-Breite">
                {(
                  [
                    ["desktop", "Desktop", Monitor],
                    ["mobile", "Mobil", Smartphone],
                  ] as const
                ).map(([key, label, Icon]) => (
                  <button
                    key={key}
                    type="button"
                    aria-pressed={device === key}
                    onClick={() => setDevice(key)}
                    className={cn(
                      "inline-flex h-8 items-center gap-1.5 rounded-md px-2.5 text-sm font-medium transition-colors",
                      device === key ? "bg-ink text-surface" : "text-zinc-500 hover:bg-zinc-900 hover:text-white",
                    )}
                  >
                    <Icon className="size-3.5" aria-hidden />
                    {label}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div
            role="tabpanel"
            id={`${uid}-panel-write`}
            aria-labelledby={`${uid}-tab-write`}
            hidden={tab !== "write"}
            className="p-3 sm:p-4"
          >
            <label htmlFor={`${uid}-content`} className="sr-only">
              Inhalt (Markdown)
            </label>
            <textarea
              ref={contentRef}
              id={`${uid}-content`}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              readOnly={readOnly}
              rows={18}
              spellCheck
              aria-invalid={Boolean(errors.content)}
              aria-describedby={errors.content ? `${uid}-content-error` : undefined}
              placeholder={"Hallo zusammen,\n\nhier schreibst du den Inhalt deines Newsletters in Markdown …"}
              className="min-h-72 w-full rounded-lg border border-zinc-600 bg-surface px-3 py-2.5 font-mono text-[13px] leading-relaxed text-zinc-100 placeholder:text-zinc-500 hover:border-zinc-500 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-400/25 read-only:bg-zinc-900"
            />
            {errors.content && (
              <p id={`${uid}-content-error`} role="alert" className="mt-1.5 text-xs text-rose-400">
                {errors.content}
              </p>
            )}
            {!readOnly && (
              <details className="group mt-3 rounded-lg border border-zinc-800 bg-zinc-950 text-sm">
                <summary className="flex cursor-pointer list-none items-center gap-2 px-3 py-2 font-medium text-zinc-300 [&::-webkit-details-marker]:hidden">
                  <HelpCircle className="size-4 text-zinc-500" aria-hidden />
                  Markdown-Kurzhilfe
                </summary>
                <dl className="grid gap-x-6 gap-y-3 border-t border-zinc-800 px-3 py-3 sm:grid-cols-2">
                  {HELP.map((h) => (
                    <div key={h.label}>
                      <dt className="text-xs font-medium text-zinc-500">{h.label}</dt>
                      <dd>
                        <pre className="mt-1 overflow-x-auto whitespace-pre-wrap rounded-md bg-surface px-2 py-1.5 font-mono text-xs text-zinc-300 ring-1 ring-inset ring-zinc-800">{h.code}</pre>
                      </dd>
                    </div>
                  ))}
                  <p className="text-xs text-zinc-500 sm:col-span-2">
                    Rohes HTML und Bilder werden nicht übernommen. Der Name der Empfängerin bzw. des Empfängers steht automatisch in der Anrede, der Abmelde-Link in der Fusszeile.
                  </p>
                </dl>
              </details>
            )}
          </div>

          <div
            role="tabpanel"
            id={`${uid}-panel-preview`}
            aria-labelledby={`${uid}-tab-preview`}
            hidden={tab !== "preview"}
            className="bg-zinc-900 p-3 sm:p-4"
          >
            <div className="mb-2 flex items-center justify-between gap-2 text-xs text-zinc-500" aria-live="polite">
              <span>Vorschau mit Beispiel-Empfänger. Links sind in der Vorschau deaktiviert.</span>
              {previewState === "loading" && (
                <span className="inline-flex items-center gap-1.5">
                  <Loader2 className="size-3.5 motion-safe:animate-spin" aria-hidden />
                  Aktualisiere …
                </span>
              )}
            </div>
            {previewState === "error" && <Notice variant="error" className="mb-2">Die Vorschau konnte nicht geladen werden.</Notice>}
            <div
              className={cn(
                "mx-auto w-full overflow-hidden rounded-xl bg-surface shadow-sm ring-1 ring-zinc-800 transition-[max-width] duration-300 motion-reduce:transition-none",
                device === "mobile" ? "max-w-[375px]" : "max-w-[680px]",
              )}
            >
              {previewHtml ? (
                <iframe title="Vorschau der Newsletter-Mail" sandbox="" srcDoc={previewHtml} className="block h-[70vh] min-h-[480px] w-full border-0 bg-surface" />
              ) : (
                <div className="grid h-72 place-items-center text-sm text-zinc-500">{previewState === "loading" ? "Vorschau wird erstellt …" : "Noch keine Vorschau."}</div>
              )}
            </div>
          </div>
        </Card>

        {failures.length > 0 && (
          <Card className="p-4 sm:p-5">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-white">
              <AlertTriangle className="size-4 text-rose-400" aria-hidden />
              Fehlgeschlagene Zustellungen
            </h2>
            <ul className="mt-3 divide-y divide-zinc-800 text-sm">
              {failures.map((f) => (
                <li key={f.id} className="flex flex-col gap-0.5 py-2 sm:flex-row sm:justify-between sm:gap-4">
                  <span className="break-all font-medium text-zinc-300">{f.email}</span>
                  <span className="break-words text-zinc-500">{f.error || "Unbekannter Fehler"}</span>
                </li>
              ))}
            </ul>
            {progress.failedCount > failures.length && (
              <p className="mt-2 text-xs text-zinc-500">Es werden die ersten {failures.length} von {progress.failedCount} angezeigt.</p>
            )}
          </Card>
        )}
      </div>

      <aside className="space-y-4 lg:sticky lg:top-4" aria-label="Versand">
        <Card className="p-4 sm:p-5">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-sm font-semibold text-white">Versand</h2>
            <CampaignStatusPill status={status} />
          </div>

          {status === "DRAFT" && (
            <div className="mt-4 space-y-3">
              <p className="text-sm text-zinc-400">
                Empfänger: <strong className="font-semibold text-white">{activeCount.toLocaleString("de-CH")}</strong> aktive Abonnenten
              </p>
              {sendBlocker && (
                <Notice variant="warning">
                  {sendBlocker}{" "}
                  {!mailConfigured || !enabled ? (
                    <Link href="/admin/newsletter" className="font-medium underline underline-offset-2">
                      Zur Übersicht
                    </Link>
                  ) : null}
                </Notice>
              )}
              {dirty && <p className="text-xs text-amber-300">Ungespeicherte Änderungen</p>}
              <Button type="button" onClick={() => setConfirmSend(true)} disabled={Boolean(busy) || Boolean(sendBlocker)} className="w-full">
                <Send className="size-4" aria-hidden />
                {sendLabel}
              </Button>
              <Button type="button" variant="secondary" onClick={saveDraft} disabled={Boolean(busy)} className="w-full">
                {busy === "save" ? <Loader2 className="size-4 motion-safe:animate-spin" aria-hidden /> : <Save className="size-4" aria-hidden />}
                Als Entwurf speichern
              </Button>
              {id && (
                <Button type="button" variant="danger" size="sm" onClick={() => setConfirmDelete(true)} disabled={Boolean(busy)} className="w-full">
                  <Trash2 className="size-3.5" aria-hidden />
                  Entwurf löschen
                </Button>
              )}
            </div>
          )}

          {status !== "DRAFT" && (
            <div className="mt-4 space-y-3">
              <SendProgress sent={progress.sentCount} failed={progress.failedCount} total={total} />
              <dl className="grid grid-cols-3 gap-2 text-center">
                {[
                  ["Empfänger", total, "text-white"],
                  ["Zugestellt", progress.sentCount, "text-green-700"],
                  ["Fehler", progress.failedCount, progress.failedCount > 0 ? "text-rose-400" : "text-zinc-500"],
                ].map(([label, value, tone]) => (
                  <div key={label as string} className="rounded-xl bg-zinc-950 px-2 py-2.5 ring-1 ring-inset ring-zinc-800">
                    <dt className="text-xs text-zinc-500">{label}</dt>
                    <dd className={cn("mt-0.5 text-lg font-semibold tabular-nums", tone as string)}>{(value as number).toLocaleString("de-CH")}</dd>
                  </div>
                ))}
              </dl>
              <p className="text-xs text-zinc-500" aria-live="polite">
                {status === "SENDING"
                  ? stalled
                    ? "Der Versand scheint unterbrochen zu sein."
                    : `${done.toLocaleString("de-CH")} von ${total.toLocaleString("de-CH")} verarbeitet …`
                  : status === "SENT"
                    ? `Versendet am ${formatDateTime(sentAt)}.`
                    : "Der Versand wurde nicht vollständig abgeschlossen."}
              </p>
              {(status === "FAILED" || (status === "SENDING" && stalled)) && (
                <>
                  {(!mailConfigured || !enabled) && sendBlocker && <Notice variant="warning">{sendBlocker}</Notice>}
                  <Button type="button" onClick={() => setConfirmSend(true)} disabled={Boolean(busy) || !mailConfigured || !enabled} className="w-full">
                    <RotateCw className="size-4" aria-hidden />
                    {status === "FAILED" ? "Versand erneut versuchen" : "Versand fortsetzen"}
                  </Button>
                </>
              )}
            </div>
          )}
        </Card>

        <Card className="p-4 sm:p-5">
          <h2 className="text-sm font-semibold text-white">Testmail</h2>
          <p className="mt-1 text-sm text-zinc-400">Schickt die Mail mit Beispiel-Empfänger an eine Adresse deiner Wahl. Es wird nichts protokolliert.</p>
          <div className="mt-3 space-y-3">
            <Field label="Test-Adresse" htmlFor={`${uid}-test`} error={testError ?? undefined}>
              <Input
                id={`${uid}-test`}
                type="email"
                value={testEmail}
                onChange={(e) => setTestEmail(e.target.value)}
                autoComplete="email"
                placeholder="name@example.org"
                maxLength={200}
              />
            </Field>
            <Button type="button" variant="secondary" onClick={sendTest} disabled={Boolean(busy) || !mailConfigured || (!readOnly && !subject.trim())} className="w-full">
              {busy === "test" ? <Loader2 className="size-4 motion-safe:animate-spin" aria-hidden /> : <Send className="size-4" aria-hidden />}
              Testmail senden
            </Button>
            {!mailConfigured && <p className="text-xs text-amber-300">Dafür muss ein Mailserver eingerichtet sein.</p>}
          </div>
        </Card>
      </aside>

      <ConfirmDialog
        open={confirmSend}
        title={status === "DRAFT" ? "Kampagne jetzt senden?" : "Versand fortsetzen?"}
        description={
          status === "DRAFT"
            ? `«${subject.trim() || "Ohne Betreff"}» wird an ${activeCount.toLocaleString("de-CH")} aktive Abonnenten gesendet. Das kann nicht rückgängig gemacht werden.`
            : "Offene und fehlgeschlagene Zustellungen werden erneut versucht. Wer die Mail schon erhalten hat, bekommt sie nicht noch einmal."
        }
        confirmLabel={status === "DRAFT" ? "Jetzt senden" : "Fortsetzen"}
        busy={busy === "send"}
        onConfirm={startSend}
        onCancel={() => setConfirmSend(false)}
      />
      <ConfirmDialog
        open={confirmDelete}
        title="Entwurf löschen?"
        description="Der Entwurf wird unwiderruflich gelöscht."
        confirmLabel="Löschen"
        danger
        busy={busy === "delete"}
        onConfirm={deleteDraft}
        onCancel={() => setConfirmDelete(false)}
      />
    </div>
  );
}
