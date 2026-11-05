"use client";

import { useId, useState, type FormEvent } from "react";
import { Building2, CheckCircle2, Clock, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/form";
import { FieldBox, FormAlert, FormSuccess, fieldA11y } from "@/components/account/form-parts";
import { useMessages } from "@/i18n/client";
import { licenses } from "@/i18n/licenses";
import { useRequest } from "./use-request";

/** Kasten „Firmenkunde“: Antrag stellen und Stand ansehen (NONE, PENDING, APPROVED, REJECTED). */
export function BusinessBox({ status, companyName }: { status: string; companyName: string }) {
  const m = useMessages(licenses);
  const uid = useId();
  const fieldId = `${uid}-company`;
  const [company, setCompany] = useState(companyName);
  const [sent, setSent] = useState(false);
  const req = useRequest(m.business.failed);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSent(false);
    const res = await req.post("/api/account/business", {
      companyName: company,
    });
    if (res) setSent(true);
  }

  const showForm = status === "NONE" || status === "REJECTED";
  const fieldError = req.fields.companyName || undefined;
  const Icon = status === "APPROVED" ? CheckCircle2 : status === "PENDING" ? Clock : Building2;

  return (
    <Card className="p-6 sm:p-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-400/10 text-emerald-400 ring-1 ring-inset ring-emerald-400/20">
            <Icon className="h-5 w-5" aria-hidden />
          </span>
          <h2 className="text-lg font-semibold tracking-tight text-white">{m.business.title}</h2>
        </div>
        {status !== "NONE" && (
          <Badge
            className={status === "APPROVED" ? "text-emerald-300 ring-emerald-400/40" : status === "REJECTED" ? "text-rose-300 ring-rose-500/40" : undefined}
          >
            <span className="sr-only">{m.business.statusLabel}: </span>
            {m.status[status] ?? status}
          </Badge>
        )}
      </div>

      {status === "NONE" && <p className="mt-4 text-sm leading-relaxed text-zinc-400">{m.business.intro}</p>}
      {status === "PENDING" && <p className="mt-4 text-sm leading-relaxed text-zinc-300">{m.business.pendingText(companyName)}</p>}
      {status === "APPROVED" && (
        <p className="mt-4 flex items-start gap-2 text-sm leading-relaxed text-zinc-300">
          <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-400" aria-hidden />
          <span>{m.business.approvedText(companyName)}</span>
        </p>
      )}
      {status === "REJECTED" && <p className="mt-4 text-sm leading-relaxed text-zinc-300">{m.business.rejectedText}</p>}

      {showForm && (
        <form onSubmit={onSubmit} noValidate aria-busy={req.loading} className="mt-5 space-y-4">
          <FieldBox id={fieldId} label={m.business.companyLabel} hint={m.business.companyHint} error={fieldError}>
            <Input
              id={fieldId}
              name="companyName"
              autoComplete="organization"
              required
              minLength={2}
              maxLength={120}
              value={company}
              onChange={(e) => {
                setCompany(e.target.value);
                if (fieldError) req.clearField("companyName");
              }}
              {...fieldA11y(fieldId, fieldError, true)}
            />
          </FieldBox>
          <Button type="submit" disabled={req.loading || company.trim().length < 2}>
            {req.loading && <Loader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden />}
            {req.loading ? m.business.submitting : status === "REJECTED" ? m.business.reapply : m.business.submit}
          </Button>
        </form>
      )}

      {/* Rückmeldungen: Fehler als Alarm, Erfolg als Statusmeldung (für Screenreader hörbar) */}
      <div className="mt-4 space-y-3">
        {req.error && <FormAlert>{req.error}</FormAlert>}
        {sent && !req.error && <FormSuccess>{m.business.sent}</FormSuccess>}
      </div>
    </Card>
  );
}
