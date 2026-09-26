import type { Metadata } from "next";
import { getCartIndex } from "@/lib/commerce";
import { CheckoutView } from "@/components/checkout/CheckoutView";

export const metadata: Metadata = { title: "Secure checkout" };

/*
  Not prerendered. Next includes the root not-found boundary in the shell of
  every prerendered page, and that boundary reads best sellers from PostgreSQL,
  so prerendering this page would make `next build` require a live database.
  See app/(shop)/layout.tsx for the same decision applied to the storefront.
*/
export const dynamic = "force-dynamic";

export default function CheckoutPage() {
  return <CheckoutView index={getCartIndex()} />;
}
