import Link from "next/link";
import { ButtonLink } from "@/components/ui/Button";
import { getBestSellers } from "@/lib/catalog";
import { RelatedProducts } from "@/components/product/RelatedProducts";

/** Shown for an unknown product id rather than a bare 404. */
export default function ProductNotFound() {
  return (
    <div className="bg-white">
      <div className="shell py-16">
        <div className="mx-auto max-w-[560px] text-center">
          <h1 className="text-[28px] font-bold text-ink">We couldn&apos;t find that product</h1>
          <p className="mt-2 text-[14px] text-muted">
            The link may be out of date, or the item may no longer be listed on Kartly.
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <ButtonLink href="/s" variant="primary" size="md">
              Browse all products
            </ButtonLink>
            <Link href="/" className="link text-[14px]">
              Go to the homepage
            </Link>
          </div>
        </div>

        <div className="mt-12">
          <RelatedProducts products={getBestSellers(10)} title="Best Sellers you might like" />
        </div>
      </div>
    </div>
  );
}
