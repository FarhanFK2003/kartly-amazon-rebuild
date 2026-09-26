import Link from "next/link";
import { Wordmark } from "@/components/brand/Wordmark";

/**
 * Minimal auth chrome: wordmark and a thin legal footer, no nav and no search.
 * Sign-in sits outside the (shop) group for the same reason checkout does -
 * the page has one job.
 */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-paper">
      <header className="flex justify-center py-5">
        <Link href="/" className="text-ink" aria-label="Kartly home">
          <Wordmark height={34} />
        </Link>
      </header>

      <main className="flex-1 px-4">{children}</main>

      <footer className="border-t border-line-soft py-6">
        {/* Wide enough to hold the demo notice on one line from tablet width up;
           it still wraps normally on phones. */}
        <div className="mx-auto max-w-[860px] px-4 text-center">
          <p className="text-[12px] text-muted">
            Kartly is a demo storefront. The accounts are real. No payment is processed
            and no card details are collected or stored.
          </p>
          <p className="mt-2 text-[12px] text-muted">
            <Link href="/help" className="link">Conditions of Use</Link>
            <span className="px-2">·</span>
            <Link href="/help" className="link">Privacy Notice</Link>
          </p>
        </div>
      </footer>
    </div>
  );
}
