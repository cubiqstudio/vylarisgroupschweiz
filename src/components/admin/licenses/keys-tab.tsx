import Link from "next/link";
import { KeyRound, Search } from "lucide-react";
import { db } from "@/lib/db";
import { containsCI } from "@/lib/search";
import { cn, formatDateTime } from "@/lib/utils";
import { Button, buttonClass } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input, Select } from "@/components/ui/form";
import { PILL } from "@/components/admin/core/styles";
import { EmptyState } from "./empty-state";
import { KeyActions } from "./key-actions";
import { Pager } from "./pager";
import { StatusPill } from "./status-pill";
import { KEY_STATUS_LABEL } from "./types";

const PAGE_SIZE = 25;
const STATUSES = Object.keys(KEY_STATUS_LABEL);

const first = (v: string | string[] | undefined): string => (Array.isArray(v) ? v[0] : v) ?? "";

function href(f: { status: string; product: string; q: string }, page: number) {
  const sp = new URLSearchParams({ tab: "keys" });
  if (f.status) sp.set("status", f.status);
  if (f.product) sp.set("product", f.product);
  if (f.q) sp.set("q", f.q);
  if (page > 1) sp.set("page", String(page));
  return `/admin/licenses?${sp.toString()}`;
}

export async function KeysTab({ searchParams }: { searchParams: Record<string, string | string[] | undefined> }) {
  const status = STATUSES.includes(first(searchParams.status)) ? first(searchParams.status) : "";
  const product = first(searchParams.product).slice(0, 60);
  const q = first(searchParams.q).trim().slice(0, 100);
  const requestedPage = Math.max(1, Number.parseInt(first(searchParams.page), 10) || 1);
  const filters = { status, product, q };

  // `contains` ist unter SQLite case-insensitive; der Hinweis (letzte 4 Zeichen) wird groß gespeichert.
  const where = {
    ...(status && { status }),
    ...(product && { product: { slug: product } }),
    ...(q && { OR: [{ keyHint: { contains: q.toUpperCase() } }, { user: { email: containsCI(q) } }, { user: { name: containsCI(q) } }, { user: { companyName: containsCI(q) } }] }),
  };

  const [products, total] = await Promise.all([
    db.product.findMany({ orderBy: [{ sortOrder: "asc" }, { name: "asc" }], select: { slug: true, name: true } }),
    db.licenseKey.count({ where }),
  ]);
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const page = Math.min(requestedPage, totalPages);
  const items = await db.licenseKey.findMany({
    where,
    orderBy: [{ createdAt: "desc" }],
    skip: (page - 1) * PAGE_SIZE,
    take: PAGE_SIZE,
    select: {
      id: true,
      keyHint: true,
      status: true,
      message: true,
      adminNote: true,
      boundInstance: true,
      boundAt: true,
      createdAt: true,
      decidedAt: true,
      lastVerifiedAt: true,
      verifyCount: true,
      user: { select: { name: true, email: true, businessStatus: true, companyName: true } },
      product: { select: { slug: true, name: true } },
    },
  });

  const from = (page - 1) * PAGE_SIZE + 1;
  const to = from + items.length - 1;
  const filtered = Boolean(status || product || q);

  return (
    <>
      <form method="get" action="/admin/licenses" role="search" className="mb-6 grid gap-2 sm:grid-cols-[10rem_12rem_1fr_auto_auto]">
        <input type="hidden" name="tab" value="keys" />
        <div>
          <label htmlFor="key-status" className="sr-only">
            Status
          </label>
          <Select id="key-status" name="status" defaultValue={status}>
            <option value="">Alle Status</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {KEY_STATUS_LABEL[s]}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <label htmlFor="key-product" className="sr-only">
            Produkt
          </label>
          <Select id="key-product" name="product" defaultValue={product}>
            <option value="">Alle Produkte</option>
            {products.map((p) => (
              <option key={p.slug} value={p.slug}>
                {p.name}
              </option>
            ))}
          </Select>
        </div>
        <div className="relative">
          <label htmlFor="key-q" className="sr-only">
            Schlüssel durchsuchen
          </label>
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" aria-hidden />
          <Input id="key-q" name="q" type="search" defaultValue={q} maxLength={100} placeholder="Name, E-Mail, Firma oder Schlüssel-Ende" className="pl-9" />
        </div>
        <Button type="submit" variant="secondary">
          Filtern
        </Button>
        {filtered && (
          <Link href="/admin/licenses?tab=keys" className={buttonClass("ghost", "md")}>
            Zurücksetzen
          </Link>
        )}
      </form>

      {items.length === 0 ? (
        <EmptyState
          icon={KeyRound}
          title={filtered ? "Keine passenden Schlüssel" : "Noch keine Schlüssel"}
          text={filtered ? "Zu diesen Filtern gibt es keine Schlüssel. Passe die Auswahl an oder setze sie zurück." : "Sobald Nutzer Schlüssel beantragen, erscheinen sie hier."}
        />
      ) : (
        <>
          <Card className="overflow-hidden">
            <ul className="divide-y divide-zinc-800">
              {items.map((k) => {
                const label = `${k.product.name}, …${k.keyHint}, ${k.user.email}`;
                return (
                  <li key={k.id} className="px-4 py-4 sm:px-5">
                    <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5">
                      <h2 className="text-sm font-semibold text-white sm:text-base">{k.product.name}</h2>
                      <StatusPill status={k.status} />
                      <span className="font-mono text-sm text-zinc-300" title="Die letzten vier Zeichen des Schlüssels">
                        <span aria-hidden="true">…</span>
                        <span className="sr-only">Schlüssel endet auf </span>
                        {k.keyHint}
                      </span>
                      {k.user.businessStatus === "APPROVED" && <span className={cn(PILL, "bg-sky-500/10 text-sky-300 ring-sky-500/30")}>Firmenkunde</span>}
                    </div>
                    <p className="mt-1 text-sm text-zinc-300">
                      {k.user.name} <span className="break-all text-zinc-400">· {k.user.email}</span>
                      {k.user.companyName && <span className="text-zinc-400"> · {k.user.companyName}</span>}
                    </p>
                    {k.message && (
                      <p className="mt-2 max-w-3xl whitespace-pre-line break-words rounded-lg border border-zinc-800 bg-zinc-900/40 px-3 py-2 text-sm text-zinc-300">
                        <span className="mb-0.5 block text-xs font-medium text-zinc-500">Wunsch des Nutzers</span>
                        {k.message}
                      </p>
                    )}
                    {k.adminNote && (
                      <p className="mt-2 max-w-3xl whitespace-pre-line break-words text-sm text-zinc-400">
                        <span className="text-xs font-medium text-zinc-500">Hinweis an den Nutzer: </span>
                        {k.adminNote}
                      </p>
                    )}
                    <dl className="mt-2 flex flex-wrap gap-x-6 gap-y-1 text-xs text-zinc-500">
                      <div className="flex gap-1.5">
                        <dt>Beantragt:</dt>
                        <dd>
                          <time dateTime={k.createdAt.toISOString()}>{formatDateTime(k.createdAt)}</time>
                        </dd>
                      </div>
                      {k.decidedAt && (
                        <div className="flex gap-1.5">
                          <dt>Entschieden:</dt>
                          <dd>
                            <time dateTime={k.decidedAt.toISOString()}>{formatDateTime(k.decidedAt)}</time>
                          </dd>
                        </div>
                      )}
                      <div className="flex min-w-0 gap-1.5">
                        <dt>Installation:</dt>
                        <dd className="min-w-0 break-all">
                          {k.boundInstance ? (
                            <>
                              <span className="font-mono text-zinc-300">{k.boundInstance}</span>
                              {k.boundAt && <span> (seit {formatDateTime(k.boundAt)})</span>}
                            </>
                          ) : (
                            "nicht gebunden"
                          )}
                        </dd>
                      </div>
                      <div className="flex gap-1.5">
                        <dt>Letzte Prüfung:</dt>
                        <dd>{k.lastVerifiedAt ? <time dateTime={k.lastVerifiedAt.toISOString()}>{formatDateTime(k.lastVerifiedAt)}</time> : "noch nie"}</dd>
                      </div>
                      <div className="flex gap-1.5">
                        <dt>Erfolgreiche Prüfungen:</dt>
                        <dd className="tabular-nums">{k.verifyCount}</dd>
                      </div>
                    </dl>
                    <div className="mt-3">
                      <KeyActions id={k.id} status={k.status} bound={Boolean(k.boundInstance)} label={label} />
                    </div>
                  </li>
                );
              })}
            </ul>
          </Card>
          <Pager page={page} totalPages={totalPages} from={from} to={to} total={total} noun="Schlüssel" nounPlural="Schlüsseln" hrefFor={(p) => href(filters, p)} />
        </>
      )}
    </>
  );
}
