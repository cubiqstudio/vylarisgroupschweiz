"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Ban, Check, KeyRound, Link2Off, RotateCcw, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api-client";
import { ConfirmDialog } from "@/components/admin/core/confirm-dialog";
import { useToast } from "@/components/admin/core/toast";
import { describeError } from "@/components/admin/settings/form-utils";
import { DecisionDialog } from "./decision-dialog";

type Action = "approve" | "reject" | "revoke" | "reactivate" | "reset-binding";

const DONE: Record<Action, string> = {
  approve: "Schlüssel freigegeben.",
  reject: "Antrag abgelehnt.",
  revoke: "Schlüssel gesperrt.",
  reactivate: "Schlüssel wieder aktiviert.",
  "reset-binding": "Bindung gelöst. Der Schlüssel bindet sich bei der nächsten Prüfung neu.",
};

export function KeyActions({ id, status, bound, label }: { id: string; status: string; bound: boolean; label: string }) {
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = useState<Action | null>(null);
  const [dialog, setDialog] = useState<"approve" | "reject" | "revoke" | "reset-binding" | null>(null);

  async function run(action: Action, note?: string) {
    if (busy) return;
    setBusy(action);
    try {
      await api(`/api/admin/licenses/${encodeURIComponent(id)}`, {
        method: "PATCH",
        body: { action, ...(note ? { adminNote: note } : {}) },
      });
      toast.success(DONE[action]);
      setDialog(null);
      router.refresh();
    } catch (err) {
      toast.error(describeError(err, "Die Aktion ist fehlgeschlagen.").message);
    } finally {
      setBusy(null);
    }
  }

  const off = busy !== null;
  const sr = <span className="sr-only"> ({label})</span>;

  return (
    <>
      <div className="flex flex-wrap gap-1.5">
        {status === "PENDING" && (
          <>
            <Button type="button" variant="secondary" size="sm" disabled={off} onClick={() => setDialog("approve")}>
              <Check className="h-4 w-4" aria-hidden="true" />
              Freigeben{sr}
            </Button>
            <Button type="button" variant="danger" size="sm" disabled={off} onClick={() => setDialog("reject")}>
              <X className="h-4 w-4" aria-hidden="true" />
              Ablehnen{sr}
            </Button>
          </>
        )}
        {status === "ACTIVE" && (
          <Button type="button" variant="danger" size="sm" disabled={off} onClick={() => setDialog("revoke")}>
            <Ban className="h-4 w-4" aria-hidden="true" />
            Sperren{sr}
          </Button>
        )}
        {status === "REVOKED" && (
          <Button type="button" variant="secondary" size="sm" disabled={off} onClick={() => run("reactivate")}>
            <RotateCcw className="h-4 w-4" aria-hidden="true" />
            {busy === "reactivate" ? "Entsperre …" : "Entsperren"}
            {sr}
          </Button>
        )}
        {bound && (
          <Button type="button" variant="ghost" size="sm" disabled={off} onClick={() => setDialog("reset-binding")}>
            <Link2Off className="h-4 w-4" aria-hidden="true" />
            Bindung lösen{sr}
          </Button>
        )}
        {status === "REJECTED" && !bound && (
          <span className="inline-flex items-center gap-1.5 text-xs text-zinc-500">
            <KeyRound className="h-3.5 w-3.5" aria-hidden="true" />
            Keine Aktion möglich
          </span>
        )}
      </div>

      <DecisionDialog
        open={dialog === "approve"}
        title="Schlüssel freigeben?"
        description={`Der Schlüssel (${label}) wird aktiv und ist ab sofort per Prüf-API gültig. Der Nutzer sieht ihn in seinem Konto.`}
        confirmLabel="Freigeben"
        busy={busy === "approve"}
        onSubmit={(note) => run("approve", note)}
        onCancel={() => setDialog(null)}
      />
      <DecisionDialog
        open={dialog === "reject"}
        title="Antrag ablehnen?"
        description={`Der Antrag (${label}) wird abgelehnt. Der Nutzer sieht die Ablehnung samt Hinweis in seinem Konto.`}
        confirmLabel="Ablehnen"
        danger
        busy={busy === "reject"}
        noteHint="Empfohlen: kurz begründen, damit der Nutzer weiß, wie es weitergeht."
        onSubmit={(note) => run("reject", note)}
        onCancel={() => setDialog(null)}
      />
      <DecisionDialog
        open={dialog === "revoke"}
        title="Schlüssel sperren?"
        description={`Der Schlüssel (${label}) wird sofort ungültig; die Prüf-API meldet ihn als gesperrt. Du kannst ihn jederzeit wieder entsperren.`}
        confirmLabel="Sperren"
        danger
        busy={busy === "revoke"}
        onSubmit={(note) => run("revoke", note)}
        onCancel={() => setDialog(null)}
      />
      <ConfirmDialog
        open={dialog === "reset-binding"}
        title="Bindung lösen?"
        description={`Der Schlüssel (${label}) ist an eine Installation gebunden. Nach dem Lösen bindet er sich bei der nächsten erfolgreichen Prüfung an die dann anfragende Installation.`}
        confirmLabel="Bindung lösen"
        busy={busy === "reset-binding"}
        onConfirm={() => run("reset-binding")}
        onCancel={() => setDialog(null)}
      />
    </>
  );
}
