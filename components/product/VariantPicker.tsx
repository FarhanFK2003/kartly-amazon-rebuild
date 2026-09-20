"use client";

import { usePdp } from "@/components/product/PdpContext";
import { cn, formatPrice } from "@/lib/utils";

const LABELS: Record<string, string> = { color: "Colour", size: "Size", style: "Style" };

/** Colour variants render as swatches; size and style render as chips. */
export function VariantPicker() {
  const { product, variant, setVariantId } = usePdp();
  if (product.variants.length === 0) return null;

  const type = product.variants[0].type;
  const isColour = type === "color";

  return (
    <div className="mt-3">
      <p className="text-[13px] text-ink">
        <span className="font-bold">{LABELS[type] ?? "Option"}:</span>{" "}
        <span className="text-muted">{variant?.label}</span>
      </p>

      <div className="mt-2 flex flex-wrap gap-2">
        {product.variants.map((v) => {
          const active = v.id === variant?.id;
          return (
            <button
              key={v.id}
              type="button"
              onClick={() => setVariantId(v.id)}
              aria-pressed={active}
              title={v.priceDelta ? `${v.label} (${formatPrice(product.price + v.priceDelta)})` : v.label}
              className={cn(
                "rounded-[8px] border bg-white transition-shadow",
                active
                  ? "border-[#e77600] shadow-[0_0_3px_2px_rgba(228,121,17,.4)]"
                  : "border-line hover:border-[#a6a6a6]",
                isColour ? "h-[46px] w-[46px] overflow-hidden p-[3px]" : "px-3 py-[6px]"
              )}
            >
              {isColour ? (
                <span
                  className="block h-full w-full rounded-[5px] border border-black/10"
                  style={{ background: v.swatch ?? "#ddd" }}
                />
              ) : (
                <span className="text-[13px] text-ink">{v.label}</span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
