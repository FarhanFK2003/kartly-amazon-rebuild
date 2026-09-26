import type { Metadata } from "next";
import { Suspense } from "react";
import { SignInForm } from "@/components/auth/SignInForm";

export const metadata: Metadata = { title: "Sign in" };

/*
  Not prerendered, despite having nothing dynamic of its own.

  Next includes the root not-found boundary in the shell of every prerendered
  page, and that boundary now reads best sellers from PostgreSQL. Prerendering
  this page would therefore make `next build` require a live database to
  produce a static sign-in form. One dynamic render of a trivial page is the
  cheaper trade.
*/
export const dynamic = "force-dynamic";

export default function SignInPage() {
  // The form reads the ?next= param, so it needs a boundary to stay static.
  return (
    <Suspense fallback={<div className="mx-auto h-[420px] w-full max-w-[350px]" aria-busy="true" />}>
      <SignInForm />
    </Suspense>
  );
}
