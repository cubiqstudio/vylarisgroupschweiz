"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Ban, Building2, CheckCheck, Mail, RotateCcw, Trash2, UserMinus, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api-client";
import { ConfirmDialog } from "@/components/admin/core/confirm-dialog";
import { useToast } from "@/components/admin/core/toast";
import { describeError } from "./form-utils";

type Action = "business-approve" | "business-reject" | "business-reset" | "disable" | "enable" | "verify" | "resend" | "delete" | "team-on" | "team-off" | "title";

export function UserActions({
  user,
}: {
  user: {
    id: string;
    name: string;
    email: string;
    verified: boolean;
    disabled: boolean;
    isTeam: boolean;
    teamTitle: string;
    businessStatus: string;
    companyName: string;
  };
}) {
  const [title, setTitle] = useState(user.teamTitle);
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = useState<Action | null>(null);
  const [confirm, setConfirm] = useState<"delete" | "disable" | "business-reject" | "business-reset" | null>(null);

  const base = `/api/admin/users/${encodeURIComponent(user.id)}`;

  async function run(action: Action) {
    if (busy) return;
    setBusy(action);
    try {
      switch (action) {
        case "disable":
        case "enable":
          await api(base, { method: "PATCH", body: { disabled: action === "disable" } });
          toast.success(action === "disable" ? `${user.email} wurde gesperrt.` : `${user.email} wurde entsperrt.`);
          break;
        case "business-approve":
        case "business-reject":
        case "business-reset": {
          const decision = action.slice("business-".length);
          await api(base, { method: "PATCH", body: { business: decision } });
          toast.success(
            decision === "approve"
              ? `${user.name} ist jetzt als Firmenkunde freigegeben.`
              : decision === "reject"
                ? `Der Firmenkunden-Antrag von ${user.name} wurde abgelehnt.`
                : `Der Firmenkunden-Status von ${user.name} wurde zurückgesetzt.`,
          );
          break;
        }
        case "team-on":
          await api(base, { method: "PATCH", body: { team: true, teamTitle: title } });
          toast.success(`${user.name} ist jetzt im Team.`);
          break;
        case "team-off":
          await api(base, { method: "PATCH", body: { team: false } });
          toast.success(`${user.name} wurde aus dem Team entfernt.`);
          break;
        case "title":
          await api(base, { method: "PATCH", body: { teamTitle: title } });
          toast.success("Rolle im Team gespeichert.");
          break;
        case "verify":
          await api(base, { method: "PATCH", body: { verified: true } });
          toast.success(`E-Mail-Adresse von ${user.email} als bestätigt markiert.`);
          break;
        case "resend":
          await api(`${base}/resend-verification`, { method: "POST" });
          toast.success(`Bestätigungsmail an ${user.email} gesendet.`);
          break;
        case "delete":
          await api(base, { method: "DELETE" });
          toast.success(`Konto ${user.email} gelöscht.`);
          break;
      }
      setConfirm(null);
      router.refresh();
    } catch (err) {
      toast.error(describeError(err, "Die Aktion ist fehlgeschlagen.").message);
      setConfirm(null);
    } finally {
      setBusy(null);
    }
  }

  const disabledAll = busy !== null;

  return (
    <>
      <div className="flex flex-wrap gap-1.5">
        {!user.verified && (
          <>
            <Button type="button" variant="secondary" size="sm" disabled={disabledAll} onClick={() => run("verify")}>
              <CheckCheck className="h-4 w-4" aria-hidden="true" />
              Als bestätigt markieren
              <span className="sr-only"> ({user.email})</span>
            </Button>
            <Button type="button" variant="secondary" size="sm" disabled={disabledAll} onClick={() => run("resend")}>
              <Mail className="h-4 w-4" aria-hidden="true" />
              {busy === "resend" ? "Sende …" : "Bestätigungsmail erneut senden"}
              <span className="sr-only"> ({user.email})</span>
            </Button>
          </>
        )}
        {user.disabled ? (
          <Button type="button" variant="secondary" size="sm" disabled={disabledAll} onClick={() => run("enable")}>
            <RotateCcw className="h-4 w-4" aria-hidden="true" />
            Entsperren
            <span className="sr-only"> ({user.email})</span>
          </Button>
        ) : (
          <Button type="button" variant="secondary" size="sm" disabled={disabledAll} onClick={() => setConfirm("disable")}>
            <Ban className="h-4 w-4" aria-hidden="true" />
            Sperren
            <span className="sr-only"> ({user.email})</span>
          </Button>
        )}
        {user.businessStatus === "PENDING" && (
          <>
            <Button type="button" variant="secondary" size="sm" disabled={disabledAll} onClick={() => run("business-approve")}>
              <Building2 className="h-4 w-4" aria-hidden="true" />
              {busy === "business-approve" ? "Gebe frei …" : "Firmenkunde freigeben"}
              <span className="sr-only"> ({user.email})</span>
            </Button>
            <Button type="button" variant="secondary" size="sm" disabled={disabledAll} onClick={() => setConfirm("business-reject")}>
              <Ban className="h-4 w-4" aria-hidden="true" />
              Firmenkunden-Antrag ablehnen
              <span className="sr-only"> ({user.email})</span>
            </Button>
          </>
        )}
        {(user.businessStatus === "APPROVED" || user.businessStatus === "REJECTED") && (
          <Button type="button" variant="secondary" size="sm" disabled={disabledAll} onClick={() => setConfirm("business-reset")}>
            <RotateCcw className="h-4 w-4" aria-hidden="true" />
            Firmenkunden-Status zurücksetzen
            <span className="sr-only"> ({user.email})</span>
          </Button>
        )}
        {user.businessStatus === "REJECTED" && (
          <Button type="button" variant="secondary" size="sm" disabled={disabledAll} onClick={() => run("business-approve")}>
            <Building2 className="h-4 w-4" aria-hidden="true" />
            Doch freigeben
            <span className="sr-only"> ({user.email})</span>
          </Button>
        )}
        {user.isTeam ? (
          <Button type="button" variant="secondary" size="sm" disabled={disabledAll} onClick={() => run("team-off")}>
            <UserMinus className="h-4 w-4" aria-hidden="true" />
            Aus Team entfernen
            <span className="sr-only"> ({user.email})</span>
          </Button>
        ) : (
          <Button type="button" variant="secondary" size="sm" disabled={disabledAll} onClick={() => run("team-on")}>
            <UserPlus className="h-4 w-4" aria-hidden="true" />
            Ins Team aufnehmen
            <span className="sr-only"> ({user.email})</span>
          </Button>
        )}
        <Button type="button" variant="danger" size="sm" disabled={disabledAll} onClick={() => setConfirm("delete")}>
          <Trash2 className="h-4 w-4" aria-hidden="true" />
          Löschen
          <span className="sr-only"> ({user.email})</span>
        </Button>
      </div>

      <div className="mt-3 flex max-w-md items-center gap-2">
        <label htmlFor={`team-title-${user.id}`} className="sr-only">
          Rolle im Team für {user.name}
        </label>
        <input
          id={`team-title-${user.id}`}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={80}
          placeholder="Rolle im Team, z. B. Support"
          className="h-9 min-w-0 flex-1 rounded-lg border border-zinc-700 bg-surface px-3 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-emerald-400 focus:outline-none"
        />
        {user.isTeam && (
          <Button type="button" variant="secondary" size="sm" disabled={disabledAll || title === user.teamTitle} onClick={() => run("title")}>
            Speichern
          </Button>
        )}
      </div>

      <ConfirmDialog
        open={confirm === "delete"}
        title="Konto löschen?"
        description={`Das Konto von ${user.name} (${user.email}) wird dauerhaft gelöscht, inklusive offener Bestätigungs- und Reset-Links. Das kann nicht rückgängig gemacht werden.`}
        confirmLabel="Endgültig löschen"
        danger
        busy={busy === "delete"}
        onConfirm={() => run("delete")}
        onCancel={() => setConfirm(null)}
      />
      <ConfirmDialog
        open={confirm === "disable"}
        title="Konto sperren?"
        description={`${user.name} (${user.email}) kann sich danach nicht mehr anmelden. Du kannst das Konto jederzeit wieder entsperren.`}
        confirmLabel="Sperren"
        danger
        busy={busy === "disable"}
        onConfirm={() => run("disable")}
        onCancel={() => setConfirm(null)}
      />
      <ConfirmDialog
        open={confirm === "business-reject"}
        title="Firmenkunden-Antrag ablehnen?"
        description={`Der Antrag von ${user.name}${user.companyName ? ` (${user.companyName})` : ""} wird abgelehnt. Bereits ausgestellte Schlüssel bleiben bestehen; neue Firmenkunden-Schlüssel sind dann nicht möglich.`}
        confirmLabel="Ablehnen"
        danger
        busy={busy === "business-reject"}
        onConfirm={() => run("business-reject")}
        onCancel={() => setConfirm(null)}
      />
      <ConfirmDialog
        open={confirm === "business-reset"}
        title="Firmenkunden-Status zurücksetzen?"
        description={`Der Status von ${user.name} wird auf „kein Firmenkunde“ gesetzt und der Firmenname gelöscht. Bereits ausgestellte Schlüssel bleiben bestehen. Der Nutzer kann erneut einen Antrag stellen.`}
        confirmLabel="Zurücksetzen"
        danger
        busy={busy === "business-reset"}
        onConfirm={() => run("business-reset")}
        onCancel={() => setConfirm(null)}
      />
    </>
  );
}
