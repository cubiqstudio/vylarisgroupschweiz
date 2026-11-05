import Link from "next/link";
import { Card } from "@/components/ui/card";
import { ADMIN_ROLE_LABEL, ADMIN_ROLE_VALUES, MODULE_LABEL, VEREIN_MODULES, levelFor, roleHint, type EffectiveMatrix } from "@/lib/verein/permissions";

/** Übersicht «Wer darf was?»: die wirksame Rechtematrix (Voreinstellung plus Anpassungen) als Tabelle. */
export function RoleMatrix({ matrix, canEdit = false }: { matrix: EffectiveMatrix; canEdit?: boolean }) {
  const modules = VEREIN_MODULES.filter((m) => m !== "self");
  return (
    <details className="mt-8 rounded-2xl border border-zinc-800 bg-surface">
      <summary className="cursor-pointer list-none px-5 py-4 text-sm font-semibold text-white [&::-webkit-details-marker]:hidden">Wer darf was? Rollen im Überblick</summary>
      <div className="border-t border-zinc-800 px-5 py-4">
        <p className="mb-4 max-w-3xl text-sm text-zinc-400">
          Die Zuordnung ist eine Voreinstellung für die übliche Aufgabenverteilung im Vorstand und lässt sich anpassen. «Ändern» schliesst «Lesen» ein. Die Statuten gehen vor. Das Amt im Verein gibt keinen Zugriff, nur die Rolle.{" "}
          {canEdit && (
            <Link href="/admin/verein/rollen" className="text-emerald-400 underline underline-offset-2 hover:text-emerald-300">
              Rollen und Rechte einstellen
            </Link>
          )}
        </p>
        <dl className="mb-5 grid gap-3 sm:grid-cols-2">
          {ADMIN_ROLE_VALUES.map((r) => (
            <div key={r}>
              <dt className="text-sm font-medium text-zinc-200">{ADMIN_ROLE_LABEL[r]}</dt>
              <dd className="text-xs text-zinc-500">{roleHint(r, matrix)}</dd>
            </div>
          ))}
        </dl>
        <Card className="overflow-hidden">
          <div className="overflow-x-auto" role="region" aria-label="Rechte je Rolle" tabIndex={0}>
            <table className="w-full min-w-[44rem] text-left text-xs">
              <caption className="sr-only">Rechte je Rolle und Bereich</caption>
              <thead className="border-b border-zinc-800 text-zinc-500">
                <tr>
                  <th scope="col" className="px-3 py-2 font-medium">Bereich</th>
                  {ADMIN_ROLE_VALUES.map((r) => (
                    <th key={r} scope="col" className="px-2 py-2 text-center font-medium">
                      {ADMIN_ROLE_LABEL[r].replace(" (nur lesen)", "")}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800">
                {modules.map((m) => (
                  <tr key={m}>
                    <th scope="row" className="px-3 py-2 text-left font-normal text-zinc-300">{MODULE_LABEL[m]}</th>
                    {ADMIN_ROLE_VALUES.map((r) => {
                      const level = levelFor([r], m, matrix);
                      return (
                        <td key={r} className="px-2 py-2 text-center">
                          {level === "write" ? (
                            <span className="font-semibold text-emerald-400" title="Lesen und ändern">
                              Ändern<span className="sr-only"> ({ADMIN_ROLE_LABEL[r]}, {MODULE_LABEL[m]})</span>
                            </span>
                          ) : level === "read" ? (
                            <span className="text-zinc-300" title="Nur lesen">
                              Lesen<span className="sr-only"> ({ADMIN_ROLE_LABEL[r]}, {MODULE_LABEL[m]})</span>
                            </span>
                          ) : (
                            <span className="text-zinc-600">
                              –<span className="sr-only">kein Zugriff ({ADMIN_ROLE_LABEL[r]}, {MODULE_LABEL[m]})</span>
                            </span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </details>
  );
}
