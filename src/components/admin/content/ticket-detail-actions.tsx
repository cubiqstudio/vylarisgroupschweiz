"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, CircleDot, Hourglass, Mail, Save, Trash2, UserCheck, UserMinus, type LucideIcon } from "lucide-react";
import { api, ApiClientError } from "@/lib/api-client";
import { TICKET_STATUSES, TICKET_STATUS_LABEL, type TicketStatus } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Select, Textarea } from "@/components/ui/form";
import { useToast } from "@/components/admin/core/toast";
import { ConfirmDialog } from "./confirm-dialog";
import { Notice } from "./notice";

const STATUS_META: Record<TicketStatus, { icon: LucideIcon; active: string; iconActive: string; hint: string }> = {
  OPEN: {
    icon: CircleDot,
    active: "border-amber-500/50 bg-amber-500/10 text-amber-200",
    iconActive: "bg-amber-500 text-surface",
    hint: "Wartet auf Bearbeitung",
  },
  IN_PROGRESS: {
    icon: Hourglass,
    active: "border-indigo-500/50 bg-indigo-500/10 text-indigo-200",
    iconActive: "bg-indigo-500 text-surface",
    hint: "Wird gerade bearbeitet",
  },
  CLOSED: {
    icon: CheckCircle2,
    active: "border-green-600/40 bg-green-500/10 text-green-800",
    iconActive: "bg-green-600 text-surface",
    hint: "Erledigt",
  },
};

const ADMIN_API = "/api/admin/tickets";

export function TicketStatusControl({
  id,
  status,
  mailConfigured,
  apiBase = ADMIN_API,
}: {
  id: string;
  status: string;
  mailConfigured: boolean;
  apiBase?: string;
}) {
  const router = useRouter();
  const toast = useToast();
  const [current, setCurrent] = useState(status);
  const [busy, setBusy] = useState<TicketStatus | null>(null);
  const [notify, setNotify] = useState(false);

  useEffect(() => setCurrent(status), [status]);

  async function change(next: TicketStatus) {
    if (next === current || busy) return;
    setBusy(next);
    const withMail = notify && mailConfigured;
    try {
      await api(`${apiBase}/${id}`, { method: "PATCH", body: withMail ? { status: next, notify: true } : { status: next } });
      setCurrent(next);
      toast.success(
        withMail ? `Status auf „${TICKET_STATUS_LABEL[next]}“ gesetzt. Der Absender wird per E-Mail informiert.` : `Status auf „${TICKET_STATUS_LABEL[next]}“ gesetzt.`,
      );
      router.refresh();
    } catch (e) {
      toast.error(e instanceof ApiClientError ? e.message : "Status konnte nicht geändert werden.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div>
      <div role="group" aria-label="Ticket-Status" className="relative space-y-2">
        <span className="absolute bottom-6 left-[1.4rem] top-6 w-px bg-zinc-800" aria-hidden />
        {TICKET_STATUSES.map((s) => {
          const active = current === s;
          const meta = STATUS_META[s];
          const Icon = meta.icon;
          return (
            <button
              key={s}
              type="button"
              aria-pressed={active}
              disabled={busy !== null}
              onClick={() => change(s)}
              className={cn(
                "relative flex w-full items-center gap-3 rounded-xl border p-2.5 text-left transition-colors disabled:opacity-60",
                active ? meta.active : "border-zinc-800 bg-surface text-zinc-300 hover:bg-zinc-950",
              )}
            >
              <span
                className={cn(
                  "flex size-8 shrink-0 items-center justify-center rounded-full ring-4 ring-surface",
                  active ? meta.iconActive : "bg-zinc-900 text-zinc-500",
                )}
                aria-hidden
              >
                <Icon className="h-4 w-4" />
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-semibold">{busy === s ? "Wird gesetzt …" : TICKET_STATUS_LABEL[s]}</span>
                <span className="block text-xs opacity-70">{meta.hint}</span>
              </span>
            </button>
          );
        })}
      </div>

      <div className="mt-4 flex items-start gap-2.5">
        <input
          id="ticket-notify"
          type="checkbox"
          checked={notify && mailConfigured}
          disabled={!mailConfigured || busy !== null}
          onChange={(e) => setNotify(e.target.checked)}
          aria-describedby="ticket-notify-hint"
          className="mt-0.5 size-4 shrink-0 rounded border-zinc-700 accent-emerald-400 disabled:opacity-50"
        />
        <div className="min-w-0">
          <label htmlFor="ticket-notify" className={cn("flex items-center gap-1.5 text-sm font-medium", mailConfigured ? "text-zinc-200" : "text-zinc-500")}>
            <Mail className="h-3.5 w-3.5" aria-hidden />
            Absender per E-Mail informieren
          </label>
          <p id="ticket-notify-hint" className="mt-0.5 text-xs text-zinc-500">
            {mailConfigured
              ? "Gilt für die nächste Statusänderung. Der Absender erhält eine gestaltete Info-Mail."
              : "Nicht verfügbar, solange kein Mailserver eingerichtet ist."}
          </p>
        </div>
      </div>
    </div>
  );
}

const NOTE_MAX = 5000;

export function TicketNoteForm({ id, initialNote, apiBase = ADMIN_API }: { id: string; initialNote: string; apiBase?: string }) {
  const router = useRouter();
  const [note, setNote] = useState(initialNote);
  const [saved, setSaved] = useState(initialNote);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);
  const dirty = note !== saved;
  const dirtyRef = useRef(dirty);
  dirtyRef.current = dirty;

  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (!dirtyRef.current) return;
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, []);

  async function save() {
    setBusy(true);
    setError(null);
    setOk(false);
    try {
      await api(`${apiBase}/${id}`, { method: "PATCH", body: { internalNote: note } });
      setSaved(note);
      setOk(true);
      router.refresh();
    } catch (e) {
      setError(e instanceof ApiClientError ? (e.fields?.internalNote ?? e.message) : "Notiz konnte nicht gespeichert werden.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (dirty && !busy) save();
      }}
      className="space-y-3"
    >
      <label htmlFor="ticket-note" className="sr-only">
        Interne Notiz
      </label>
      <Textarea
        id="ticket-note"
        value={note}
        onChange={(e) => {
          setNote(e.target.value);
          setOk(false);
        }}
        rows={6}
        maxLength={NOTE_MAX}
        placeholder="Nur für das Team sichtbar, z. B. nächste Schritte oder Rückfragen."
        aria-describedby="ticket-note-count"
        className="resize-y"
      />
      <div className="flex items-center justify-between gap-3">
        <span id="ticket-note-count" className="text-xs tabular-nums text-zinc-500">
          {note.length} / {NOTE_MAX}
        </span>
        <Button type="submit" size="sm" variant="secondary" disabled={!dirty || busy}>
          <Save className="h-3.5 w-3.5" aria-hidden />
          {busy ? "Wird gespeichert …" : "Notiz speichern"}
        </Button>
      </div>
      {error && <Notice tone="error">{error}</Notice>}
      {ok && !dirty && <Notice tone="success">Notiz gespeichert.</Notice>}
    </form>
  );
}

