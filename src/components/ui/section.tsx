import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

export function Container({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn("mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8", className)}>{children}</div>;
}

export function SectionHeading({
  eyebrow,
  title,
  description,
  align = "left",
  className,
}: {
  eyebrow?: string;
  title: ReactNode;
  description?: ReactNode;
  align?: "left" | "center";
  className?: string;
}) {
  return (
    <div className={cn("max-w-2xl", align === "center" && "mx-auto text-center", className)}>
      {eyebrow && <p className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-emerald-400">{eyebrow}</p>}
      <h2 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">{title}</h2>
      {description && <p className="mt-4 text-lg leading-relaxed text-zinc-400">{description}</p>}
    </div>
  );
}

/** Kopfbereich für Unterseiten. */
export function PageHeader({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow?: string;
  title: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div className="relative overflow-hidden border-b border-zinc-800 bg-hero">
      <div className="bg-grid pointer-events-none absolute inset-0" aria-hidden />
      <Container className="relative py-16 sm:py-20">
        {eyebrow && <p className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-emerald-400">{eyebrow}</p>}
        <h1 className="max-w-3xl text-balance hyphens-auto text-3xl font-semibold tracking-tight text-white [overflow-wrap:anywhere] min-[400px]:text-4xl sm:text-5xl">{title}</h1>
        {description && <p className="mt-5 max-w-2xl text-lg leading-relaxed text-zinc-400">{description}</p>}
        {children}
      </Container>
    </div>
  );
}
