"use client";

import { useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { FileUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, Select, Textarea } from "@/components/ui/form";
import { Notice } from "@/components/admin/core/notice";
import { useToast } from "@/components/admin/core/toast";
import { PAYMENT_METHODS, PAYMENT_METHOD_LABEL } from "@/lib/verein/constants";
import { formatDateCh } from "@/lib/verein/dates";
import { IMPORT_MAX_CHARS } from "@/lib/verein/fees-import";
import { call } from "./fetch";
import type { AccountOption } from "./payment-dialog";
import { Chf, TD, TH, TableWrap } from "./shared";

type PreviewLine = {
  line: number;
  reference: string;
  amountRappen: number | null;
  date: string | null;
  text: string;
  kind: "MATCH" | "NO_REFERENCE" | "UNKNOWN" | "NOT_PAYABLE" | "INVALID" | "DUPLICATE";
  message: string;
  invoice: { id: string; number: string; memberName: string } | null;
};
type Preview = { error: string | null; lines: PreviewLine[] };
type Commit = { results: Array<{ line: number; ok: boolean; message: string }>; booked: number; failed: number };

const MAX_FILE_BYTES = 1_000_000;

/** Zahlungsabgleich: CSV mit Referenz und Betrag einlesen, Rechnungen zuordnen, gewählte Zeilen als Zahlungen erfassen. */
export function PaymentImport({ accounts }: { accounts: { assets: AccountOption[]; incomes: AccountOption[] } }) {
  const router = useRouter();
  const toast = useToast();
  const uid = useId();
  const fileRef = useRef<HTMLInputElement>(null);
  const [csv, setCsv] = useState("");
  const [preview, setPreview] = useState<Preview | null>(null);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [method, setMethod] = useState<string>("UEBERWEISUNG");
  const [asset, setAsset] = useState(accounts.assets.length === 1 ? accounts.assets[0]!.id : "");
  const [income, setIncome] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<Commit | null>(null);

  async function onFile(file: File | undefined) {
    setError("");
    if (!file) return;
    if (file.size > MAX_FILE_BYTES) return setError("Die Datei ist zu gross (höchstens 1 MB).");
    if (!/\.(csv|txt)$/i.test(file.name) && file.type !== "text/csv" && file.type !== "text/plain") return setError("Bitte eine CSV-Datei wählen.");
    const text = await file.text();
    if (text.length > IMPORT_MAX_CHARS) return setError("Die Datei ist zu gross (höchstens 1 MB).");
    setCsv(text);
    setPreview(null);
    setResult(null);
  }

  async function match() {
    setBusy(true);
    setError("");
    setResult(null);
    const res = await call<Preview>("/api/admin/fees/payments/import", "POST", { csv, commit: false });
    setBusy(false);
    if (!res.ok) return setError(res.message);
    if (res.data.error) {
      setPreview(null);
      return setError(res.data.error);
    }
    setPreview(res.data);
    setSelected(new Set(res.data.lines.filter((l) => l.kind === "MATCH").map((l) => l.line)));
  }

  async function commit() {
    setBusy(true);
    setError("");
    const res = await call<Commit>("/api/admin/fees/payments/import", "POST", { csv, commit: true, lines: [...selected], method, assetAccountId: asset || null, incomeAccountId: income || null });
    setBusy(false);
    if (!res.ok) return setError(res.message);
    setResult(res.data);
    setPreview(null);
    setCsv("");
    if (fileRef.current) fileRef.current.value = "";
    if (res.data.failed === 0) toast.success(`${res.data.booked} ${res.data.booked === 1 ? "Zahlung" : "Zahlungen"} erfasst.`);
    router.refresh();
  }

  const toggle = (line: number) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(line)) next.delete(line);
      else next.add(line);
      return next;
    });

  return (
    <Card className="p-5">
      <h2 className="text-sm font-semibold text-white">Zahlungen aus einer Liste einlesen</h2>
      <p className="mt-1 max-w-2xl text-sm text-zinc-400">
        Lade eine CSV-Datei aus dem E-Banking hoch oder füge sie ein. Erwartet werden eine Kopfzeile mit den Spalten «Referenz» und «Betrag» (optional «Datum» und «Text»). Du siehst zuerst die Zuordnung zu den Rechnungen und bestätigst dann, was gebucht wird.
      </p>
      {error && (
        <Notice variant="error" className="mt-4">
          {error}
        </Notice>
      )}
      <div className="mt-4 space-y-3">
        <Field label="CSV-Datei" htmlFor={`${uid}-file`}>
          <input id={`${uid}-file`} ref={fileRef} type="file" accept=".csv,.txt,text/csv,text/plain" onChange={(e) => void onFile(e.target.files?.[0])} className="block w-full text-sm text-zinc-300 file:mr-3 file:rounded-md file:border-0 file:bg-zinc-800 file:px-3 file:py-2 file:text-sm file:font-medium file:text-zinc-100 hover:file:bg-zinc-700" />
        </Field>
        <Field label="oder hier einfügen" htmlFor={`${uid}-csv`}>
          <Textarea
            id={`${uid}-csv`}
            value={csv}
            onChange={(e) => {
              setCsv(e.target.value);
              setPreview(null);
            }}
            rows={5}
            maxLength={IMPORT_MAX_CHARS}
            className="font-mono text-xs"
            placeholder={"Datum;Referenz;Betrag\n5.11.2026;210000000003139471430009017;60.00"}
          />
        </Field>
        <Button type="button" variant="secondary" onClick={match} disabled={busy || csv.trim() === ""}>
          <FileUp className="h-4 w-4" aria-hidden />
          {busy && !preview ? "Ordne zu …" : "Zuordnen"}
        </Button>
      </div>

      {preview && (
        <div className="mt-6 space-y-4">
          <TableWrap label="Zuordnung der Zahlungen">
            <table className="w-full min-w-[44rem] border-t border-zinc-800">
              <thead>
                <tr>
                  <th className="w-10 px-4 py-2.5">
                    <span className="sr-only">Buchen</span>
                  </th>
                  <th className={TH}>Zeile</th>
                  <th className={TH}>Referenz / Datum</th>
                  <th className={`${TH} text-right`}>Betrag</th>
                  <th className={TH}>Rechnung</th>
                  <th className={TH}>Hinweis</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800">
                {preview.lines.map((l) => (
                  <tr key={l.line}>
                    <td className="px-4 py-3">
                      {l.kind === "MATCH" && <input type="checkbox" aria-label={`Zeile ${l.line} buchen`} checked={selected.has(l.line)} onChange={() => toggle(l.line)} className="h-4 w-4 rounded border-zinc-600 accent-emerald-500" />}
                    </td>
                    <td className={TD}>{l.line}</td>
                    <td className={TD}>
                      <span className="break-all font-mono text-xs">{l.reference || "–"}</span>
                      {l.date && <span className="block text-xs text-zinc-500">{formatDateCh(new Date(l.date))}</span>}
                    </td>
                    <td className={`${TD} text-right`}>{l.amountRappen !== null ? <Chf rappen={l.amountRappen} /> : "–"}</td>
                    <td className={TD}>{l.invoice ? `${l.invoice.number} · ${l.invoice.memberName}` : "–"}</td>
                    <td className={`${TD} ${l.kind === "MATCH" ? "text-emerald-300" : "text-amber-300"}`}>{l.message}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableWrap>
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Zahlungsart" htmlFor={`${uid}-method`}>
              <Select id={`${uid}-method`} value={method} onChange={(e) => setMethod(e.target.value)}>
                {PAYMENT_METHODS.map((m) => (
                  <option key={m} value={m}>
                    {PAYMENT_METHOD_LABEL[m]}
                  </option>
                ))}
              </Select>
            </Field>
            {accounts.assets.length > 0 && (
              <Field label="Eingegangen auf" htmlFor={`${uid}-asset`}>
                <Select id={`${uid}-asset`} value={asset} onChange={(e) => setAsset(e.target.value)}>
                  <option value="">Noch nicht buchen</option>
                  {accounts.assets.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.number} {a.name}
                    </option>
                  ))}
                </Select>
              </Field>
            )}
            {accounts.assets.length > 0 && accounts.incomes.length > 0 && (
              <Field label="Ertragskonto" htmlFor={`${uid}-income`} hint="Nur nötig, wenn die Rechnung keines vorgibt.">
                <Select id={`${uid}-income`} value={income} onChange={(e) => setIncome(e.target.value)}>
                  <option value="">Gemäss Rechnung</option>
                  {accounts.incomes.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.number} {a.name}
                    </option>
                  ))}
                </Select>
              </Field>
            )}
          </div>
          <div className="flex justify-end">
            <Button type="button" onClick={commit} disabled={busy || selected.size === 0}>
              {busy ? "Bitte warten …" : `${selected.size} ${selected.size === 1 ? "Zahlung" : "Zahlungen"} erfassen`}
            </Button>
          </div>
        </div>
      )}

      {result && (
        <div className="mt-6" aria-live="polite">
          <Notice variant={result.failed === 0 ? "success" : "warning"}>
            {result.booked} erfasst, {result.failed} nicht erfasst.
          </Notice>
          {result.failed > 0 && (
            <ul className="mt-3 space-y-1 text-sm text-zinc-300">
              {result.results
                .filter((r) => !r.ok)
                .map((r) => (
                  <li key={r.line}>
                    Zeile {r.line}: {r.message}
                  </li>
                ))}
            </ul>
          )}
        </div>
      )}
    </Card>
  );
}
