"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api-client";
import { useToast } from "@/components/admin/core/toast";
import { describeError } from "@/components/admin/settings/form-utils";
import { DecisionDialog } from "./decision-dialog";

export function WebspaceActions({ id, label }: { id: string; label: string }) {
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = useState<"approve" | "reject" | null>(null);
  const [dialog, setDialog] = useState<"approve" | "reject" | null>(null);

  async function run(action: "approve" | "reject", note: string) {
    if (busy) return;
    setBusy(action);
    try {
      await api(`/api/admin/webspace-requests/${encodeURIComponent(id)}`, {
        method: "PATCH",
        body: { action, ...(note ? { adminNote: note } : {}) },
      });
      toast.success(action === "approve" ? "Webspace-Konto freigegeben." : "Antrag abgelehnt.");
      setDialog(null);
      router.refresh();
    } catch (err) {
      toast.error(describeError(err, "Die Aktion ist fehlgeschlagen.").message);
    } finally {
      setBusy(null);
    }
  }

  const sr = <span className="sr-only"> ({label})</span>;

  return (
    <>
      <div className="flex flex-wrap gap-1.5">
        <Button type="button" variant="secondary" size="sm" disabled={busy !== null} onClick={() => setDialog("approve")}>
          <Check className="h-4 w-4" aria-hidden="true" />
          Freigeben{sr}
        </Button>
        <Button type="button" variant="danger" size="sm" disabled={busy !== null} onClick={() => setDialog("reject")}>
          <X className="h-4 w-4" aria-hidden="true" />
          Ablehnen{sr}
        </Button>
      </div>
      <DecisionDialog
        open={dialog === "approve"}
        title="Webspace-Konto freigeben?"
        description={`Der Antrag (${label}) gilt danach als freigegeben. Gib dem Nutzer im Hinweis mit, wie es weitergeht, zum Beispiel wann und wie er Zugangsdaten erhält.`}
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
        noteHint="Empfohlen: kurz begründen, damit der Nutzer weiss, wie es weitergeht."
        onSubmit={(note) => run("reject", note)}
        onCancel={() => setDialog(null)}
      />
    </>
  );
}
