"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Ban, CreditCard, Mail, Pencil, Printer, Send } from "lucide-react";
import { Button, buttonClass } from "@/components/ui/button";
import { Field, Textarea } from "@/components/ui/form";
import { Modal } from "@/components/admin/core/modal";
import { Notice } from "@/components/admin/core/notice";
import { useToast } from "@/components/admin/core/toast";
import { call } from "./fetch";
import { PaymentDialog, type AccountOption, type PaymentTarget } from "./payment-dialog";

/** Aktionen auf der Rechnungsseite: bearbeiten, versenden, Zahlung erfassen, drucken, stornieren. Die Rechte prüft immer auch der Server. */
export function InvoiceActions({
  id,
  number,
  status,
  hasEmail,
  canWrite,
  target,
  accounts,
}: {
  id: string;
  number: string;
  status: string;
  hasEmail: boolean;
  canWrite: boolean;
  target: PaymentTarget;
  accounts: { assets: AccountOption[]; incomes: AccountOption[] };
}) {
  const router = useRouter();
  const toast = useToast();
  const [dialog, setDialog] = useState<null | "send" | "resend" | "cancel" | "pay">(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const close = () => {
    if (busy) return;
    setDialog(null);
    setError("");
  };

  async function send(channel: "MAIL" | "POST") {
    setBusy(true);
    setError("");
    const res = await call<{ number: string; resent: boolean }>(`/api/admin/invoices/${encodeURIComponent(id)}/send`, "POST", { channel });
    setBusy(false);
    if (!res.ok) return setError(res.message);
    toast.success(channel === "MAIL" ? `Rechnung ${number} per E-Mail versendet.` : `Rechnung ${number} als per Post zugestellt markiert. Drucke sie über die Druckansicht aus.`);
    setDialog(null);
    router.refresh();
  }

  async function cancel() {
    setBusy(true);
    setError("");
    const res = await call(`/api/admin/invoices/${encodeURIComponent(id)}/cancel`, "POST", { reason });
    setBusy(false);
    if (!res.ok) return setError(res.fields.reason ?? res.message);
    toast.success(`Rechnung ${number} storniert.`);
    setDialog(null);
    router.refresh();
  }

  const printable = status === "OFFEN" || status === "BEZAHLT" || status === "ENTWURF";
  return (
    <>
      <div className="flex flex-wrap gap-2">
        {printable && (
          <Link href={`/admin/fees/invoices/${encodeURIComponent(id)}/print`} className={buttonClass("secondary", "md")}>
            <Printer className="h-4 w-4" aria-hidden />
            Druckansicht
          </Link>
        )}
        {canWrite && status === "ENTWURF" && (
          <>
            <Link href={`/admin/fees/invoices/${encodeURIComponent(id)}/edit`} className={buttonClass("secondary", "md")}>
              <Pencil className="h-4 w-4" aria-hidden />
              Bearbeiten
            </Link>
            <Button type="button" onClick={() => setDialog("send")}>
              <Send className="h-4 w-4" aria-hidden />
              Versenden
            </Button>
          </>
        )}
        {canWrite && status === "OFFEN" && (
          <>
            <Button type="button" onClick={() => setDialog("pay")}>
              <CreditCard className="h-4 w-4" aria-hidden />
              Zahlung erfassen
            </Button>
            <Button type="button" variant="secondary" onClick={() => setDialog("resend")} disabled={!hasEmail}>
              <Mail className="h-4 w-4" aria-hidden />
              Erneut senden
            </Button>
          </>
        )}
        {canWrite && status === "BEZAHLT" && (
          <Button type="button" variant="secondary" onClick={() => setDialog("pay")}>
            <CreditCard className="h-4 w-4" aria-hidden />
            Weitere Zahlung
          </Button>
        )}
        {canWrite && (status === "ENTWURF" || status === "OFFEN") && (
          <Button type="button" variant="danger" onClick={() => setDialog("cancel")}>
            <Ban className="h-4 w-4" aria-hidden />
            {status === "ENTWURF" ? "Verwerfen" : "Stornieren"}
          </Button>
        )}
      </div>

      <Modal open={dialog === "send"} onClose={close} title="Rechnung versenden?" description={`Rechnung ${number} wird auf «Offen» gesetzt und kann danach nicht mehr bearbeitet werden.`} size="sm" dismissible={!busy}>
        <div className="space-y-4">
          {error && <Notice variant="error">{error}</Notice>}
          {!hasEmail && <Notice variant="warning">Beim Mitglied ist keine gültige E-Mail-Adresse hinterlegt. Du kannst die Rechnung ausdrucken und per Post zustellen.</Notice>}
          <div className="flex flex-col gap-2">
            <Button type="button" onClick={() => send("MAIL")} disabled={busy || !hasEmail} data-autofocus>
              <Mail className="h-4 w-4" aria-hidden />
              {busy ? "Bitte warten …" : "Per E-Mail senden"}
            </Button>
            <Button type="button" variant="secondary" onClick={() => send("POST")} disabled={busy}>
              <Printer className="h-4 w-4" aria-hidden />
              Per Post zustellen (nur markieren)
            </Button>
            <Button type="button" variant="ghost" onClick={close} disabled={busy}>
              Abbrechen
            </Button>
          </div>
        </div>
      </Modal>

      <Modal open={dialog === "resend"} onClose={close} title="Rechnung erneut senden?" description="Das Mitglied erhält die Mail mit einem neuen Link. Der frühere Link wird ungültig." size="sm" dismissible={!busy}>
        <div className="space-y-4">
          {error && <Notice variant="error">{error}</Notice>}
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="secondary" onClick={close} disabled={busy}>
              Abbrechen
            </Button>
            <Button type="button" onClick={() => send("MAIL")} disabled={busy} data-autofocus>
              {busy ? "Bitte warten …" : "Erneut senden"}
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        open={dialog === "cancel"}
        onClose={close}
        title={status === "ENTWURF" ? "Entwurf verwerfen?" : "Rechnung stornieren?"}
        description={`Rechnung ${number} wird storniert. Die Nummer bleibt vergeben und die Rechnung bleibt als storniert sichtbar. Das lässt sich nicht rückgängig machen.`}
        size="sm"
        dismissible={!busy}
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!busy) void cancel();
          }}
          className="space-y-4"
        >
          {error && <Notice variant="error">{error}</Notice>}
          <Field label="Begründung" htmlFor="cancel-reason" hint="Wird intern festgehalten.">
            <Textarea id="cancel-reason" value={reason} onChange={(e) => setReason(e.target.value)} rows={3} maxLength={500} required data-autofocus />
          </Field>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="secondary" onClick={close} disabled={busy}>
              Abbrechen
            </Button>
            <Button type="submit" variant="danger" disabled={busy || reason.trim().length < 3}>
              {busy ? "Bitte warten …" : status === "ENTWURF" ? "Verwerfen" : "Stornieren"}
            </Button>
          </div>
        </form>
      </Modal>

      <PaymentDialog open={dialog === "pay"} onClose={() => setDialog(null)} invoice={target} accounts={accounts} />
    </>
  );
}
