"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import Link from "next/link";
import { Info, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Field";
import { useAuth } from "@/lib/store/auth";
import { validateCredentials, hasErrors, type CredentialsDraft, type Errors } from "@/lib/validation";

type Mode = "signin" | "register";

/**
 * Simulated sign-in.
 *
 * No credentials are authenticated, transmitted or stored. The password is
 * validated for shape and then discarded - only a display name and the typed
 * identifier are kept, in localStorage, so the header can greet you.
 *
 * Validation is hand-rolled and the form carries noValidate, matching checkout,
 * so the messages are ours and appear inline.
 */
export function SignInForm() {
  const router = useRouter();
  const params = useSearchParams();
  const signIn = useAuth((s) => s.signIn);

  const [mode, setMode] = useState<Mode>("signin");
  const [draft, setDraft] = useState<CredentialsDraft>({ identifier: "", password: "", name: "" });
  const [errors, setErrors] = useState<Errors<CredentialsDraft>>({});
  const [showReset, setShowReset] = useState(false);
  const [busy, setBusy] = useState(false);

  // Somewhere to return to, so signing in from the header does not dump you home.
  const next = params.get("next");
  const destination = next && next.startsWith("/") ? next : "/";

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const found = validateCredentials(draft, mode);
    setErrors(found);
    if (hasErrors(found)) return;

    setBusy(true);
    signIn(draft.identifier, mode === "register" ? draft.name : undefined);
    router.push(destination);
  }

  function switchMode(nextMode: Mode) {
    setMode(nextMode);
    setErrors({});
    setShowReset(false);
  }

  return (
    <div className="mx-auto w-full max-w-[350px]">
      <div className="rounded-[8px] border border-line bg-white px-5 py-5">
        <h1 className="text-[28px] font-normal leading-8 text-ink">
          {mode === "signin" ? "Sign in" : "Create account"}
        </h1>

        <div className="mt-3 flex items-start gap-2 rounded-[8px] border border-[#f5d9a0] bg-[#fef8ec] px-3 py-2">
          <Info className="mt-[2px] h-4 w-4 shrink-0 text-[#b26a00]" aria-hidden />
          <p className="text-[12px] leading-[17px] text-ink">
            <strong>Simulated sign-in.</strong> Nothing is authenticated and no password is stored
            or sent. Use any email and any password of 6+ characters.
          </p>
        </div>

        <form onSubmit={submit} noValidate className="mt-4 space-y-3">
          {mode === "register" && (
            <Field label="Your name" htmlFor="name" error={errors.name}>
              <Input
                id="name"
                value={draft.name}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                invalid={!!errors.name}
                autoComplete="name"
                placeholder="First and last name"
              />
            </Field>
          )}

          <Field label="Email or mobile phone number" htmlFor="identifier" error={errors.identifier}>
            <Input
              id="identifier"
              value={draft.identifier}
              onChange={(e) => setDraft({ ...draft, identifier: e.target.value })}
              invalid={!!errors.identifier}
              autoComplete="username"
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

          <Button type="submit" variant="primary" size="md" fullWidth loading={busy}>
            {mode === "signin" ? "Sign in" : "Create your Kartly account"}
          </Button>
        </form>

        {mode === "signin" && (
          <>
            <button
              type="button"
              onClick={() => setShowReset((v) => !v)}
              aria-expanded={showReset}
              className="link mt-3 text-[13px]"
            >
              Forgot your password?
            </button>
            {showReset && (
              <p className="mt-1 rounded-[8px] bg-[#f7f8f8] px-3 py-2 text-[12px] leading-[17px] text-muted">
                There is no password to reset. This demo accepts any email and any password of six
                characters or more.
              </p>
            )}
          </>
        )}

        <p className="mt-4 text-[12px] leading-4 text-muted">
          By continuing you agree that this is a demo storefront and that no real account is
          created.
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
        No credentials leave this browser
      </p>

      <p className="mt-2 text-center text-[13px]">
        <Link href="/" className="link">
          Continue shopping without signing in
        </Link>
      </p>
    </div>
  );
}
