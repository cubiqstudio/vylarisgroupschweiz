import { AlertTriangle, CheckCircle2, Info, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

type Variant = "error" | "success" | "warning" | "info";

const styles: Record<Variant, { box: string; icon: typeof Info }> = {
  error: { box: "border-rose-500/30 bg-rose-500/10 text-rose-200", icon: XCircle },
  success: { box: "border-emerald-500/30 bg-emerald-500/10 text-emerald-200", icon: CheckCircle2 },
  warning: { box: "border-amber-500/30 bg-amber-500/10 text-amber-200", icon: AlertTriangle },
  info: { box: "border-indigo-500/30 bg-indigo-500/10 text-indigo-200", icon: Info },
};

/** Inline-Hinweis. Fehler werden als role="alert" ausgegeben, alles andere als role="status". */
export function Notice({
  variant = "info",
  children,
  className,
}: {
  variant?: Variant;
  children: ReactNode;
  className?: string;
}) {
  const { box, icon: Icon } = styles[variant];
  return (
    <div
      role={variant === "error" ? "alert" : "status"}
      className={cn("flex items-start gap-3 rounded-xl border px-4 py-3 text-sm", box, className)}
    >
      <Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
