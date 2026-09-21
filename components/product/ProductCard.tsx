import Image from "next/image";
import Link from "next/link";
import type { Product } from "@/lib/types";
import { cn } from "@/lib/utils";
import { StarRating } from "@/components/ui/StarRating";
import { PriceBlock } from "@/components/ui/PriceBlock";
import { Badge, DeliveryPromise, SponsoredBadge, StockWarning } from "@/components/ui/Badge";
import { AddToCartButton } from "@/components/product/AddToCartButton";

export type ProductCardVariant = "grid" | "row" | "mini";

interface ProductCardProps {
  product: Product;
  variant?: ProductCardVariant;
  /** Hide the CTA where the card is decorative (recently viewed rails). */
  showCta?: boolean;
  priority?: boolean;
  className?: string;
}

/**
 * One card, three layouts. Every listing surface in the app renders through this
 * so price, rating, badge and delivery treatment can never drift apart between
 * the homepage, search results and the cart rails.
 */
export function ProductCard({
  product,
  variant = "grid",
  showCta = true,
  priority = false,
  className,
}: ProductCardProps) {
  if (variant === "row") return <RowCard product={product} showCta={showCta} priority={priority} className={className} />;
  if (variant === "mini") return <MiniCard product={product} className={className} />;
  return <GridCard product={product} showCta={showCta} priority={priority} className={className} />;
}

/* ---------- shared pieces ---------- */

/**
 * Product thumbnail.
 *
 * fit is "contain" by default, which is right where the product needs to be
 * read in full - a search row, the buy box, the cart.
 *
 * Carousels and grids pass "cover". The catalogue is photographs rather than
 * cut-outs on white, so contained inside a square box every one rendered at a
 * different size: a wide shot sat short and letterboxed, a tall one narrow, and
 * a row of cards had no common edge to scan down. Filling the square makes the
 * row uniform, which is the whole point of a grid.
 */
function Thumb({
  product,
  sizes,
  priority,
  fit = "contain",
  className,
}: {
  product: Product;
  sizes: string;
  priority?: boolean;
  fit?: "contain" | "cover";
  className?: string;
}) {
  return (
    <div className={cn("relative overflow-hidden rounded-[4px] bg-white", className)}>
      {product.image && (
        <Image
          src={product.image}
          alt={product.title}
          fill
          sizes={sizes}
          priority={priority}
          className={fit === "cover" ? "object-cover" : "object-contain"}
        />
      )}
    </div>
  );
}

function TopBadge({ product }: { product: Product }) {
  if (product.badges.includes("bestSeller")) return <Badge variant="bestSeller">Best Seller</Badge>;
  if (product.badges.includes("choice")) return <Badge variant="choice">Kartly&apos;s Choice</Badge>;
  return null;
}

/* ---------- grid: homepage carousels and category grids ---------- */

function GridCard({ product, showCta, priority, className }: Required<Pick<ProductCardProps, "product">> & { showCta?: boolean; priority?: boolean; className?: string }) {
  return (
    <div className={cn("flex h-full flex-col", className)}>
      <Link href={`/dp/${product.slug}`} className="block">
        <Thumb
          product={product}
          sizes="(max-width: 640px) 45vw, 200px"
          priority={priority}
          fit="cover"
          className="mb-2 aspect-square w-full"
        />
      </Link>

      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex flex-wrap gap-1 empty:hidden">
          <TopBadge product={product} />
        </div>

        <StockWarning stock={product.stock} />

        <Link href={`/dp/${product.slug}`} className="clamp-2 text-[13px] leading-[18px] text-link hover:text-link-hover hover:underline">
          {product.title}
        </Link>

        <StarRating rating={product.rating} count={product.reviewCount} size="sm" />

        <PriceBlock cents={product.price} listPrice={product.listPrice} dealPercent={product.dealPercent} size="sm" />

        <DeliveryPromise days={product.deliveryDays} />

        {showCta && (
          <div className="mt-auto pt-2">
            <AddToCartButton
              productId={product.id}
              size="sm"
              outOfStock={product.stock <= 0}
              maxQty={Math.max(1, Math.min(30, product.stock))}
            />
          </div>
        )}
      </div>
    </div>
  );
}

