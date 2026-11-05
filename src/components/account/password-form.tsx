"use client";

import { useId, useState, type FormEvent } from "react";
import { KeyRound, Loader2 } from "lucide-react";
import { api, ApiClientError } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { FieldBox, FormAlert, FormSuccess, fieldA11y } from "./form-parts";
import { PasswordInput, PasswordPolicy } from "./password-input";
import { useMessages } from "@/i18n/client";
import { account } from "@/i18n/account";

type Errors = {
  currentPassword?: string;
  newPassword?: string;
  repeat?: string;
};

export function PasswordForm() {
  const uid = useId();
  const m = useMessages(account);
  const id = (n: string) => `${uid}-${n}`;
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [repeat, setRepeat] = useState("");
  const [errors, setErrors] = useState<Errors>({});
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);
  const [loading, setLoading] = useState(false);

  function clear(key: keyof Errors) {
    setErrors((e) => ({ ...e, [key]: undefined }));
    setOk(false);
  }

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (loading) return;
    setError(null);
    setOk(false);
    if (next !== repeat) {
      setErrors({ repeat: m.passwordForm.mismatch });
      document.getElementById(id("repeat"))?.focus();
      return;
    }
    setErrors({});
    setLoading(true);
    try {
      await api("/api/account/password", {
        method: "PATCH",
        body: { currentPassword: current, newPassword: next },
      });
      setCurrent("");
      setNext("");
      setRepeat("");
      setOk(true);
    } catch (err) {
      if (err instanceof ApiClientError && (err.fields?.currentPassword || err.fields?.newPassword)) {
        setErrors({
          currentPassword: err.fields.currentPassword,
          newPassword: err.fields.newPassword,
        });
        const target = err.fields.currentPassword ? "current" : "new";
        requestAnimationFrame(() => document.getElementById(id(target))?.focus());
      } else if (err instanceof ApiClientError && err.status === 429) {
        setError(m.common.tooManyTries);
      } else {
        setError(err instanceof ApiClientError ? err.message : m.passwordForm.failed);
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} noValidate aria-busy={loading} className="space-y-5">
      {error && (
        <FormAlert>
          <p>{error}</p>
        </FormAlert>
      )}
      {ok && <FormSuccess>{m.passwordForm.ok}</FormSuccess>}

      <FieldBox id={id("current")} label={m.passwordForm.current} error={errors.currentPassword}>
        <PasswordInput
          id={id("current")}
          name="current-password"
          autoComplete="current-password"
          required
          maxLength={200}
          value={current}
          onChange={(e) => {
            setCurrent(e.target.value);
            clear("currentPassword");
          }}
          {...fieldA11y(id("current"), errors.currentPassword)}
        />
      </FieldBox>

      <FieldBox id={id("new")} label={m.passwordForm.newPassword} error={errors.newPassword} hint={m.common.passwordHint}>
        <PasswordInput
          id={id("new")}
          name="new-password"
          autoComplete="new-password"
          required
          maxLength={200}
          value={next}
          onChange={(e) => {
            setNext(e.target.value);
            clear("newPassword");
          }}
          {...fieldA11y(id("new"), errors.newPassword, true)}
        />
        <PasswordPolicy value={next} />
      </FieldBox>

      <FieldBox id={id("repeat")} label={m.passwordForm.repeat} error={errors.repeat}>
        <PasswordInput
          id={id("repeat")}
          name="new-password-repeat"
          autoComplete="new-password"
          required
          maxLength={200}
          value={repeat}
          onChange={(e) => {
            setRepeat(e.target.value);
            clear("repeat");
          }}
          {...fieldA11y(id("repeat"), errors.repeat)}
        />
      </FieldBox>

      <Button type="submit" disabled={loading}>
        {loading ? <Loader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden /> : <KeyRound className="size-4" aria-hidden />}
        {loading ? m.common.saving : m.passwordForm.submit}
      </Button>
    </form>
  );
}
