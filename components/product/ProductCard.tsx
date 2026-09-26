import Image from "next/image";
import Link from "next/link";
import type { ProductCardData } from "@/lib/types";
import { cn } from "@/lib/utils";
import { TID } from "@/lib/testids";
import { StarRating } from "@/components/ui/StarRating";
import { PriceBlock } from "@/components/ui/PriceBlock";
import { DeliveryPromise } from "@/components/ui/Badge";
import { AddToCartButton } from "@/components/product/AddToCartButton";

interface ProductCardProps {
  product: ProductCardData;
  /** Renders the add-to-cart control. Off on surfaces that are purely for navigation. */
  showCta?: boolean;
  /** Only for the first cards above the fold. */
  priority?: boolean;
  className?: string;
}

/*
  The Kartly product card.

  One composition, used everywhere - the replica had three (a grid tile, a
  full-width search row, and an unused mini), and the row was the single most
  Amazon-shaped thing in the application: a 232px thumbnail beside a wall of
  eight stacked metadata lines at more or less equal weight.

  This card has three tiers and a deliberate weight order:

    1. the photograph, square and dominant
    2. what it is and what it costs - brand, title, price
    3. everything else - rating, delivery - quiet, and last

  Metadata that used to compete with the title is demoted to one 12px line
  above it. The rating collapses from five drawn glyphs, a caret and a
  parenthesised count into "4.2 (2,823)" on a single line. The discount moves
  off the price and onto the image, where it reads as a property of the product
  rather than a second number fighting the first.

  Separation is a hairline border, not a shadow, and hover darkens that border
  rather than lifting the card. Cards are uniform height, so a grid row has one
  baseline for titles and one for prices instead of a ragged edge.
*/
export function ProductCard({ product, showCta = true, priority, className }: ProductCardProps) {
  /*
    The department label comes in on the product rather than being looked up
    here. This component is rendered from client components (Shelf, CartView),
    so it cannot query anything - and resolving the category locally meant
    importing the static catalogue, which is what shipped all 120 products to
    the browser. lib/data/products.ts fills categoryName in from the join.
  */
  const category = product.categoryName;
  const outOfStock = product.stock <= 0;

  return (
    <article
      data-testid={TID.productCard}
      className={cn(
        "group flex h-full flex-col overflow-hidden rounded-[var(--radius-md)] border border-line bg-surface",
        "transition-colors duration-150 focus-within:border-line-strong hover:border-line-strong",
        className
      )}
    >
      <Link
        href={`/dp/${product.slug}`}
        tabIndex={-1}
        aria-hidden
        className="relative block aspect-square w-full overflow-hidden bg-surface-sunk"
      >
        {product.image && (
          <Image
            src={product.image}
            alt=""
            fill
            sizes="(max-width: 640px) 45vw, (max-width: 1024px) 30vw, 260px"
            priority={priority}
            className="object-cover transition-transform duration-200 motion-safe:group-hover:scale-[1.03]"
          />
        )}

        {product.dealPercent > 0 && (
          <span className="tnum absolute bottom-2 left-2 rounded-[var(--radius-sm)] bg-accent px-[7px] py-[2px] text-label font-semibold text-white">
            &minus;{product.dealPercent}%
          </span>
        )}

        {outOfStock && (
          <span className="absolute inset-x-0 bottom-0 bg-ink/75 px-2 py-1 text-center text-label font-medium text-white">
            Out of stock
          </span>
        )}
      </Link>

      <div className="flex min-w-0 flex-1 flex-col gap-1 p-3 sm:p-4">
        {/* Tier 2: what it is. Brand and department, one quiet line. */}
        <p className="truncate text-label uppercase tracking-wide text-ink-3">
          {product.brand}
          {category && <span className="normal-case tracking-normal"> &middot; {category}</span>}
        </p>

        <h3 className="text-body leading-[19px]">
          <Link
            href={`/dp/${product.slug}`}
            data-testid={TID.productCardTitle}
            className="clamp-2 font-medium text-ink transition-colors hover:text-brand"
          >
            {product.title}
          </Link>
        </h3>

        <StarRating
          rating={product.rating}
          count={product.reviewCount}
          compact
          className="mt-[2px] text-ink-2"
        />

        <PriceBlock
          cents={product.price}
          listPrice={product.listPrice}
          dealPercent={0}
          size="sm"
          testId={TID.productCardPrice}
          className="mt-1"
        />

        {/* Tier 3: the promise, quietest line on the card. */}
        <DeliveryPromise days={product.deliveryDays} className="text-body-sm text-ink-3" />

        {product.stock > 0 && product.stock <= 3 && (
          <p className="text-body-sm text-accent">Only {product.stock} left</p>
        )}

        {showCta && (
          <div className="mt-auto pt-3">
            <AddToCartButton
              productId={product.id}
              size="sm"
              outOfStock={outOfStock}
              maxQty={Math.max(1, Math.min(30, product.stock))}
              className="w-full"
            />
          </div>
        )}
      </div>
    </article>
  );
}
