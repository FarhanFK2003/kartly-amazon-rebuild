"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import Link from "next/link";
import { Info, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Field";
import { useAuth, type AuthUser } from "@/lib/store/auth";
import { validateCredentials, hasErrors, type CredentialsDraft, type Errors } from "@/lib/validation";

type Mode = "signin" | "register";

/**
 * Sign in and create account.
 *
 * Authentication is real: accounts live in PostgreSQL through Prisma, and the
 * password is stored only as a bcrypt hash - never in plaintext, and never
 * returned by the API. A successful sign-in sets an httpOnly session cookie,
 * which page script cannot read; nothing about the session is kept in
 * localStorage.
 *
 * The checks below are client-side convenience only. The server validates the
 * same rules again and is the authority. Validation is hand-rolled and the form
 * carries noValidate, matching checkout, so the messages are ours and appear
 * inline.
 */
export function SignInForm() {
  const router = useRouter();
  const params = useSearchParams();
  const setUser = useAuth((s) => s.setUser);

  const [mode, setMode] = useState<Mode>("signin");
  const [draft, setDraft] = useState<CredentialsDraft>({ identifier: "", password: "", confirm: "" });
  const [errors, setErrors] = useState<Errors<CredentialsDraft>>({});
  const [busy, setBusy] = useState(false);
  /* Whatever the server said went wrong - bad credentials, duplicate email. */
  const [formError, setFormError] = useState("");

  // Somewhere to return to, so signing in from the header does not dump you home.
  const next = params.get("next");
  const destination = next && next.startsWith("/") ? next : "/";

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setFormError("");

    const found = validateCredentials(draft, mode);
    if (mode === "register" && draft.password !== draft.confirm) {
      found.confirm = "Passwords do not match";
    }
    setErrors(found);
    if (hasErrors(found)) return;

    setBusy(true);
    try {
      const res = await fetch(mode === "signin" ? "/api/auth/login" : "/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: draft.identifier, password: draft.password }),
      });
      const body = (await res.json().catch(() => ({}))) as {
        user?: AuthUser;
        error?: string;
      };

      if (!res.ok || !body.user) {
        setBusy(false);
        setFormError(body.error ?? "Something went wrong. Please try again.");
        return;
      }

      setUser(body.user);
      router.push(destination);
      router.refresh();
    } catch {
      setBusy(false);
      setFormError("We could not reach the server. Please try again.");
    }
  }

  function switchMode(nextMode: Mode) {
    setMode(nextMode);
    setErrors({});
    setFormError("");
  }

  return (
    <div className="mx-auto w-full max-w-[350px]">
      <div className="rounded-[8px] border border-line bg-white px-5 py-5">
        <h1 className="text-[28px] font-normal leading-8 text-ink">
          {mode === "signin" ? "Sign in" : "Create account"}
        </h1>

        {formError && (
          <div
            role="alert"
            className="mt-3 flex items-start gap-2 rounded-[8px] border border-accent/40 bg-accent-tint px-3 py-2"
          >
            <Info className="mt-[2px] h-4 w-4 shrink-0 text-accent" aria-hidden />
            <p className="text-[12px] leading-[17px] text-ink">{formError}</p>
          </div>
        )}

        <form onSubmit={submit} noValidate className="mt-4 space-y-3">
          <Field label="Email address" htmlFor="identifier" error={errors.identifier}>
            <Input
              id="identifier"
              value={draft.identifier}
              onChange={(e) => setDraft({ ...draft, identifier: e.target.value })}
              invalid={!!errors.identifier}
              autoComplete="email"
              type="email"
              placeholder="you@example.com"
            />
          </Field>

          <Field
            label="Password"
            htmlFor="password"
            error={errors.password}
            hint={mode === "register" ? "At least 6 characters." : undefined}
          >
            <Input
              id="password"
              type="password"
              value={draft.password}
              onChange={(e) => setDraft({ ...draft, password: e.target.value })}
              invalid={!!errors.password}
              autoComplete={mode === "signin" ? "current-password" : "new-password"}
            />
          </Field>

          {mode === "register" && (
            <Field label="Confirm password" htmlFor="confirm" error={errors.confirm}>
              <Input
                id="confirm"
                type="password"
                value={draft.confirm}
                onChange={(e) => setDraft({ ...draft, confirm: e.target.value })}
                invalid={!!errors.confirm}
                autoComplete="new-password"
              />
            </Field>
          )}

          <Button type="submit" variant="primary" size="md" fullWidth loading={busy}>
            {mode === "signin" ? "Sign in" : "Create your Kartly account"}
          </Button>
        </form>

        <p className="mt-4 text-[12px] leading-4 text-muted">
          Accounts are real and your password is stored only as a hash. This is still a demo
          storefront: no payment is ever processed.
        </p>
      </div>

      {/* mode switch */}
      <div className="relative my-5">
        <span className="absolute inset-x-0 top-1/2 h-px bg-line" aria-hidden />
        <span className="relative mx-auto block w-fit bg-paper px-3 text-[12px] text-muted">
          {mode === "signin" ? "New to Kartly?" : "Already have an account?"}
        </span>
      </div>

      <Button
        type="button"
        variant="outline"
        size="md"
        fullWidth
        onClick={() => switchMode(mode === "signin" ? "register" : "signin")}
      >
        {mode === "signin" ? "Create your Kartly account" : "Sign in instead"}
      </Button>

      <p className="mt-6 flex items-center justify-center gap-1 text-[12px] text-muted">
        <ShieldCheck className="h-3.5 w-3.5" aria-hidden />
        Passwords are hashed, never stored in the browser
      </p>

      <p className="mt-2 text-center text-[13px]">
        <Link href="/" className="link">
          Continue shopping without signing in
        </Link>
      </p>
    </div>
  );
}
