"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { ProductCard } from "@/components/product/ProductCard";
import { SectionHeader } from "@/components/ui/SectionHeader";
import type { Product } from "@/lib/types";
import { cn } from "@/lib/utils";

/**
 * Horizontally scrolling product row.
 *
 * Native overflow scrolling does the work - touch, trackpad and keyboard all
 * behave correctly for free - and the arrows are a progressive addition that
 * page it by one viewport. They hide themselves at each end so they are never
 * dead controls.
 */
export function ProductRail({
  products,
  title,
  subtitle,
  href,
  showCta = true,
}: {
  products: Product[];
  title: string;
  subtitle?: string;
  href?: string;
  showCta?: boolean;
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
    el.scrollBy({ left: direction * Math.max(240, el.clientWidth * 0.85), behavior: "smooth" });
  }

  if (products.length === 0) return null;

  return (
    <section className="card p-4 sm:p-5">
      <SectionHeader
        title={title}
        subtitle={subtitle}
        actionLabel={href ? "See all" : undefined}
        actionHref={href}
        className="mb-3"
      />

      <div className="relative">
        <div
          ref={trackRef}
          className="no-scrollbar flex snap-x snap-mandatory gap-4 overflow-x-auto scroll-smooth pb-1"
        >
          {products.map((p) => (
            <div key={p.id} className="w-[150px] shrink-0 snap-start sm:w-[180px]">
              <ProductCard product={p} variant="grid" showCta={showCta} />
            </div>
          ))}
        </div>

        <RailArrow side="left" visible={canLeft} onClick={() => page(-1)} />
        <RailArrow side="right" visible={canRight} onClick={() => page(1)} />
      </div>
    </section>
  );
}

function RailArrow({
  side,
  visible,
  onClick,
}: {
  side: "left" | "right";
  visible: boolean;
  onClick: () => void;
}) {
  if (!visible) return null;
  const Icon = side === "left" ? ChevronLeft : ChevronRight;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={side === "left" ? "Scroll left" : "Scroll right"}
      className={cn(
        "absolute top-1/2 hidden h-[72px] w-9 -translate-y-1/2 items-center justify-center",
        "rounded-[4px] border border-line bg-white/95 text-ink shadow-[0_2px_8px_rgba(0,0,0,.15)]",
        "hover:bg-white sm:flex",
        side === "left" ? "-left-2" : "-right-2"
      )}
    >
      <Icon className="h-6 w-6" />
    </button>
  );
}
