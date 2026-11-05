"use client";

import { useId, useState, type FormEvent } from "react";
import { Loader2, Trash2 } from "lucide-react";
import { api, ApiClientError } from "@/lib/api-client";
import { Modal } from "@/components/admin/core/modal";
import { Button } from "@/components/ui/button";
import { FieldBox, FormAlert, fieldA11y } from "./form-parts";
import { PasswordInput } from "./password-input";
import { useMessages } from "@/i18n/client";
import { account } from "@/i18n/account";

export function DeleteAccount() {
  const uid = useId();
  const m = useMessages(account);
  const fieldId = `${uid}-password`;
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [fieldError, setFieldError] = useState<string>();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function close() {
    if (busy) return;
    setOpen(false);
    setPassword("");
    setFieldError(undefined);
    setError(null);
  }

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy) return;
    if (!password) {
      setFieldError(m.deleteAccount.needPassword);
      return;
    }
    setBusy(true);
    setError(null);
    setFieldError(undefined);
    try {
      await api("/api/account", { method: "DELETE", body: { password } });
      window.location.assign("/");
    } catch (err) {
      setBusy(false);
      if (err instanceof ApiClientError && err.fields?.password) setFieldError(err.fields.password);
      else if (err instanceof ApiClientError && err.status === 429) setError(m.common.tooManyTries);
      else setError(err instanceof ApiClientError ? err.message : m.deleteAccount.failed);
    }
  }

  return (
    <>
      <Button type="button" variant="danger" onClick={() => setOpen(true)}>
        <Trash2 className="size-4" aria-hidden />
        {m.deleteAccount.open}
      </Button>

      <Modal open={open} onClose={close} dismissible={!busy} size="sm" title={m.deleteAccount.modalTitle} description={m.deleteAccount.modalText}>
        <form onSubmit={onSubmit} noValidate aria-busy={busy} className="space-y-4">
          {error && (
            <FormAlert>
              <p>{error}</p>
            </FormAlert>
          )}
          <FieldBox id={fieldId} label={m.common.password} error={fieldError}>
            <PasswordInput
              id={fieldId}
              name="password"
              autoComplete="current-password"
              required
              maxLength={200}
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                setFieldError(undefined);
              }}
              {...fieldA11y(fieldId, fieldError)}
            />
          </FieldBox>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="secondary" onClick={close} disabled={busy}>
              {m.common.cancel}
            </Button>
            <Button type="submit" variant="danger" disabled={busy}>
              {busy ? <Loader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden /> : <Trash2 className="size-4" aria-hidden />}
              {busy ? m.deleteAccount.submitting : m.deleteAccount.submit}
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
