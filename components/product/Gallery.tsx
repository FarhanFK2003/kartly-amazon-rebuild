"use client";

import Image from "next/image";
import { useRef, useState } from "react";
import { cn } from "@/lib/utils";
import type { Product } from "@/lib/types";

/*
  The catalogue holds exactly one photograph per product (see the imagery note
  in ATTRIBUTION.md), so alternate views are derived from that single asset by
  framing it differently rather than by shipping four near-duplicate downloads.
  Each thumbnail is a genuinely different crop of the product, and selecting one
  really does change the main image.
*/
const VIEWS = [
  { scale: 1, origin: "50% 50%" },
  { scale: 1.55, origin: "28% 34%" },
  { scale: 1.55, origin: "72% 62%" },
  { scale: 2.1, origin: "50% 48%" },
] as const;

export function Gallery({ product }: { product: Product }) {
  const [active, setActive] = useState(0);
  const [zoom, setZoom] = useState<{ x: number; y: number } | null>(null);
  const frameRef = useRef<HTMLDivElement>(null);

  const src = product.image;
  if (!src) {
    return <div className="aspect-square w-full rounded-[4px] bg-[#f3f4f4]" aria-hidden />;
  }

  const view = VIEWS[active];
  const origin = zoom ? `${zoom.x}% ${zoom.y}%` : view.origin;
  const scale = zoom ? view.scale * 1.9 : view.scale;

  return (
    <div className="flex gap-3">
      {/* thumbnail rail */}
      <div className="flex shrink-0 flex-col gap-2" role="tablist" aria-label="Product images">
        {VIEWS.map((v, i) => (
          <button
            key={i}
            type="button"
            role="tab"
            aria-selected={i === active}
            aria-label={`Product image ${i + 1} of ${VIEWS.length}`}
            onClick={() => setActive(i)}
            onMouseEnter={() => setActive(i)}
            className={cn(
              "relative h-[52px] w-[52px] overflow-hidden rounded-[4px] border bg-white transition-shadow sm:h-[60px] sm:w-[60px]",
              i === active
                ? "border-[#e77600] shadow-[0_0_3px_2px_rgba(228,121,17,.5)]"
                : "border-line hover:border-[#a6a6a6]"
            )}
          >
            <Image
              src={src}
              alt=""
              fill
              sizes="60px"
              className="object-contain"
              style={{ transform: `scale(${v.scale})`, transformOrigin: v.origin }}
            />
          </button>
        ))}
      </div>

      {/* main image */}
      <div
        ref={frameRef}
        className="relative aspect-square min-w-0 flex-1 cursor-zoom-in overflow-hidden rounded-[4px] bg-white"
        onMouseMove={(e) => {
          const r = frameRef.current?.getBoundingClientRect();
          if (!r) return;
          setZoom({
            x: ((e.clientX - r.left) / r.width) * 100,
            y: ((e.clientY - r.top) / r.height) * 100,
          });
        }}
        onMouseLeave={() => setZoom(null)}
      >
        <Image
          src={src}
          alt={product.title}
          fill
          priority
          sizes="(max-width: 1024px) 90vw, 440px"
          className="object-contain transition-transform duration-200 ease-out"
          style={{ transform: `scale(${scale})`, transformOrigin: origin }}
        />
      </div>
    </div>
  );
}
