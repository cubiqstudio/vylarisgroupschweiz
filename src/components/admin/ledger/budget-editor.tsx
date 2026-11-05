"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/form";
import { cn } from "@/lib/utils";
import { Notice } from "@/components/admin/core/notice";
import { useToast } from "@/components/admin/core/toast";
import { describeError } from "@/components/admin/settings/form-utils";
import { api } from "@/lib/api-client";
import { budgetLevel, type BudgetLevel } from "@/lib/verein/ledger-lib";
import { formatChf, parseChf, toDecimalString } from "@/lib/verein/money";

export type BudgetLine = {
  id: string;
  kind: "EINNAHMEN" | "AUSGABEN";
  label: string;
  /** Budget in Rappen oder null */
  budgetRappen: number | null;
  actualRappen: number;
  previousBudgetRappen: number | null;
  previousActualRappen: number;
};

const LEVEL_BAR: Record<BudgetLevel, string> = { none: "bg-zinc-700", ok: "bg-emerald-500", warn: "bg-amber-400", over: "bg-rose-500" };
const LEVEL_TEXT: Record<BudgetLevel, string> = { none: "Kein Budget", ok: "Im Rahmen", warn: "Fast aufgebraucht", over: "Überschritten" };
const LEVEL_TEXT_INCOME: Record<BudgetLevel, string> = { none: "Kein Budget", ok: "Ziel erreicht", warn: "Unter dem Ziel", over: "" };

const toInput = (r: number | null) => (r === null ? "" : toDecimalString(r));