/* ---------- row: search results ---------- */

function RowCard({ product, showCta, priority, className }: Required<Pick<ProductCardProps, "product">> & { showCta?: boolean; priority?: boolean; className?: string }) {
  /*
    Mobile is a genuine re-layout, not a squeezed desktop row: the image shrinks
    to a 128px square and stays beside the text so the list keeps its scannable
    rhythm, while the secondary lines (subtitle, social proof, variant link)
    drop away rather than wrapping into a wall of text.
  */
  return (
    <article className={cn("flex gap-3 py-4 sm:gap-4 sm:py-5", className)}>
      <Link href={`/dp/${product.slug}`} className="shrink-0">
        <Thumb
          product={product}
          sizes="(max-width: 640px) 128px, 232px"
          priority={priority}
          className="h-[128px] w-[128px] sm:h-[232px] sm:w-[232px]"
        />
      </Link>

      <div className="flex min-w-0 flex-1 flex-col gap-[4px] sm:gap-[6px]">
        {product.badges.includes("sponsored") && <SponsoredBadge />}

        <div className="flex flex-wrap gap-1 empty:hidden">
          <TopBadge product={product} />
        </div>

        <Link
          href={`/dp/${product.slug}`}
          className="clamp-2 text-[15px] leading-5 text-ink hover:text-link-hover hover:underline sm:clamp-2 sm:text-[18px] sm:leading-6"
        >
          {product.title}
        </Link>

        <p className="clamp-1 hidden text-[13px] text-muted sm:block">{product.bullets[0]}</p>

        <StarRating
          rating={product.rating}
          count={product.reviewCount}
          size="sm"
          showValue
          showCaret
          parenthesised
          href={`/dp/${product.slug}#reviews`}
          className="sm:hidden"
        />
        <StarRating
          rating={product.rating}
          count={product.reviewCount}
          size="md"
          showValue
          showCaret
          parenthesised
          href={`/dp/${product.slug}#reviews`}
          className="hidden sm:inline-flex"
        />

        {product.boughtLastMonth > 0 && (
          <p className="hidden text-[13px] text-muted sm:block">
            {product.boughtLastMonth.toLocaleString("en-US")}+ bought in past month
          </p>
        )}

        <PriceBlock
          cents={product.price}
          listPrice={product.listPrice}
          dealPercent={product.dealPercent}
          size="md"
          className="mt-[2px] sm:hidden"
        />
        <PriceBlock
          cents={product.price}
          listPrice={product.listPrice}
          dealPercent={product.dealPercent}
          size="lg"
          className="mt-1 hidden sm:block"
        />

        <DeliveryPromise days={product.deliveryDays} />

        <StockWarning stock={product.stock} />

        {showCta && (
          <div className="mt-2">
            <AddToCartButton
              productId={product.id}
              size="sm"
              outOfStock={product.stock <= 0}
              maxQty={Math.max(1, Math.min(30, product.stock))}
              className="w-full sm:w-[220px]"
            />
          </div>
        )}

        {product.variants.length > 1 && (
          <Link href={`/dp/${product.slug}`} className="link mt-1 hidden w-fit text-[13px] underline sm:block">
            +{product.variants.length - 1} other {product.variants[0].type === "color" ? "colours" : "options"}
          </Link>
        )}
      </div>
    </article>
  );
}

/* ---------- mini: sidebar rails and recently viewed ---------- */

function MiniCard({ product, className }: { product: Product; className?: string }) {
  return (
    <div className={cn("flex gap-3", className)}>
      <Link href={`/dp/${product.slug}`} className="shrink-0">
        <Thumb product={product} sizes="72px" className="h-[72px] w-[72px]" />
      </Link>
      <div className="flex min-w-0 flex-col gap-[2px]">
        <Link href={`/dp/${product.slug}`} className="clamp-2 text-[13px] leading-[17px] text-link hover:text-link-hover hover:underline">
          {product.title}
        </Link>
        <StarRating rating={product.rating} count={product.reviewCount} size="sm" />
        <PriceBlock cents={product.price} size="xs" />
      </div>
    </div>
  );
}
