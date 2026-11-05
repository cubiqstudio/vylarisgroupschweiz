import Link from "next/link";
import { KeyRound } from "lucide-react";

export function MustChangeBanner() {
  return (
    <div role="alert" className="mb-6 flex flex-col gap-3 rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-3">
        <KeyRound className="mt-0.5 h-5 w-5 shrink-0 text-amber-400" aria-hidden="true" />
        <div className="text-sm">
          <p className="font-semibold text-amber-200">Bitte ändere dein Passwort.</p>
          <p className="text-amber-200/80">Dein Konto nutzt noch ein Startpasswort. Setze jetzt ein eigenes, bevor du weiterarbeitest.</p>
        </div>
      </div>
      <Link
        href="/admin/account"
        className="inline-flex h-9 shrink-0 items-center justify-center rounded-lg bg-amber-400 px-4 text-sm font-medium text-zinc-950 transition-colors hover:bg-amber-300"
      >
        Passwort ändern
      </Link>
    </div>
  );
}
