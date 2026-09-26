import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { SignOutButton } from "@/components/auth/SignOutButton";

export const metadata: Metadata = { title: "Your Account" };

/*
  The account page. Deliberately small: who you are signed in as, since when,
  and a way out.

  There is no profile editing, address book or payment method here - those are
  whole features, and an empty shell of one is worse than its absence.
*/
export default async function AccountPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/signin?next=%2Faccount");

  const since = new Date(user.createdAt).toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <div className="shell py-8 sm:py-12">
      <h1 className="font-display text-display-lg font-medium text-ink">Your Account</h1>

      <div className="card mt-6 max-w-[520px] border border-line p-5">
        <dl className="space-y-4 text-body">
          <div>
            <dt className="text-body-sm text-ink-3">Signed in as</dt>
            <dd className="mt-1 font-medium text-ink">{user.email}</dd>
          </div>
          <div>
            <dt className="text-body-sm text-ink-3">Status</dt>
            <dd className="mt-1 flex items-center gap-2 text-ink">
              <ShieldCheck className="h-4 w-4 text-success" aria-hidden />
              Active since {since}
            </dd>
          </div>
        </dl>

        <div className="mt-6 flex flex-wrap items-center gap-3 border-t border-line pt-5">
          <SignOutButton />
          <Link
            href="/orders"
            className="text-body font-medium text-brand-ink hover:underline"
          >
            Your orders
          </Link>
        </div>
      </div>

      <p className="mt-4 max-w-[520px] text-body-sm text-ink-2">
        Your password is stored only as a hash and never leaves the server. This is still a demo
        storefront: no payment is ever processed.
      </p>
    </div>
  );
}
