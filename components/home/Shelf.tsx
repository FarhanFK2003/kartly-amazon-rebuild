"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ArrowRight, ChevronLeft, ChevronRight } from "lucide-react";
import { ProductCard } from "@/components/product/ProductCard";
import { TID } from "@/lib/testids";
import type { Product } from "@/lib/types";
import { cn } from "@/lib/utils";

/**
 * A horizontal shelf of products.
 *
 * Refactored from ProductRail rather than rewritten: the scroll mechanism was
 * already right and is kept intact. Native overflow does the work, so touch,
 * trackpad and keyboard all behave for free, and the arrows are a progressive
 * addition that page by one viewport and hide themselves at each end so they
 * are never dead controls.
 *
 * What changed is the container. The rail boxed every shelf in a white card
 * with a bold heading and a "See all" link in the corner, so five shelves read
 * as five identical panels stacked down the page. A shelf now sits directly on
 * the paper with a display-face heading and a hairline above it, which lets the
 * products rather than the panels carry the rhythm.
 *
 * It renders the canonical ProductCard. There is no second card composition.
 */
export function Shelf({
  products,
  title,
  subtitle,
  href,
  hrefLabel = "See all",
  showCta = true,
  className,
}: {
  products: Product[];
  title: string;
  subtitle?: string;
  href?: string;
  hrefLabel?: string;
  showCta?: boolean;
  className?: string;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [canLeft, setCanLeft] = useState(false);
  const [canRight, setCanRight] = useState(false);

  useEffect(() => {
    const el = trackRef.current;
    if (!el) return;

    const update = () => {
      setCanLeft(el.scrollLeft > 4);
      setCanRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
    };
    update();

    el.addEventListener("scroll", update, { passive: true });
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => {
      el.removeEventListener("scroll", update);
      observer.disconnect();
    };
  }, [products.length]);

  function page(direction: 1 | -1) {
    const el = trackRef.current;
    if (!el) return;
    el.scrollBy({ left: direction * Math.max(260, el.clientWidth * 0.85), behavior: "smooth" });
  }

  if (products.length === 0) return null;

  return (
    <section className={cn("border-t border-line pt-6", className)} data-testid={TID.shelf}>
      <div className="mb-4 flex items-end justify-between gap-4">
        <div className="min-w-0">
          <h2 className="font-display text-display-md font-medium text-ink">{title}</h2>
          {subtitle && <p className="mt-1 text-body text-ink-2">{subtitle}</p>}
        </div>

        <div className="flex shrink-0 items-center gap-1">
          {href && (
            <Link
              href={href}
              className="mr-2 inline-flex h-9 items-center gap-1 text-body font-medium text-brand hover:underline"
            >
              {hrefLabel}
              <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
          )}
          <ShelfArrow side="left" enabled={canLeft} onClick={() => page(-1)} />
          <ShelfArrow side="right" enabled={canRight} onClick={() => page(1)} />
        </div>
      </div>

      <div
        ref={trackRef}
        className="no-scrollbar -mx-1 flex snap-x snap-mandatory gap-3 overflow-x-auto scroll-smooth px-1 pb-1 sm:gap-4"
      >
        {products.map((p) => (
          <div key={p.id} className="flex w-[168px] shrink-0 snap-start sm:w-[200px]">
            <ProductCard product={p} showCta={showCta} className="w-full" />
          </div>
        ))}
      </div>
    </section>
  );
}

/**
 * Paging controls sit in the header rather than floating over the products.
 * Overlaid arrows covered the edge cards they were meant to reveal, and on
 * touch they were never reachable anyway.
 */
function ShelfArrow({
  side,
  enabled,
  onClick,
}: {
  side: "left" | "right";
  enabled: boolean;
  onClick: () => void;
}) {
  const Icon = side === "left" ? ChevronLeft : ChevronRight;
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!enabled}
      aria-label={side === "left" ? "Scroll left" : "Scroll right"}
      className={cn(
        "hidden h-9 w-9 items-center justify-center rounded-[var(--radius-btn)] border border-line-strong",
        "bg-surface text-ink transition-colors hover:bg-surface-sunk sm:flex",
        "disabled:cursor-not-allowed disabled:border-line disabled:text-ink-3 disabled:hover:bg-surface"
      )}
    >
      <Icon className="h-5 w-5" />
    </button>
  );
}