/** Budget je Konto und Jahr mit Soll/Ist-Vergleich. Die Differenz rechnet live mit, gespeichert wird mit einem Klick. */
export function BudgetEditor({ year, lines, canWrite, locked }: { year: number; lines: BudgetLine[]; canWrite: boolean; locked: boolean }) {
  const router = useRouter();
  const toast = useToast();
  const [values, setValues] = useState<Record<string, string>>(() => Object.fromEntries(lines.map((l) => [l.id, toInput(l.budgetRappen)])));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [fields, setFields] = useState<Record<string, string>>({});
  const editable = canWrite && !locked;

  const parsed = useMemo(() => {
    const out: Record<string, number | null | "invalid"> = {};
    for (const l of lines) {
      const raw = (values[l.id] ?? "").trim();
      if (raw === "" || raw === "-") out[l.id] = null;
      else {
        const p = parseChf(raw);
        out[l.id] = p === null || p < 0 ? "invalid" : p;
      }
    }
    return out;
  }, [lines, values]);

  const invalid = Object.values(parsed).some((p) => p === "invalid");
  const sum = (kind: "EINNAHMEN" | "AUSGABEN") => lines.filter((l) => l.kind === kind).reduce((a, l) => a + (typeof parsed[l.id] === "number" ? (parsed[l.id] as number) : 0), 0);
  const changed = lines.some((l) => (parsed[l.id] === "invalid" ? true : parsed[l.id] !== l.budgetRappen));

  function fill(source: "budget" | "actual") {
    setValues(Object.fromEntries(lines.map((l) => [l.id, source === "budget" ? toInput(l.previousBudgetRappen) : l.previousActualRappen !== 0 ? toDecimalString(l.previousActualRappen) : ""])));
  }

  async function save() {
    if (busy || invalid) return;
    setBusy(true);
    setError("");
    setFields({});
    const items = lines.map((l) => ({ categoryId: l.id, amount: parsed[l.id] === "invalid" ? "" : (parsed[l.id] as number | null) }));
    try {
      const res = await api<{ saved: number; removed: number }>("/api/admin/ledger/budget", { method: "PUT", body: { year, items } });
      toast.success(res.saved + res.removed === 0 ? "Es gab nichts zu speichern." : "Das Budget wurde gespeichert.");
      router.refresh();
    } catch (err) {
      const d = describeError(err, "Speichern fehlgeschlagen.");
      setError(d.message);
      setFields(d.fields);
    } finally {
      setBusy(false);
    }
  }

  const section = (kind: "EINNAHMEN" | "AUSGABEN", title: string) => {
    const rows = lines.filter((l) => l.kind === kind);
    return (
      <Card className="overflow-hidden">
        <h2 className="border-b border-zinc-800 px-4 py-3 text-base font-semibold text-white">{title}</h2>
        {rows.length === 0 ? (
          <p className="px-4 py-6 text-sm text-zinc-400">Keine Konten dieser Art. Lege sie unter «Konten» an.</p>
        ) : (
          <div className="overflow-x-auto" role="region" aria-label={`Budget ${title}`} tabIndex={0}>
            <table className="w-full min-w-[44rem] text-left text-sm">
              <caption className="sr-only">
                Budget und Ist {title} {year}
              </caption>
              <thead className="border-b border-zinc-800 text-xs uppercase tracking-wide text-zinc-500">
                <tr>
                  <th scope="col" className="px-4 py-2.5 font-medium">
                    Konto
                  </th>
                  <th scope="col" className="w-40 px-4 py-2.5 text-right font-medium">
                    Budget CHF
                  </th>
                  <th scope="col" className="px-4 py-2.5 text-right font-medium">
                    Ist CHF
                  </th>
                  <th scope="col" className="px-4 py-2.5 text-right font-medium">
                    {kind === "AUSGABEN" ? "Noch verfügbar" : "Differenz"}
                  </th>
                  <th scope="col" className="w-44 px-4 py-2.5 font-medium">
                    Stand
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800">
                {rows.map((l) => {
                  const p = parsed[l.id];
                  const budget = typeof p === "number" ? p : null;
                  const diff = budget === null ? null : kind === "AUSGABEN" ? budget - l.actualRappen : l.actualRappen - budget;
                  const level = budgetLevel(kind, budget, l.actualRappen);
                  const pct = budget && budget > 0 ? Math.min(100, Math.round((l.actualRappen * 100) / budget)) : level === "over" ? 100 : 0;
                  return (
                    <tr key={l.id}>
                      <td className="px-4 py-3 text-zinc-100">{l.label}</td>
                      <td className="px-4 py-2 text-right">
                        {editable ? (
                          <>
                            <label htmlFor={`b-${l.id}`} className="sr-only">
                              Budget {l.label} in CHF
                            </label>
                            <Input
                              id={`b-${l.id}`}
                              inputMode="decimal"
                              value={values[l.id] ?? ""}
                              onChange={(e) => setValues((s) => ({ ...s, [l.id]: e.target.value }))}
                              placeholder="–"
                              aria-invalid={p === "invalid" || Boolean(fields.items)}
                              className={cn("h-9 text-right tabular-nums", p === "invalid" && "border-rose-500")}
                              disabled={busy}
                            />
                            {p === "invalid" && <span className="mt-1 block text-xs text-rose-400">Ungültiger Betrag</span>}
                          </>
                        ) : (
                          <span className="tabular-nums">{l.budgetRappen === null ? "–" : formatChf(l.budgetRappen)}</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-zinc-300">{formatChf(l.actualRappen)}</td>
                      <td className={cn("px-4 py-3 text-right tabular-nums", diff !== null && diff < 0 ? "text-rose-400" : "text-zinc-300")}>{diff === null ? "–" : formatChf(diff)}</td>
                      <td className="px-4 py-3">
                        <div className="h-1.5 w-full overflow-hidden rounded-full bg-zinc-800" role="img" aria-label={`${pct} Prozent des Budgets`}>
                          <div className={cn("h-full rounded-full", LEVEL_BAR[level])} style={{ width: `${pct}%` }} />
                        </div>
                        <p className="mt-1 text-xs text-zinc-500">{kind === "AUSGABEN" ? LEVEL_TEXT[level] : (LEVEL_TEXT_INCOME[level] || LEVEL_TEXT.ok)}</p>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    );
  };

  const budgetIn = sum("EINNAHMEN");
  const budgetOut = sum("AUSGABEN");

  return (
    <div className="space-y-6">
      {locked && <Notice variant="info">Das Geschäftsjahr {year} ist abgeschlossen. Das Budget ist nur noch zur Ansicht.</Notice>}
      {error && <Notice variant="error">{error}</Notice>}

      {editable && (
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" variant="secondary" size="sm" onClick={() => fill("budget")} disabled={busy}>
            Budget des Vorjahres übernehmen
          </Button>
          <Button type="button" variant="secondary" size="sm" onClick={() => fill("actual")} disabled={busy}>
            Ist des Vorjahres übernehmen
          </Button>
          <span className="text-xs text-zinc-500">Füllt die Felder vor. Gespeichert wird erst mit «Budget speichern».</span>
        </div>
      )}

      {section("EINNAHMEN", "Einnahmen")}
      {section("AUSGABEN", "Ausgaben")}

      <Card className="px-4 py-3">
        <dl className="grid gap-3 text-sm sm:grid-cols-3">
          <div>
            <dt className="text-zinc-500">Budget Einnahmen</dt>
            <dd className="font-semibold tabular-nums text-white">CHF {formatChf(budgetIn)}</dd>
          </div>
          <div>
            <dt className="text-zinc-500">Budget Ausgaben</dt>
            <dd className="font-semibold tabular-nums text-white">CHF {formatChf(budgetOut)}</dd>
          </div>
          <div>
            <dt className="text-zinc-500">Budgetiertes Ergebnis</dt>
            <dd className={cn("font-semibold tabular-nums", budgetIn - budgetOut < 0 ? "text-rose-400" : "text-emerald-400")}>CHF {formatChf(budgetIn - budgetOut)}</dd>
          </div>
        </dl>
      </Card>

      {editable && (
        <div className="flex justify-end">
          <Button type="button" onClick={save} disabled={busy || invalid || !changed}>
            <Save className="h-4 w-4" aria-hidden />
            {busy ? "Speichere …" : "Budget speichern"}
          </Button>
        </div>
      )}
    </div>
  );
}
