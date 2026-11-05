import type { LucideIcon } from "lucide-react";
import { Hourglass } from "lucide-react";
import { Card } from "@/components/ui/card";
import { PageTitle } from "@/components/admin/core/page-title";

/** Platzhalter für Verwaltungsbereiche, die noch aufgebaut werden. Wird durch die echte Seite ersetzt. */
export function AdminInProgress({ title, description, icon: Icon = Hourglass }: { title: string; description: string; icon?: LucideIcon }) {
  return (
    <>
      <PageTitle title={title} description={description} />
      <Card className="flex flex-col items-center px-6 py-16 text-center">
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-zinc-800/80 text-zinc-400 ring-1 ring-inset ring-zinc-700">
          <Icon className="h-5 w-5" aria-hidden />
        </span>
        <h2 className="mt-4 text-lg font-semibold text-white">In Arbeit</h2>
        <p className="mt-1.5 max-w-sm text-sm text-zinc-400">Dieser Bereich wird gerade aufgebaut und ist bald verfügbar.</p>
      </Card>
    </>
  );
}
