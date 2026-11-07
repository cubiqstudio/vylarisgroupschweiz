"use client";

import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Öffnet den Druckdialog des Browsers (dort auch «Als PDF speichern»). Wird beim Drucken ausgeblendet. */
export function PrintButton({ label, hint }: { label: string; hint?: string }) {
  return (
    <div className="invoice-hide-print mb-4 flex flex-wrap items-center gap-3">
      <Button type="button" className="!h-auto min-h-10 max-w-full !whitespace-normal !py-2 text-left" onClick={() => window.print()}>
        <Printer className="h-4 w-4" aria-hidden />
        {label}
      </Button>
      {hint && <p className="text-sm text-zinc-400">{hint}</p>}
    </div>
  );
}
