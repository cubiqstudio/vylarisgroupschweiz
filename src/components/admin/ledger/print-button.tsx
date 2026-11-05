"use client";

import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Druckdialog des Browsers öffnen (A4, Hochformat). */
export function PrintButton() {
  return (
    <Button type="button" onClick={() => window.print()}>
      <Printer className="h-4 w-4" aria-hidden />
      Drucken oder als PDF speichern
    </Button>
  );
}
