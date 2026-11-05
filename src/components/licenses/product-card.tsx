"use client";

import { useState } from "react";
import { Clock, KeyRound, ShieldAlert } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { FormSuccess } from "@/components/account/form-parts";
import { useMessages } from "@/i18n/client";
import { licenses } from "@/i18n/licenses";
import { KeyDisplay } from "./key-display";
import { RequestForm } from "./request-form";

/** Für den Client aufbereitete Produktdaten (Texte schon in der Sprache der Seite, Daten schon formatiert). */
export type ProductView = {
  slug: string;
  name: string;
  description: string;
  comingSoon: boolean;
  manual: boolean;
  /** Berechtigung des Nutzers. */
  mode: "key" | "account" | "none";
  noneReason: "inactive" | "business_only" | null;
  businessStatus: string;
  key: {
    status: string;
    key: string | null;
    bound: boolean;
    adminNote: string;
    createdAt: string;
  } | null;
  webspace: { status: string; adminNote: string; createdAt: string } | null;
};

function Note({ text }: { text: string }) {
  const m = useMessages(licenses);
  if (!text) return null;
  return (
    <p className="mt-3 rounded-lg border border-zinc-800 bg-zinc-900/40 p-3 text-sm leading-relaxed text-zinc-300">
      <span className="block text-xs font-medium uppercase tracking-wider text-zinc-500">{m.product.adminNote}</span>
      {text}
    </p>
  );
}

function StatusBadge({ status }: { status: string }) {
  const m = useMessages(licenses);
  const tone =
    status === "ACTIVE" || status === "APPROVED"
      ? "text-emerald-300 ring-emerald-400/40"
      : status === "REJECTED" || status === "REVOKED"
        ? "text-rose-300 ring-rose-500/40"
        : "text-amber-300 ring-amber-400/40";
  return <Badge className={tone}>{m.status[status] ?? status}</Badge>;
}