export function TicketDeleteButton({ id, ticketNumber, backHref }: { id: string; ticketNumber: string; backHref: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function remove() {
    setBusy(true);
    setError(null);
    try {
      await api(`/api/admin/tickets/${id}`, { method: "DELETE" });
      router.replace(backHref);
      router.refresh();
    } catch (e) {
      setError(e instanceof ApiClientError ? e.message : "Ticket konnte nicht gelöscht werden.");
      setBusy(false);
    }
  }

  return (
    <>
      <Button
        type="button"
        variant="danger"
        className="w-full"
        onClick={() => {
          setError(null);
          setOpen(true);
        }}
      >
        <Trash2 className="h-4 w-4" aria-hidden />
        Ticket löschen
      </Button>
      <ConfirmDialog
        open={open}
        title="Ticket löschen?"
        description={
          <>
            Das Ticket <span className="font-mono text-zinc-200">{ticketNumber}</span> samt Nachricht, Verlauf und interner Notiz wird endgültig
            gelöscht. Das lässt sich nicht rückgängig machen.
          </>
        }
        busy={busy}
        error={error}
        onConfirm={remove}
        onCancel={() => setOpen(false)}
      />
    </>
  );
}

export type AssignMember = { id: string; name: string; teamTitle: string | null };

/**
 * Zuständigkeit ändern. Mit `members` (Admin): Auswahl unter allen Teammitgliedern plus „Niemand“.
 * Ohne `members` (Team-Bereich): „Mir zuweisen“ bzw. „Freigeben“ für das angemeldete Teammitglied `meId`.
 */
export function TicketAssignControl({
  id,
  assignedToId,
  members,
  meId,
  apiBase = ADMIN_API,
}: {
  id: string;
  assignedToId: string | null;
  members?: AssignMember[];
  meId?: string;
  apiBase?: string;
}) {
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [value, setValue] = useState(assignedToId ?? "");

  useEffect(() => setValue(assignedToId ?? ""), [assignedToId]);

  async function assign(next: string | null) {
    if (busy) return;
    setBusy(true);
    try {
      await api(`${apiBase}/${id}`, { method: "PATCH", body: { assignedToId: next } });
      setValue(next ?? "");
      toast.success(next ? "Zuständigkeit gespeichert." : "Ticket freigegeben.");
      router.refresh();
    } catch (e) {
      setValue(assignedToId ?? "");
      toast.error(e instanceof ApiClientError ? (e.fields?.assignedToId ?? e.message) : "Zuständigkeit konnte nicht geändert werden.");
    } finally {
      setBusy(false);
    }
  }

  if (members) {
    // Ein inzwischen entferntes oder gesperrtes Mitglied bleibt als Option sichtbar, bis die Zuständigkeit geändert wird.
    const known = !assignedToId || members.some((m) => m.id === assignedToId);
    return (
      <div className="space-y-1.5">
        <label htmlFor="ticket-assignee" className="sr-only">
          Zuständig
        </label>
        <Select id="ticket-assignee" value={value} disabled={busy} onChange={(e) => void assign(e.target.value || null)}>
          <option value="">Niemand</option>
          {!known && assignedToId && <option value={assignedToId}>Bisheriges Mitglied (nicht mehr verfügbar)</option>}
          {members.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
              {m.teamTitle ? ` – ${m.teamTitle}` : ""}
            </option>
          ))}
        </Select>
      </div>
    );
  }

  const mine = !!meId && assignedToId === meId;
  return mine ? (
    <Button type="button" variant="secondary" size="sm" className="w-full" disabled={busy} onClick={() => void assign(null)}>
      <UserMinus className="h-4 w-4" aria-hidden />
      {busy ? "Wird gespeichert …" : "Freigeben"}
    </Button>
  ) : (
    <Button type="button" variant="secondary" size="sm" className="w-full" disabled={busy || !meId} onClick={() => meId && void assign(meId)}>
      <UserCheck className="h-4 w-4" aria-hidden />
      {busy ? "Wird gespeichert …" : "Mir zuweisen"}
    </Button>
  );
}
