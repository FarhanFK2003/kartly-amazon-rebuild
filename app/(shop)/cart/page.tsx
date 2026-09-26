import type { Metadata } from "next";
import { getCartIndex } from "@/lib/commerce";
import { getBestSellers } from "@/lib/data/products";
import { CartView } from "@/components/cart/CartView";

export const metadata: Metadata = { title: "Shopping Cart" };

export default async function CartPage() {
  // The cart itself lives in localStorage, so the server can only supply the
  // lookup data the client will need to render whatever it finds there.
  return <CartView index={getCartIndex()} recommended={await getBestSellers(10)} />;
}