/** Karte eines Produkts: Beschreibung, Schlüssel bzw. Antragsstand und passende Aktion. */
export function ProductCard({ p }: { p: ProductView }) {
  const m = useMessages(licenses);
  // Rückmeldung nach einem Antrag; bleibt über router.refresh() erhalten, weil die Karte nicht neu erzeugt wird.
  const [notice, setNotice] = useState<string | null>(null);
  const titleId = `product-${p.slug}`;
  const key = p.key;
  const web = p.webspace;

  let body: React.ReactNode;
  if (key) {
    if (key.status === "ACTIVE" && key.key) {
      body = <KeyDisplay value={key.key} bound={key.bound} />;
    } else if (key.status === "PENDING") {
      body = (
        <div>
          <p className="flex items-start gap-2 text-sm leading-relaxed text-zinc-300">
            <Clock className="mt-0.5 size-4 shrink-0 text-amber-300" aria-hidden />
            <span>{m.key.pendingText}</span>
          </p>
          <p className="mt-2 text-xs text-zinc-500">{m.product.requested(key.createdAt)}</p>
        </div>
      );
    } else if (key.status === "REVOKED") {
      body = (
        <div>
          <p className="flex items-start gap-2 text-sm leading-relaxed text-zinc-300">
            <ShieldAlert className="mt-0.5 size-4 shrink-0 text-rose-400" aria-hidden />
            <span>{m.key.revokedText}</span>
          </p>
          <Note text={key.adminNote} />
          <div className="mt-4">
            <ButtonLink href={m.key.supportHref} variant="secondary">
              {m.key.support}
            </ButtonLink>
          </div>
        </div>
      );
    } else {
      // REJECTED: Hinweis und erneut beantragen (nur, wenn der Nutzer weiterhin berechtigt ist)
      body = (
        <div>
          <p className="text-sm leading-relaxed text-zinc-300">{m.key.rejectedText}</p>
          <Note text={key.adminNote} />
          {p.mode === "key" && (
            <div className="mt-4">
              <RequestForm
                url="/api/account/licenses"
                product={p.slug}
                label={m.key.messageLabel}
                hint={m.key.messageHint}
                submit={m.key.reapply}
                busy={m.key.requesting}
                failed={m.key.failed}
                onDone={(res: { status: string }) => setNotice(res.status === "ACTIVE" ? m.key.issued : m.key.sent)}
              />
            </div>
          )}
        </div>
      );
    }
  } else if (p.mode === "key") {
    body = (
      <RequestForm
        url="/api/account/licenses"
        product={p.slug}
        label={m.key.messageLabel}
        hint={m.key.messageHint}
        submit={m.key.request}
        busy={m.key.requesting}
        failed={m.key.failed}
        onDone={(res: { status: string }) => setNotice(res.status === "ACTIVE" ? m.key.issued : m.key.sent)}
      />
    );
  } else if (p.mode === "account") {
    const form = (submit: string) => (
      <RequestForm
        url="/api/account/webspace"
        product={p.slug}
        label={m.account.messageLabel}
        hint={m.account.messageHint}
        submit={submit}
        busy={m.account.requesting}
        failed={m.account.failed}
        onDone={() => setNotice(m.account.sent)}
      />
    );
    body = (
      <div>
        <p className="text-sm leading-relaxed text-zinc-400">{m.account.explain}</p>
        <div className="mt-4">
          {!web && form(m.account.request)}
          {web && web.status === "PENDING" && (
            <div>
              <div className="flex flex-wrap items-center gap-3">
                <StatusBadge status="PENDING" />
                <span className="text-sm text-zinc-300">{m.account.pendingText}</span>
              </div>
              <p className="mt-2 text-xs text-zinc-500">{m.product.requested(web.createdAt)}</p>
            </div>
          )}
          {web && web.status === "APPROVED" && (
            <div className="flex flex-wrap items-center gap-3">
              <StatusBadge status="APPROVED" />
              <span className="text-sm text-zinc-300">{m.account.approvedText}</span>
            </div>
          )}
          {web && web.status === "REJECTED" && (
            <div>
              <div className="flex flex-wrap items-center gap-3">
                <StatusBadge status="REJECTED" />
                <span className="text-sm text-zinc-300">{m.account.rejectedText}</span>
              </div>
              <Note text={web.adminNote} />
              <div className="mt-4">{form(m.account.reapply)}</div>
            </div>
          )}
          {web && web.status !== "PENDING" && web.status !== "APPROVED" && web.status !== "REJECTED" && <StatusBadge status={web.status} />}
          {web && web.status === "APPROVED" && <Note text={web.adminNote} />}
        </div>
      </div>
    );
  } else {
    body = (
      <div>
        <p className="text-sm leading-relaxed text-zinc-400">{p.noneReason === "business_only" ? m.none.businessOnly : m.none.inactive}</p>
        {p.noneReason === "business_only" && p.businessStatus !== "APPROVED" && p.businessStatus !== "PENDING" && (
          <p className="mt-2 text-sm leading-relaxed text-zinc-500">{m.none.businessOnlyApply}</p>
        )}
      </div>
    );
  }

  return (
    <Card className="p-6 sm:p-8" aria-labelledby={titleId} role="group">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-400/10 text-emerald-400 ring-1 ring-inset ring-emerald-400/20">
            <KeyRound className="h-5 w-5" aria-hidden />
          </span>
          <h3 id={titleId} className="min-w-0 break-words text-lg font-semibold tracking-tight text-white">
            {p.name}
          </h3>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {p.comingSoon && <Badge className="text-amber-300 ring-amber-400/40">{m.product.comingSoon}</Badge>}
          {p.manual && <Badge>{m.product.manual}</Badge>}
          {key && <StatusBadge status={key.status} />}
        </div>
      </div>

      {p.description && <p className="mt-3 text-sm leading-relaxed text-zinc-400">{p.description}</p>}
      {p.comingSoon && <p className="mt-2 text-xs leading-relaxed text-zinc-500">{m.product.comingSoonHint}</p>}
      {p.manual && p.mode === "key" && !key && <p className="mt-2 text-xs leading-relaxed text-zinc-500">{m.product.manualHint}</p>}

      <div className="mt-6 border-t border-zinc-800 pt-6">
        {notice && (
          <div className="mb-4">
            <FormSuccess>{notice}</FormSuccess>
          </div>
        )}
        {body}
      </div>
    </Card>
  );
}
