import Link from "next/link";
import { Lock } from "lucide-react";
import { Wordmark } from "@/components/brand/Wordmark";
import { CartSync } from "@/components/cart/CartSync";

/**
 * Stripped checkout chrome: wordmark, a step label and a lock, with no nav, no
 * search and no departments. Removing the ways out of the page is the point -
 * it is the single most effective thing a checkout does to keep people in the
 * flow, and it is why checkout sits outside the (shop) route group.
 */
export default function CheckoutLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-white">
      {/*
        Checkout sits outside the (shop) group and so does not get the app bar,
        which is where the storefront loads the server-owned cart. Without this
        the checkout page would render an empty cart on every visit.
      */}
      <CartSync />
      <header className="border-b border-line bg-white">
        <div className="mx-auto flex h-[60px] max-w-[1000px] items-center justify-between gap-4 px-4">
          <Link href="/cart" className="flex items-center text-ink" aria-label="Kartly">
            <Wordmark height={28} />
          </Link>

          <h1 className="text-[20px] font-normal text-ink sm:text-[24px]">Secure checkout</h1>

          <Lock className="h-6 w-6 text-muted" aria-hidden />
        </div>
      </header>

      <main className="flex-1">{children}</main>

      <footer className="border-t border-line-soft py-6">
        <div className="mx-auto max-w-[1000px] px-4 text-center">
          <p className="text-[12px] text-muted">
            This is a simulated checkout for a demo storefront. No payment is processed and no card
            details are collected or stored.
          </p>
          <p className="mt-2 text-[12px] text-muted">
            <Link href="/help" className="link">
              Conditions of Use
            </Link>
            <span className="px-2">·</span>
            <Link href="/help" className="link">
              Privacy Notice
            </Link>
          </p>
        </div>
      </footer>
    </div>
  );
}
