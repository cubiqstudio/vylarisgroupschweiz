"use client";

import { useState, type InputHTMLAttributes } from "react";
import { Check, Circle, Eye, EyeOff } from "lucide-react";
import { Input } from "@/components/ui/form";
import { useMessages } from "@/i18n/client";
import { account } from "@/i18n/account";
import { cn } from "@/lib/utils";

/** Passwortfeld mit Anzeigen-Umschalter. */
export function PasswordInput({ className, ...props }: Omit<InputHTMLAttributes<HTMLInputElement>, "type">) {
  const [visible, setVisible] = useState(false);
  const m = useMessages(account);
  return (
    <div className="relative">
      <Input {...props} type={visible ? "text" : "password"} className={cn("pr-11!", className)} />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-pressed={visible}
        aria-label={visible ? m.passwordInput.hide : m.passwordInput.show}
        className="absolute inset-y-0 right-0 flex w-10 items-center justify-center rounded-r-lg text-zinc-500 transition-colors hover:text-zinc-200 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-emerald-400"
      >
        {visible ? <EyeOff className="size-4" aria-hidden /> : <Eye className="size-4" aria-hidden />}
      </button>
    </div>
  );
}

const RULES = [
  { key: "length", test: (v: string) => v.length >= 12 },
  { key: "lower", test: (v: string) => /[a-z]/.test(v) },
  { key: "upper", test: (v: string) => /[A-Z]/.test(v) },
  { key: "digit", test: (v: string) => /\d/.test(v) },
] as const;

export const passwordMeetsPolicy = (v: string) => RULES.every((r) => r.test(v));

/** Zeigt die Passwortregeln an und hakt erfüllte ab (bewusst ohne Live-Ansage, um Screenreader nicht zu fluten). */
export function PasswordPolicy({ value }: { value: string }) {
  const m = useMessages(account);
  return (
    <ul className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1">
      {RULES.map((r) => {
        const okRule = r.test(value);
        return (
          <li key={r.key} className={cn("flex items-center gap-1.5 text-xs", okRule ? "text-emerald-400" : "text-zinc-500")}>
            {okRule ? <Check className="size-3.5 shrink-0" aria-hidden /> : <Circle className="size-3.5 shrink-0" aria-hidden />}
            <span>
              {m.passwordInput.rules[r.key]}
              <span className="sr-only">{okRule ? m.passwordInput.met : m.passwordInput.notMet}</span>
            </span>
          </li>
        );
      })}
    </ul>
  );
}
