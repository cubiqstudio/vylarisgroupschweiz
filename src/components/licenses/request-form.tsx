"use client";

import { useId, useState, type FormEvent } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/form";
import { FieldBox, FormAlert, fieldA11y } from "@/components/account/form-parts";
import { useRequest } from "./use-request";

/** Antragsformular mit optionaler Nachricht; sendet {product, message} an die angegebene Route. */
export function RequestForm<T>({
  url,
  product,
  label,
  hint,
  submit,
  busy,
  failed,
  onDone,
}: {
  url: string;
  product: string;
  label: string;
  hint: string;
  submit: string;
  busy: string;
  failed: string;
  onDone: (res: T) => void;
}) {
  const uid = useId();
  const id = `${uid}-message`;
  const [message, setMessage] = useState("");
  const req = useRequest(failed);
  const fieldError = req.fields.message || undefined;

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const res = await req.post<T>(url, { product, message });
    if (res !== null) onDone(res);
  }

  return (
    <form onSubmit={onSubmit} noValidate aria-busy={req.loading} className="space-y-4">
      <FieldBox id={id} label={label} hint={hint} error={fieldError}>
        <Textarea
          id={id}
          name="message"
          rows={3}
          maxLength={500}
          value={message}
          onChange={(e) => {
            setMessage(e.target.value);
            if (fieldError) req.clearField("message");
          }}
          {...fieldA11y(id, fieldError, true)}
        />
      </FieldBox>
      {req.error && <FormAlert>{req.error}</FormAlert>}
      <Button type="submit" disabled={req.loading}>
        {req.loading && <Loader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden />}
        {req.loading ? busy : submit}
      </Button>
    </form>
  );
}
