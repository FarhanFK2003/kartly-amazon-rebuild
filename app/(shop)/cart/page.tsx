import type { Metadata } from "next";
import { getBestSellers } from "@/lib/data/products";
import { getCart } from "@/lib/data/cart";
import { getSessionId } from "@/lib/session";
import { CartView } from "@/components/cart/CartView";

export const metadata: Metadata = { title: "Shopping Cart" };

export default async function CartPage() {
  // The cart itself lives in localStorage, so the server can only supply the
  // lookup data the client will need to render whatever it finds there.
  /*
    The cart is read here, on the server, from the session cookie. Leaving it to
    the client would render the empty-cart state on every load and then replace
    it once a fetch came back - a visible flash on the page where it matters
    most. The client store still takes over the moment it has its own copy.
  */
  const [recommended, initial] = await Promise.all([
    getBestSellers(10),
    getCart(await getSessionId()),
  ]);
  return <CartView recommended={recommended} initial={initial} />;
}
