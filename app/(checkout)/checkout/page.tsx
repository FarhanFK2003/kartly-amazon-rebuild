import type { Metadata } from "next";
import { getCartIndex } from "@/lib/commerce";
import { CheckoutView } from "@/components/checkout/CheckoutView";

export const metadata: Metadata = { title: "Secure checkout" };

export default function CheckoutPage() {
  return <CheckoutView index={getCartIndex()} />;
}
