import { AlertTriangle, CheckCircle2, Info } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

type Tone = "success" | "error" | "info";

const tones: Record<Tone, { box: string; icon: typeof Info }> = {
  success: { box: "border-emerald-500/30 bg-emerald-500/10 text-emerald-200", icon: CheckCircle2 },
  error: { box: "border-rose-500/30 bg-rose-500/10 text-rose-200", icon: AlertTriangle },
  info: { box: "border-indigo-500/30 bg-indigo-500/10 text-indigo-200", icon: Info },
};

/** Inline-Hinweis. Fehler werden assertiv, alles andere höflich an Screenreader gemeldet. */
export function Notice({ tone = "info", children, className }: { tone?: Tone; children: ReactNode; className?: string }) {
  const { box, icon: Icon } = tones[tone];
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={cn("flex items-start gap-2.5 rounded-lg border px-3.5 py-3 text-sm", box, className)}
    >
      <Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
