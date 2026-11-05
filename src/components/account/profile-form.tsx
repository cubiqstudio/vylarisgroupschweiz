"use client";

import { useRouter } from "next/navigation";
import { useId, useState, type FormEvent } from "react";
import { Loader2, Save } from "lucide-react";
import { api, ApiClientError } from "@/lib/api-client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/form";
import { FieldBox, FormAlert, FormSuccess, fieldA11y } from "./form-parts";
import { useMessages } from "@/i18n/client";
import { account } from "@/i18n/account";

export function ProfileForm({ name: initialName, email, memberSince }: { name: string; email: string; memberSince: string }) {
  const uid = useId();
  const id = (n: string) => `${uid}-${n}`;
  const router = useRouter();
  const m = useMessages(account);
  const [name, setName] = useState(initialName);
  const [saved, setSaved] = useState(initialName);
  const [fieldError, setFieldError] = useState<string>();
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (loading) return;
    setLoading(true);
    setError(null);
    setFieldError(undefined);
    setOk(false);
    try {
      const res = await api<{ user: { name: string } }>("/api/account", {
        method: "PATCH",
        body: { name },
      });
      setName(res.user.name);
      setSaved(res.user.name);
      setOk(true);
      router.refresh();
    } catch (err) {
      if (err instanceof ApiClientError && err.fields?.name) setFieldError(err.fields.name);
      else setError(err instanceof ApiClientError ? err.message : m.profileForm.failed);
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
      {ok && <FormSuccess>{m.profileForm.saved}</FormSuccess>}

      <FieldBox id={id("name")} label={m.common.name} error={fieldError}>
        <Input
          id={id("name")}
          name="name"
          autoComplete="name"
          required
          maxLength={80}
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            setOk(false);
            setFieldError(undefined);
          }}
          {...fieldA11y(id("name"), fieldError)}
        />
      </FieldBox>

      <FieldBox id={id("email")} label={m.common.email} hint={m.profileForm.emailHint} aside={<Badge>{m.profileForm.confirmed}</Badge>}>
        <Input id={id("email")} value={email} readOnly aria-describedby={`${id("email")}-hint`} className="cursor-default opacity-80" />
      </FieldBox>

      <p className="text-sm text-zinc-500">
        {m.profileForm.memberSince}
        <span className="text-zinc-300">{memberSince}</span>
      </p>

      <Button type="submit" disabled={loading || name.trim() === saved}>
        {loading ? <Loader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden /> : <Save className="size-4" aria-hidden />}
        {loading ? m.common.saving : m.profileForm.save}
      </Button>
    </form>
  );
}
