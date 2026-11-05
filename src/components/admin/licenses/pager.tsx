import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { buttonClass } from "@/components/ui/button";

/** Seitennavigation wie in der Benutzerliste. `hrefFor` baut die URL mit den aktuellen Filtern. */
export function Pager({
  page,
  totalPages,
  from,
  to,
  total,
  noun,
  nounPlural,
  hrefFor,
}: {
  page: number;
  totalPages: number;
  from: number;
  to: number;
  total: number;
  noun: string;
  nounPlural: string;
  hrefFor: (page: number) => string;
}) {
  const disabled = "pointer-events-none opacity-50";
  return (
    <div className="mt-4 flex flex-col items-center justify-between gap-3 sm:flex-row">
      <p className="text-sm text-zinc-500" aria-live="polite">
        {from}–{to} von {total} {total === 1 ? noun : nounPlural}
      </p>
      {totalPages > 1 && (
        <nav aria-label="Seitennavigation" className="flex items-center gap-2">
          {page > 1 ? (
            <Link href={hrefFor(page - 1)} className={buttonClass("secondary", "sm")} rel="prev">
              <ChevronLeft className="h-4 w-4" aria-hidden />
              Zurück
            </Link>
          ) : (
            <span className={buttonClass("secondary", "sm", disabled)} aria-disabled="true">
              <ChevronLeft className="h-4 w-4" aria-hidden />
              Zurück
            </span>
          )}
          <span className="px-2 text-sm tabular-nums text-zinc-400">
            Seite {page} von {totalPages}
          </span>
          {page < totalPages ? (
            <Link href={hrefFor(page + 1)} className={buttonClass("secondary", "sm")} rel="next">
              Weiter
              <ChevronRight className="h-4 w-4" aria-hidden />
            </Link>
          ) : (
            <span className={buttonClass("secondary", "sm", disabled)} aria-disabled="true">
              Weiter
              <ChevronRight className="h-4 w-4" aria-hidden />
            </span>
          )}
        </nav>
      )}
    </div>
  );
}
