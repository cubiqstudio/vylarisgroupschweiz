"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { UserCheck, UserMinus, Trash2 } from "lucide-react";
import { api, ApiClientError } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/admin/core/confirm-dialog";
import { useToast } from "@/components/admin/core/toast";

type Action = "activate" | "unsubscribe" | "delete";

/** Aktionen je Abonnent: manuell aktivieren/abmelden und Löschung auf Wunsch der betroffenen Person (jeweils mit Bestätigung). */
export function SubscriberActions({ id, email, status }: { id: string; email: string; status: string }) {
  const router = useRouter();
  const toast = useToast();
  const [pending, setPending] = useState<Action | null>(null);
  const [busy, setBusy] = useState(false);

  async function run(action: Action) {
    setBusy(true);
    try {
      if (action === "delete") {
        await api(`/api/admin/newsletter/subscribers/${id}`, { method: "DELETE" });
        toast.success("Abonnent gelöscht.");
      } else {
        await api(`/api/admin/newsletter/subscribers/${id}`, { method: "PATCH", body: { status: action === "activate" ? "ACTIVE" : "UNSUBSCRIBED" } });
        toast.success(action === "activate" ? "Abonnent aktiviert." : "Abonnent abgemeldet.");
      }
      setPending(null);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : "Die Aktion konnte nicht ausgeführt werden.");
    } finally {
      setBusy(false);
    }
  }

  const copy: Record<Action, { title: string; description: string; label: string; danger: boolean }> = {
    activate: {
      title: "Abonnent aktivieren?",
      description: `${email} erhält künftig alle Kampagnen. Aktiviere nur, wenn die Person nachweislich eingewilligt hat.`,
      label: "Aktivieren",
      danger: false,
    },
    unsubscribe: {
      title: "Abonnent abmelden?",
      description: `${email} erhält keine Kampagnen mehr. Die Adresse bleibt als abgemeldet gespeichert.`,
      label: "Abmelden",
      danger: false,
    },
    delete: {
      title: "Abonnent endgültig löschen?",
      description: `${email} wird samt Zustellprotokoll unwiderruflich gelöscht (Löschung auf Wunsch der betroffenen Person).`,
      label: "Löschen",
      danger: true,
    },
  };

  return (
    <div className="flex flex-wrap items-center gap-1.5 sm:justify-end">
      {status !== "ACTIVE" && (
        <Button type="button" variant="secondary" size="sm" onClick={() => setPending("activate")}>
          <UserCheck className="size-3.5" aria-hidden />
          Aktivieren
        </Button>
      )}
      {status !== "UNSUBSCRIBED" && (
        <Button type="button" variant="secondary" size="sm" onClick={() => setPending("unsubscribe")}>
          <UserMinus className="size-3.5" aria-hidden />
          Abmelden
        </Button>
      )}
      <Button type="button" variant="danger" size="sm" onClick={() => setPending("delete")} aria-label={`${email} löschen`}>
        <Trash2 className="size-3.5" aria-hidden />
        Löschen
      </Button>
      <ConfirmDialog
        open={pending !== null}
        title={pending ? copy[pending].title : ""}
        description={pending ? copy[pending].description : ""}
        confirmLabel={pending ? copy[pending].label : "Bestätigen"}
        danger={pending ? copy[pending].danger : false}
        busy={busy}
        onConfirm={() => pending && run(pending)}
        onCancel={() => setPending(null)}
      />
    </div>
  );
}
