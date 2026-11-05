"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useId, useState, type FormEvent } from "react";
import { Loader2, LogIn } from "lucide-react";
import { api, ApiClientError } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/form";
import { useMessages } from "@/i18n/client";
import { account } from "@/i18n/account";
import { FieldBox, FormAlert, fieldA11y, textLink } from "./form-parts";
import { PasswordInput } from "./password-input";
import { ResendVerification } from "./resend-verification";

type LoginResponse = { user: { kind: "admin" | "user" }; redirect: string };

export function LoginForm({
  nextForUser,
  nextForAdmin,
}: {
  /** Geprüfter Zielpfad für Website-Nutzer (nie unter /admin) oder null. */
  nextForUser: string | null;
  /** Geprüfter Zielpfad für Admins oder null. */
  nextForAdmin: string | null;
}) {
  const uid = useId();
  const id = (n: string) => `${uid}-${n}`;
  const router = useRouter();
  const m = useMessages(account);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fieldErrors, setFieldErrors] = useState<{
    email?: string;
    password?: string;
  }>({});
  const [error, setError] = useState<{ code: string; message: string } | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (loading) return;
    setLoading(true);
    setError(null);
    setFieldErrors({});
    try {
      const res = await api<LoginResponse>("/api/auth/login", {
        method: "POST",
        body: { email, password },
      });
      const next = res.user.kind === "admin" ? nextForAdmin : nextForUser;
      router.push(next ?? res.redirect);
      router.refresh();
    } catch (err) {
      setLoading(false);
      if (err instanceof ApiClientError) {
        if (err.fields && (err.fields.email || err.fields.password)) {
          setFieldErrors({
            email: err.fields.email,
            password: err.fields.password,
          });
          requestAnimationFrame(() => document.getElementById(id(err.fields?.email ? "email" : "password"))?.focus());
          return;
        }
        setError({
          code: err.code,
          message: err.status === 429 ? m.login.tooMany : err.message,
        });
      } else {
        setError({ code: "UNKNOWN", message: m.login.unexpected });
      }
    }
  }

  return (
    <form onSubmit={onSubmit} noValidate aria-busy={loading} className="space-y-5">
      {error && (
        <FormAlert>
          <p>{error.message}</p>
          {error.code === "EMAIL_NOT_VERIFIED" && <ResendVerification email={email} />}
        </FormAlert>
      )}

      <FieldBox id={id("email")} label={m.common.email} error={fieldErrors.email}>
        <Input
          id={id("email")}
          name="email"
          type="email"
          autoComplete="username"
          inputMode="email"
          required
          autoFocus
          maxLength={200}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          {...fieldA11y(id("email"), fieldErrors.email)}
        />
      </FieldBox>

      <FieldBox
        id={id("password")}
        label={m.common.password}
        error={fieldErrors.password}
        aside={
          <Link href="/forgot-password" className="text-xs text-emerald-400 underline-offset-4 hover:text-emerald-300 hover:underline">
            {m.login.forgot}
          </Link>
        }
      >
        <PasswordInput
          id={id("password")}
          name="password"
          autoComplete="current-password"
          required
          maxLength={200}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          {...fieldA11y(id("password"), fieldErrors.password)}
        />
      </FieldBox>

      <Button type="submit" size="lg" className="w-full" disabled={loading}>
        {loading ? <Loader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden /> : <LogIn className="size-4" aria-hidden />}
        {loading ? m.login.submitting : m.login.submit}
      </Button>
      <p className="text-center text-xs text-zinc-500">
        <Link href="/contact" className={textLink}>
          {m.login.problems}
        </Link>
      </p>
    </form>
  );
}
