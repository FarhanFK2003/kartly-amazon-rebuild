"use client";

import { Check } from "lucide-react";
import { usePdp } from "@/components/product/PdpContext";
import { TID } from "@/lib/testids";
import { cn, formatPrice } from "@/lib/utils";

const LABELS: Record<string, string> = { color: "Colour", size: "Size", style: "Style" };

/**
 * Variant selection.
 *
 * The model is unchanged: the same variant ids, the same selection state in
 * PdpContext, the same price delta feeding the buy box. Only the controls
 * changed - from an orange focus glow that was the only signal of selection,
 * to a brand ring plus a tick on the swatch and a filled chip for size and
 * style.
 *
 * Colour is never communicated by colour alone: the selected swatch carries a
 * tick, the selected chip carries its label in reverse, and the current choice
 * is written out in the heading above. A shopper who cannot distinguish two
 * swatches can still tell which one is active.
 *
 * Renders nothing when a product has no variants, rather than an empty section.
 */
export function VariantPicker() {
  const { product, variant, setVariantId } = usePdp();
  if (product.variants.length === 0) return null;

  const type = product.variants[0].type;
  const isColour = type === "color";
  const label = LABELS[type] ?? "Option";

  return (
    <fieldset className="mt-6" data-testid={TID.pdpVariants}>
      <legend className="text-body text-ink-2">
        {label}: <span className="font-medium text-ink">{variant?.label}</span>
      </legend>

      <div className="mt-3 flex flex-wrap gap-2">
        {product.variants.map((v) => {
          const active = v.id === variant?.id;
          const priced =
            v.priceDelta !== 0 ? ` (${formatPrice(product.price + v.priceDelta)})` : "";

          return (
            <button
              key={v.id}
              type="button"
              onClick={() => setVariantId(v.id)}
              aria-pressed={active}
              aria-label={`${label}: ${v.label}${priced}`}
              data-testid={TID.pdpVariantOption}
              className={cn(
                "relative transition-colors",
                isColour
                  ? "h-11 w-11 rounded-[var(--radius-sm)] border-2 p-[3px]"
                  : "h-11 rounded-[var(--radius-btn)] border px-4 text-body",
                active
                  ? isColour
                    ? "border-brand"
                    : "border-brand bg-brand [color:var(--color-on-brand)]"
                  : "border-line-strong bg-surface text-ink hover:border-ink-3"
              )}
            >
              {isColour ? (
                <>
                  <span
                    className="block h-full w-full rounded-[3px] border border-ink/10"
                    style={{ background: v.swatch ?? "#ddd" }}
                  />
                  {/* State is not carried by colour alone. */}
                  {active && (
                    <span
                      aria-hidden
                      className="absolute inset-0 flex items-center justify-center text-white drop-shadow-[0_1px_2px_rgba(0,0,0,.6)]"
                    >
                      <Check className="h-4 w-4" strokeWidth={3} />
                    </span>
                  )}
                </>
              ) : (
                v.label
              )}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}
