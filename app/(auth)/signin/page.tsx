import type { Metadata } from "next";
import { Suspense } from "react";
import { SignInForm } from "@/components/auth/SignInForm";

export const metadata: Metadata = { title: "Sign in" };

export default function SignInPage() {
  // The form reads the ?next= param, so it needs a boundary to stay static.
  return (
    <Suspense fallback={<div className="mx-auto h-[420px] w-full max-w-[350px]" aria-busy="true" />}>
      <SignInForm />
    </Suspense>
  );
}
