import type { ReactNode } from "react";
import { Card } from "@/components/ui/card";
import { Container } from "@/components/ui/section";

/** Schmales, zentriertes Karten-Layout für alle Auth-Seiten. */
export function AuthCard({
  title,
  description,
  children,
  footer,
}: {
  title: string;
  description?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <Container className="py-12 sm:py-20">
      <div className="mx-auto w-full max-w-md">
        <h1 className="text-center text-3xl font-semibold tracking-tight text-white">{title}</h1>
        {description && <p className="mt-3 text-center text-sm leading-relaxed text-zinc-400">{description}</p>}
        <Card className="mt-8 p-6 sm:p-8">{children}</Card>
        {footer && <div className="mt-6 text-center text-sm text-zinc-400">{footer}</div>}
      </div>
    </Container>
  );
}
