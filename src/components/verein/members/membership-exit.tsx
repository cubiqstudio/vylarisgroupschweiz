"use client";

import { useRouter } from "next/navigation";
import { useId, useState } from "react";
import { DoorOpen } from "lucide-react";
import { api, ApiClientError } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/form";
import { ConfirmDialog } from "@/components/admin/core/confirm-dialog";
import { FieldBox, FormAlert, FormSuccess } from "@/components/account/form-parts";
import { useMessages } from "@/i18n/client";
import { vereinMitglieder } from "@/i18n/verein-mitglieder";

/** Austritt erklären (Portal). `earliest` ist der Termin, der bei einer Erklärung heute gilt, bereits als «5.11.2026» formatiert. */
export function MembershipExit({ earliest }: { earliest: string }) {
  const m = useMessages(vereinMitglieder).membership.exit;
  const router = useRouter();
  const uid = useId();
  const [reason, setReason] = useState("");
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  async function confirm() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await api<{ effective: string }>("/api/account/verein/membership/exit", { method: "POST", body: { reason, confirm: true } });
      setDone(new Intl.DateTimeFormat("de-CH", { day: "numeric", month: "numeric", year: "numeric", timeZone: "Europe/Zurich" }).format(new Date(res.effective)));
      setOpen(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : m.failed);
      setOpen(false);
    } finally {
      setBusy(false);
    }
  }

  if (done) return <FormSuccess>{m.done(done)}</FormSuccess>;

  return (
    <div className="space-y-4">
      <p className="text-sm leading-relaxed text-zinc-400">{m.explain}</p>
      <p className="text-sm leading-relaxed text-zinc-300">{m.earliest(earliest)}</p>
      {error && (
        <FormAlert>
          <p>{error}</p>
        </FormAlert>
      )}
      <FieldBox id={`${uid}-reason`} label={m.reasonLabel}>
        <Textarea id={`${uid}-reason`} rows={2} maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)} disabled={busy} />
      </FieldBox>
      <Button type="button" variant="danger" onClick={() => setOpen(true)} disabled={busy}>
        <DoorOpen className="size-4" aria-hidden />
        {m.button}
      </Button>
      <ConfirmDialog open={open} title={m.confirmTitle} description={m.confirmText(earliest)} confirmLabel={m.confirm} cancelLabel={m.cancel} danger busy={busy} onConfirm={confirm} onCancel={() => setOpen(false)} />
    </div>
  );
}
